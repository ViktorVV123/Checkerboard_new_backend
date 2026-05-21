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
import { PRODUCT_ID_TO_DB, isInvertedProduct } from '../shared/excel-schema';

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
   * Применить формулу пересчёта Остатков (tradeRemains) к импортированным данным.
   *
   *  • Обычные продукты:  Остатки[N] = Остатки[N-1] + Выработка[N] - Отгрузка[N]
   *  • Нефть / ВГО(ННОС): Остатки[N] = Остатки[N-1] + |Отгрузка[N]| - Выработка[N]
   *
   * Anchor-месяц = предыдущий по календарю относительно ТЕКУЩЕЙ даты сервера.
   * Например, если сегодня май → anchor = апрель.
   *
   * Стартовая точка для цепочки формулы:
   *   1. Если anchor-месяц есть в файле → берём tradeRemains за его последний
   *      импортный день. Сам anchor-месяц оставляем как факт (без пересчёта).
   *   2. Если anchor-месяца в файле нет → берём tradeRemains из chess_data_new
   *      за последний день anchor-месяца.
   *   3. Если и в БД нет — продукт пропускаем, в логе предупреждение.
   *
   * Дни ДО anchor-месяца в файле игнорируются — они нам не нужны.
   *
   * Для каждого поля (Выработка, каналы отгрузки) внутри пересчитываемых дней:
   *   - в импорте есть значение ≠ 0 → берём из импорта;
   *   - в импорте 0/нет, в БД есть → берём из БД (только для формулы, в правки НЕ пишем);
   *   - иначе → 0.
   */
  private async applyRemainsFormula(parsed: ParseResult): Promise<void> {
    if (parsed.edits.length === 0) return;

    // 1. Группируем edits по (enterprise, product) → по дате → по полю.
    type DayMap = Map<number, Record<string, number>>;
    const byProduct = new Map<string, { enterprise: string; product: string; days: DayMap }>();

    for (const e of parsed.edits) {
      const key = `${e.enterprise}|${e.product}`;
      let entry = byProduct.get(key);
      if (!entry) {
        entry = { enterprise: e.enterprise, product: e.product, days: new Map() };
        byProduct.set(key, entry);
      }
      let day = entry.days.get(e.date);
      if (!day) {
        day = {};
        entry.days.set(e.date, day);
      }
      day[e.field] = e.value;
    }

    // 2. Anchor-месяц = предыдущий по календарю относительно СЕГОДНЯ.
    //    То есть если сегодня май 2026 → anchor = апрель 2026 (202604).
    //    Anchor — это "месяц-факт": его дни оставляем как пришли (без
    //    пересчёта), и от его последнего дня стартует цепочка формулы для
    //    последующих месяцев.
    //
    //    Если anchor-месяца в файле нет, стартовая точка берётся из БД
    //    (последний день anchor-месяца из chess_data_new).
    //
    //    Дни ДО anchor-месяца в файле игнорируются — нам интересны только
    //    anchor и месяцы после него.
    const anchorMonth = this.previousCalendarMonth();

    type ProductPlan = {
      entry: { enterprise: string; product: string; days: DayMap };
      sortedDates: number[];
      anchorInFile: boolean;          // есть ли anchor-месяц в импорте
      dbAnchorLastDay?: number;       // последний день anchor-месяца (если из БД)
    };

    const plans: ProductPlan[] = [];

    for (const entry of byProduct.values()) {
      const sortedDates = [...entry.days.keys()].sort((a, b) => a - b);
      const months = new Set(sortedDates.map((d) => Math.floor(d / 100)));
      const anchorInFile = months.has(anchorMonth);

      plans.push({
        entry,
        sortedDates,
        anchorInFile,
        dbAnchorLastDay: anchorInFile ? undefined : this.lastDayOfMonth(anchorMonth),
      });
    }

    // Запрос в БД только для single-month продуктов
    const dbQueries = plans
      .filter((p) => p.dbAnchorLastDay !== undefined)
      .map((p) => ({
        enterprise: p.entry.enterprise,
        product: p.entry.product,
        date: p.dbAnchorLastDay!,
      }));

    const prevRowMap = new Map<string, number>();
    if (dbQueries.length > 0) {
      const prevRows = await this.prisma.chess_data_new.findMany({
        where: { OR: dbQueries },
        select: { date: true, enterprise: true, product: true, tradeRemains: true },
      });
      for (const r of prevRows) {
        if (r.tradeRemains === null || r.tradeRemains === undefined) continue;
        const v = Number(r.tradeRemains);
        if (Number.isFinite(v)) {
          prevRowMap.set(`${r.enterprise}|${r.product}|${r.date}`, v);
        }
      }
    }

    // Дополнительно: подтянем из БД expected и каналы для всех дней,
    // которые мы будем считать формулой. Это нужно для правила:
    //   "если в файле 0 или пусто — берём из БД, в правки не пишем".
    // Anchor-месяц (если он есть) — НЕ подтягиваем, его не пересчитываем.
    type DbDayValues = {
      expected: number | null;
      railwayShipmentFact: number | null;
      pipeShipmentFact: number | null;
      mnppShipmentFact: number | null;
      waterShipmentFact: number | null;
    };
    const dbDayMap = new Map<string, DbDayValues>(); // "ent|prod|date" -> values

    const formulaDayQueries: { enterprise: string; product: string; date: number }[] = [];
    for (const plan of plans) {
      const formulaDates = plan.sortedDates.filter(
        (d) => Math.floor(d / 100) > anchorMonth,
      );
      for (const date of formulaDates) {
        formulaDayQueries.push({
          enterprise: plan.entry.enterprise,
          product: plan.entry.product,
          date,
        });
      }
    }

    if (formulaDayQueries.length > 0) {
      const rows = await this.prisma.chess_data_new.findMany({
        where: { OR: formulaDayQueries },
        select: {
          date: true, enterprise: true, product: true,
          expected: true,
          railwayShipmentFact: true,
          pipeShipmentFact: true,
          mnppShipmentFact: true,
          waterShipmentFact: true,
        },
      });
      for (const r of rows) {
        dbDayMap.set(`${r.enterprise}|${r.product}|${r.date}`, {
          expected: r.expected !== null ? Number(r.expected) : null,
          railwayShipmentFact: r.railwayShipmentFact !== null ? Number(r.railwayShipmentFact) : null,
          pipeShipmentFact: r.pipeShipmentFact !== null ? Number(r.pipeShipmentFact) : null,
          mnppShipmentFact: r.mnppShipmentFact !== null ? Number(r.mnppShipmentFact) : null,
          waterShipmentFact: r.waterShipmentFact !== null ? Number(r.waterShipmentFact) : null,
        });
      }
    }

    /**
     * Резолв значения поля для формулы:
     *   - есть в импорте и ≠ 0 → берём из импорта
     *   - в импорте 0 или нет     → пытаемся из БД (если там не 0/null)
     *   - иначе                   → 0
     */
    const resolveField = (
      fileVal: number | undefined,
      dbVal: number | null | undefined,
    ): number => {
      if (fileVal !== undefined && fileVal !== 0) return fileVal;
      if (dbVal !== null && dbVal !== undefined && dbVal !== 0) return dbVal;
      return 0;
    };


    // 3. Прокатываем формулу для каждого продукта.
    //    Сначала вырежем из parsed.edits старые tradeRemains для продуктов,
    //    которые будем пересчитывать (для дней-формулы), чтобы не было дубликатов.
    //    tradeRemains anchor-месяца и стартовых остатков оставляем как пришли.
    let updatedProducts = 0;
    let totalRemainsWritten = 0;

    // Список (продукт, дата) которые нужно вырезать перед добавлением заново.
    const datesToOverride = new Set<string>(); // "ent|prod|date"

    for (const plan of plans) {
      const { entry, sortedDates, anchorInFile, dbAnchorLastDay } = plan;

      // Дни ДО anchor-месяца игнорируем (если такие пришли в файле).
      // Они нам не нужны: anchor — это самый ранний интересующий нас месяц.
      // Также определяем, какие дни считаем формулой (все НЕ-anchor дни).
      const datesToFormula = sortedDates.filter(
        (d) => Math.floor(d / 100) > anchorMonth,
      );

      if (datesToFormula.length === 0) continue;

      // Стартовая точка для цепочки.
      let prevRemains: number | null = null;

      if (anchorInFile) {
        // берём tradeRemains за последний день anchor-месяца из файла
        const anchorDates = sortedDates.filter((d) => Math.floor(d / 100) === anchorMonth);
        const lastAnchorDate = anchorDates[anchorDates.length - 1];
        const anchorDay = entry.days.get(lastAnchorDate);
        if (anchorDay && anchorDay.tradeRemains !== undefined) {
          prevRemains = anchorDay.tradeRemains;
        } else {
          this.logger.warn(
            `applyRemainsFormula: anchor ${anchorMonth} in file but no tradeRemains on ` +
            `${lastAnchorDate} for ${entry.enterprise}/${entry.product} — cannot start chain`,
          );
          continue;
        }
      } else {
        // anchor-месяца в файле нет — берём из БД
        const fromDb = prevRowMap.get(`${entry.enterprise}|${entry.product}|${dbAnchorLastDay}`);
        if (fromDb !== undefined) {
          prevRemains = fromDb;
        } else {
          this.logger.warn(
            `applyRemainsFormula: no starting point in DB for ${entry.enterprise}/${entry.product} ` +
            `(anchor day=${dbAnchorLastDay}) — skipping product`,
          );
          continue;
        }
      }

      // Помечаем даты для замены и прокатываем формулу
      const inverted = isInvertedProduct(entry.enterprise, entry.product);
      let chainRemains = prevRemains;

      for (const date of datesToFormula) {
        datesToOverride.add(`${entry.enterprise}|${entry.product}|${date}`);

        const day = entry.days.get(date)!;
        const dbDay = dbDayMap.get(`${entry.enterprise}|${entry.product}|${date}`);

        // Для каждого поля: импорт > БД > 0
        const expectedRaw   = resolveField(day.expected,            dbDay?.expected);
        const railwayRaw    = resolveField(day.railwayShipmentFact, dbDay?.railwayShipmentFact);
        const pipeRaw       = resolveField(day.pipeShipmentFact,    dbDay?.pipeShipmentFact);
        const mnppRaw       = resolveField(day.mnppShipmentFact,    dbDay?.mnppShipmentFact);
        const waterRaw      = resolveField(day.waterShipmentFact,   dbDay?.waterShipmentFact);

        const expected = Math.abs(expectedRaw);
        const shipment =
          Math.abs(railwayRaw) +
          Math.abs(pipeRaw) +
          Math.abs(mnppRaw) +
          Math.abs(waterRaw);

        const newRemains = inverted
          ? chainRemains + shipment - expected   // Нефть: + |Отгрузка| - Выработка
          : chainRemains + expected - shipment;  // Обычные: + Выработка - Отгрузка

        // обновляем тут же в map (на случай если ниже понадобится)
        entry.days.get(date)!.tradeRemains = newRemains;
        chainRemains = newRemains;
        totalRemainsWritten++;
      }

      updatedProducts++;
    }

    // Дни ДО anchor-месяца игнорируем — выкидываем из parsed.edits целиком.
    // Это правило: оператору интересны только anchor + последующие месяцы.
    const beforeAnchor = parsed.edits.length;
    parsed.edits = parsed.edits.filter((e) => Math.floor(e.date / 100) >= anchorMonth);
    if (beforeAnchor !== parsed.edits.length) {
      this.logger.log(
        `applyRemainsFormula: filtered out ${beforeAnchor - parsed.edits.length} edits ` +
        `from months before anchor (${anchorMonth})`,
      );
    }

    // Перестраиваем parsed.edits: убираем старые tradeRemains в overridden днях
    // и добавляем новые.
    parsed.edits = parsed.edits.filter((e) => {
      if (e.field !== 'tradeRemains') return true;
      return !datesToOverride.has(`${e.enterprise}|${e.product}|${e.date}`);
    });

    for (const key of datesToOverride) {
      const [enterprise, product, dateStr] = key.split('|');
      const date = Number(dateStr);
      const entry = byProduct.get(`${enterprise}|${product}`);
      const value = entry?.days.get(date)?.tradeRemains;
      if (value !== undefined) {
        parsed.edits.push({ date, enterprise, product, field: 'tradeRemains', value });
      }
    }

    this.logger.log(
      `applyRemainsFormula: ${updatedProducts}/${byProduct.size} products recalculated, ` +
      `${totalRemainsWritten} tradeRemains written`,
    );
  }

  /** Предыдущий YYYYMMDD-день (учёт месяца/года). */
  private previousYmd(ymd: number): number {
    const y = Math.floor(ymd / 10000);
    const m = Math.floor((ymd / 100) % 100);
    const d = ymd % 100;
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);
    return (
      date.getUTCFullYear() * 10000 +
      (date.getUTCMonth() + 1) * 100 +
      date.getUTCDate()
    );
  }

  /**
   * Предыдущий календарный месяц относительно сегодняшнего дня.
   * Возвращает YYYYMM. Например, если сегодня 21.05.2026 → 202604.
   */
  private previousCalendarMonth(): number {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1; // 1..12
    if (m === 1) return (y - 1) * 100 + 12;
    return y * 100 + (m - 1);
  }

  /**
   * Последний день месяца (YYYYMM) в формате YYYYMMDD.
   * Например, для 202604 → 20260430.
   */
  private lastDayOfMonth(yyyymm: number): number {
    const y = Math.floor(yyyymm / 100);
    const m = yyyymm % 100;
    // day 0 следующего месяца = последний день текущего
    const date = new Date(Date.UTC(y, m, 0));
    return (
      date.getUTCFullYear() * 10000 +
      (date.getUTCMonth() + 1) * 100 +
      date.getUTCDate()
    );
  }

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

    // Пересчитываем tradeRemains цепочкой по формуле — заменяя то, что
    // пришло в файле в колонке Накопление (505_). Стартовая точка
    // берётся из chess_data_new (день перед первым импортным), а если
    // её там нет — то из самого первого импортного дня файла.
    await this.applyRemainsFormula(parsed);

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
