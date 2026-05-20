// src/import/import.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChessExcelParser,
  ParseResult,
} from './parsers/chess-excel.parser';
import { CommitImportDto } from './dto/commit-import.dto';
import { PreviewResponseDto } from './dto/preview-response.dto';
import { PRODUCT_ID_TO_DB } from '../shared/excel-schema';

/**
 * Поля _scenario_edits хранят значения как строку (VARCHAR(255)),
 * чтобы сохранить контракт с уже существующим фронтом.
 */
const toEditValue = (n: number | null): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  // округляем чтобы не было хвостов типа 2329.7894736842104 в БД
  return String(Math.round(n * 1e6) / 1e6);
};

/**
 * Псевдо-id для дат, которых нет в chess_data_new.
 * Должен совпадать с FactoriesService.fillMissingDays — иначе
 * правки не «склеятся» с виртуальными строками на фронте.
 *
 * Алгоритм: hash(productName) % 100, id = -(date * 100 + hash).
 */
function virtualRowId(date: number, dbProduct: string): number {
  let h = 0;
  for (let i = 0; i < dbProduct.length; i++) {
    h = ((h << 5) - h + dbProduct.charCodeAt(i)) | 0;
  }
  h = Math.abs(h) % 100;
  return -(date * 100 + h);
}

// Сколько строк превью отдавать на каждый продукт (для UI),
// весь набор всё равно лежит в edits — это просто подсказка.
const PREVIEW_HARD_LIMIT_ROWS = 50000;

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Распарсить файл и вернуть превью.
   * Ничего не пишем в БД — только показываем что будет.
   */
  async preview(file: Express.Multer.File): Promise<PreviewResponseDto> {
    this.validateFile(file);
    const parser = new ChessExcelParser();

    let parsed: ParseResult;
    try {
      parsed = await parser.parse(file.buffer);
    } catch (e: any) {
      throw new BadRequestException(
        `Не удалось разобрать файл: ${e?.message ?? 'неизвестная ошибка'}`,
      );
    }

    if (parsed.edits.length > PREVIEW_HARD_LIMIT_ROWS) {
      throw new BadRequestException(
        `Слишком большой объём изменений: ${parsed.edits.length}. Лимит ${PREVIEW_HARD_LIMIT_ROWS}.`,
      );
    }

    const matchedProductsSet = new Set<string>();
    for (const r of parsed.recognized) {
      // показываем displayName (то, что юзер видит в UI)
      const db = Object.values(PRODUCT_ID_TO_DB).find(
        (x) => x.dbProduct === r.product && x.enterprise === r.enterprise,
      );
      matchedProductsSet.add(db?.displayName ?? r.product);
    }

    return {
      summary: {
        recognizedCols: parsed.recognized.length,
        unrecognizedCols: parsed.unrecognized.length,
        matchedProducts: [...matchedProductsSet].sort(),
        editsCount: parsed.edits.length,
        parkVolumesCount: parsed.parkVolumes.length,
        dataRowsCount: parsed.totalDataRows,
        dateRange: parsed.dateRange,
      },
      // edits и parkVolumes возвращаем как есть (с именами из БД) —
      // фронт по своему словарю на лету подставит displayName при отрисовке
      edits: parsed.edits,
      parkVolumes: parsed.parkVolumes,
      unrecognized: parsed.unrecognized,
    };
  }

  /**
   * Создать новый черновик и залить в него правки одной транзакцией.
   * Возвращает id созданного сценария.
   */
  async commit(
    dto: CommitImportDto,
    username: string,
  ): Promise<{ scenarioId: number; editsWritten: number }> {
    if (!username) {
      throw new BadRequestException('Не определён пользователь');
    }
    if (!dto.edits.length && !dto.parkVolumes.length) {
      throw new BadRequestException('В импортируемых данных нет ни одной правки');
    }

    // 1. Сгруппируем все правки по originalId (= виртуальный или реальный id строки)
    //    На входе у нас (date, enterprise, product, field, value).
    //    Для каждого (date, enterprise, dbProduct) находим id в chess_data_new
    //    или, если нет, генерируем виртуальный.
    const dateProductPairs = new Set<string>();
    for (const e of dto.edits) {
      dateProductPairs.add(`${e.date}|${e.enterprise}|${e.product}`);
    }
    for (const pv of dto.parkVolumes) {
      // parkVolume пишем на КАЖДУЮ дату из edits для этого продукта
      // (а если у продукта нет edits — добавим для всего диапазона)
    }

    // Список всех (enterprise, product), для которых пришёл parkVolume
    const parkByProduct = new Map<string, number>(); // ключ "ent|prod"
    for (const pv of dto.parkVolumes) {
      parkByProduct.set(`${pv.enterprise}|${pv.product}`, pv.value);
    }

    // Соберём диапазон дат из edits (для случая «продукт только в parkVolumes»
    // и для добавления parkVolume на все даты)
    let minDate = Infinity;
    let maxDate = -Infinity;
    for (const e of dto.edits) {
      if (e.date < minDate) minDate = e.date;
      if (e.date > maxDate) maxDate = e.date;
    }

    // 2. Достанем реальные id строк из chess_data_new одним запросом
    //    по диапазону дат + списку продуктов.
    const allProducts = new Set<string>();
    for (const e of dto.edits) allProducts.add(e.product);
    for (const pv of dto.parkVolumes) allProducts.add(pv.product);

    const realRows = await this.prisma.chess_data_new.findMany({
      where: {
        enterprise: dto.enterprise,
        product: { in: [...allProducts] },
        ...(Number.isFinite(minDate) && Number.isFinite(maxDate)
          ? { date: { gte: minDate, lte: maxDate } }
          : {}),
      },
      select: { id: true, date: true, product: true },
    });

    const realIdByKey = new Map<string, number>();
    for (const r of realRows) {
      realIdByKey.set(`${r.date}|${dto.enterprise}|${r.product}`, r.id);
    }

    /** Получить originalId для (date, enterprise, product). */
    const resolveOriginalId = (
      date: number,
      enterprise: string,
      product: string,
    ): number => {
      const k = `${date}|${enterprise}|${product}`;
      const real = realIdByKey.get(k);
      if (real !== undefined) return real;
      return virtualRowId(date, product);
    };

    // 3. Финальный список (originalId, field, value)
    type EditRow = { originalId: number; field: string; value: string };
    const editsToWrite: EditRow[] = [];

    for (const e of dto.edits) {
      editsToWrite.push({
        originalId: resolveOriginalId(e.date, e.enterprise, e.product),
        field: e.field,
        value: toEditValue(e.value),
      });
    }

    // parkVolume — пишем на каждую дату из всего диапазона импорта
    // (т.к. в БД parkVolume хранится на каждой строке, как и tradeRemains)
    if (parkByProduct.size > 0 && Number.isFinite(minDate) && Number.isFinite(maxDate)) {
      // соберём список дат, на которые есть смысл писать parkVolume:
      // только те, что встречались в edits (чтобы не плодить правки на «пустые» даты)
      const datesByProduct = new Map<string, Set<number>>();
      for (const e of dto.edits) {
        const key = `${e.enterprise}|${e.product}`;
        if (!datesByProduct.has(key)) datesByProduct.set(key, new Set());
        datesByProduct.get(key)!.add(e.date);
      }

      for (const [prodKey, parkValue] of parkByProduct) {
        const [enterprise, product] = prodKey.split('|');
        const dates = datesByProduct.get(prodKey);
        if (!dates || dates.size === 0) {
          // У продукта нет edits, но есть парк — пишем парк на все даты,
          // для которых нашлись реальные строки в БД
          for (const r of realRows) {
            if (r.product !== product) continue;
            editsToWrite.push({
              originalId: r.id,
              field: 'parkVolume',
              value: toEditValue(parkValue),
            });
          }
          continue;
        }
        for (const date of dates) {
          editsToWrite.push({
            originalId: resolveOriginalId(date, enterprise, product),
            field: 'parkVolume',
            value: toEditValue(parkValue),
          });
        }
      }
    }

    if (editsToWrite.length === 0) {
      throw new BadRequestException('Нечего сохранять');
    }

    // 4. Транзакция: создаём черновик + правки
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const scenario = await tx.scenarios.create({
          data: {
            name: dto.scenarioName,
            author: username,
            enterprise: dto.enterprise,
            comment: dto.comment ?? `Импорт из Excel`,
            isDraft: true,
            createdBy: username,
          },
        });

        // вставляем порциями (createMany не имеет лимита в Prisma,
        // но Postgres имеет ~65k параметров на один statement)
        const CHUNK = 5000;
        for (let i = 0; i < editsToWrite.length; i += CHUNK) {
          const slice = editsToWrite.slice(i, i + CHUNK);
          await tx.scenario_edits.createMany({
            data: slice.map((e) => ({
              scenarioId: scenario.id,
              originalId: e.originalId,
              field: e.field,
              value: e.value,
            })),
          });
        }

        return { scenarioId: scenario.id, editsWritten: editsToWrite.length };
      });

      this.logger.log(
        `import committed: scenario ${result.scenarioId}, ${result.editsWritten} edits, user ${username}`,
      );

      return result;
    } catch (e: any) {
      this.logger.error('commit failed', e?.stack ?? e?.message);
      throw new InternalServerErrorException(
        `Не удалось сохранить импорт: ${e?.message ?? 'ошибка БД'}`,
      );
    }
  }

  // --- validation ---

  private validateFile(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не передан');
    }
    if (!file.originalname?.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Поддерживаются только .xlsx');
    }
    if (file.size === 0) {
      throw new BadRequestException('Файл пустой');
    }
  }
}
