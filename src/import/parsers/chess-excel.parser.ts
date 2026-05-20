// src/import/parsers/chess-excel.parser.ts
import { Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  PREFIX_TO_FIELD,
  PREFIX_OVERRIDES,
  PRODUCT_ID_TO_DB,
  IGNORED_PREFIXES,
  CHESS_SHEET_NAME,
  HEADER_ROWS,
  FIRST_DATA_ROW,
} from '../../shared/excel-schema';

// --- Типы вывода парсера ---

/** Распознанная колонка после прохода по шапке. */
export interface RecognizedColumn {
  col: number;
  productId: string;
  prefix: string;
  field: string;        // куда мапим в БД (railwayShipmentFact / expected / ...)
  enterprise: string;
  product: string;      // канонизированное имя из БД
  metricLabel: string;  // что было в R3 (для отображения в превью)
}

/** Колонка, которую не смогли распознать (для отчёта пользователю). */
export interface UnrecognizedColumn {
  col: number;
  productLabel: string | null;  // что было в R2
  metricLabel: string | null;   // что было в R3
  reason: 'no_code' | 'unknown_product_id' | 'unknown_prefix' | 'ignored_prefix';
  raw?: string;                  // что было в R4
}

/** Готовая запись для отгрузки в БД (одна правка). */
export interface ParsedEdit {
  date: number;              // YYYYMMDD
  enterprise: string;
  product: string;
  field: string;
  value: number;             // итоговое (с учётом суммирования по префиксу)
}

/** Информация про парк — одно значение на продукт. */
export interface ParsedParkVolume {
  enterprise: string;
  product: string;
  value: number;
}

export interface ParseResult {
  edits: ParsedEdit[];
  parkVolumes: ParsedParkVolume[];
  recognized: RecognizedColumn[];
  unrecognized: UnrecognizedColumn[];
  dateRange: { from: number; to: number };
  totalDataRows: number;
  skippedRows: { row: number; reason: string }[];
}

// --- Утилиты ---

const CODE_REGEX = /^(\d+)_(\d+)/;

function dateToYmd(d: Date): number {
  // важно: используем UTC, потому что exceljs читает '2026-04-01 00:00:00' как UTC
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return parseInt(`${y}${m}${day}`, 10);
}

/** Достаёт строковое значение из ячейки exceljs (rich text, formula и т.д.). */
function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    // rich text
    if ('richText' in value && Array.isArray((value as any).richText)) {
      return (value as any).richText.map((r: any) => r.text).join('');
    }
    // formula result
    if ('result' in value) {
      const r = (value as any).result;
      return r === null || r === undefined ? null : String(r);
    }
    // sharedFormula или error
    return null;
  }
  return String(value);
}

/** Возвращает числовое значение или null, если ячейка пуста/не число. */
function cellNumber(value: ExcelJS.CellValue): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object') {
    if ('result' in value) {
      const r = (value as any).result;
      if (typeof r === 'number' && Number.isFinite(r)) return r;
      return null;
    }
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/\s/g, '').replace(',', '.');
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function cellDate(value: ExcelJS.CellValue): Date | null {
  if (value instanceof Date) return value;
  return null;
}

// --- Парсер ---

export class ChessExcelParser {
  private readonly logger = new Logger(ChessExcelParser.name);

  async parse(buffer: Buffer): Promise<ParseResult> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);

    const ws = wb.getWorksheet(CHESS_SHEET_NAME);
    if (!ws) {
      throw new Error(
        `В файле не найден лист "${CHESS_SHEET_NAME}". ` +
        `Доступные листы: ${wb.worksheets.map((s) => s.name).join(', ')}`,
      );
    }

    const recognized: RecognizedColumn[] = [];
    const unrecognized: UnrecognizedColumn[] = [];
    const parkByProductId = new Map<string, number>();

    // 1. Проход по шапке (со 2-й колонки — A это даты)
    for (let col = 2; col <= ws.columnCount; col++) {
      const productLabel = cellText(ws.getCell(HEADER_ROWS.PRODUCT, col).value);
      const metricLabel = cellText(ws.getCell(HEADER_ROWS.METRIC, col).value);
      const codeRaw = cellText(ws.getCell(HEADER_ROWS.CODE, col).value);

      // Колонка может быть "разделителем" — пропускаем без шума
      if (!productLabel && !metricLabel && !codeRaw) continue;

      // Колонка-объём парка: в R2 стоит число (например "22276"),
      // в R3 — "Св. ёмкость", в R4 — код вида "700_<id>".
      // Это значение объёма парка для предыдущего продукта.
      if (productLabel && /^\d+([.,]\d+)?$/.test(productLabel.trim())) {
        const parkValue = Number(productLabel.replace(',', '.'));
        // К какому продукту относится — берём id из кода 700_xxx
        if (codeRaw) {
          const firstCode = codeRaw.split('\n')[0].trim();
          const m = firstCode.match(CODE_REGEX);
          if (m && Number.isFinite(parkValue)) {
            const [, prefix, prodId] = m;
            if (prefix === '700' && PRODUCT_ID_TO_DB[prodId]) {
              parkByProductId.set(prodId, parkValue);
            }
          }
        }
        unrecognized.push({
          col,
          productLabel,
          metricLabel,
          reason: 'ignored_prefix',
          raw: codeRaw ?? undefined,
        });
        continue;
      }

      if (!codeRaw) {
        // нет кода — не понимаем куда мапить
        unrecognized.push({
          col,
          productLabel,
          metricLabel,
          reason: 'no_code',
        });
        continue;
      }

      // в R4 может быть несколько кодов через \n — берём первый
      const firstCode = codeRaw.split('\n')[0].trim();
      const match = firstCode.match(CODE_REGEX);
      if (!match) {
        unrecognized.push({
          col,
          productLabel,
          metricLabel,
          reason: 'no_code',
          raw: codeRaw,
        });
        continue;
      }

      const [, prefix, productId] = match;

      if (IGNORED_PREFIXES.has(prefix)) {
        // 700_ намеренно игнорируем (свободная ёмкость по датам — производное)
        unrecognized.push({
          col,
          productLabel,
          metricLabel,
          reason: 'ignored_prefix',
          raw: codeRaw,
        });
        continue;
      }

      // Сначала проверяем override для конкретного product_id (например, у Нефти
      // префикс 3_ означает не ЖД, а Трубу). Если override нет — берём дефолтный мап.
      const field = PREFIX_OVERRIDES[productId]?.[prefix] ?? PREFIX_TO_FIELD[prefix];
      if (!field) {
        unrecognized.push({
          col,
          productLabel,
          metricLabel,
          reason: 'unknown_prefix',
          raw: codeRaw,
        });
        continue;
      }

      const dbProduct = PRODUCT_ID_TO_DB[productId];
      if (!dbProduct) {
        unrecognized.push({
          col,
          productLabel,
          metricLabel,
          reason: 'unknown_product_id',
          raw: codeRaw,
        });
        continue;
      }

      recognized.push({
        col,
        productId,
        prefix,
        field,
        enterprise: dbProduct.enterprise,
        product: dbProduct.dbProduct,
        metricLabel: metricLabel ?? '',
      });
    }

    // 2. Проход по строкам данных — собираем правки с суммированием.
    //    Ключ агрегации: (date, enterprise, product, field).
    const editMap = new Map<string, number>();
    const editKey = (d: number, e: string, p: string, f: string) =>
      `${d}|${e}|${p}|${f}`;

    let minDate = Infinity;
    let maxDate = -Infinity;
    let totalDataRows = 0;
    const skippedRows: { row: number; reason: string }[] = [];

    for (let row = FIRST_DATA_ROW; row <= ws.rowCount; row++) {
      const dateCell = ws.getCell(row, 1).value;
      const date = cellDate(dateCell);

      if (!date) {
        const txt = cellText(dateCell);
        if (txt) {
          // ИТОГО АПР, Среднее, Тёмные, Светлые и т.д. — это норма, не ошибка
          skippedRows.push({ row, reason: `non-date: "${txt}"` });
        }
        continue;
      }

      const ymd = dateToYmd(date);
      if (!Number.isFinite(ymd) || ymd < 19700101) {
        skippedRows.push({ row, reason: `invalid date: ${date.toISOString()}` });
        continue;
      }

      totalDataRows++;
      if (ymd < minDate) minDate = ymd;
      if (ymd > maxDate) maxDate = ymd;

      for (const rc of recognized) {
        const val = cellNumber(ws.getCell(row, rc.col).value);
        if (val === null) continue;
        const key = editKey(ymd, rc.enterprise, rc.product, rc.field);
        editMap.set(key, (editMap.get(key) ?? 0) + val);
      }
    }

    const edits: ParsedEdit[] = [];
    for (const [key, value] of editMap) {
      const [d, e, p, f] = key.split('|');
      edits.push({
        date: parseInt(d, 10),
        enterprise: e,
        product: p,
        field: f,
        value,
      });
    }

    // 3. parkVolume — одно значение на (enterprise, product)
    const parkVolumes: ParsedParkVolume[] = [];
    for (const [productId, value] of parkByProductId) {
      const db = PRODUCT_ID_TO_DB[productId];
      if (!db) continue;
      parkVolumes.push({
        enterprise: db.enterprise,
        product: db.dbProduct,
        value,
      });
    }

    if (!Number.isFinite(minDate) || !Number.isFinite(maxDate)) {
      throw new Error('В файле не найдено ни одной строки с датой.');
    }

    this.logger.log(
      `parsed: ${recognized.length} cols recognized, ${unrecognized.length} ignored, ` +
      `${edits.length} edits, ${parkVolumes.length} park volumes, ` +
      `dates ${minDate}..${maxDate}`,
    );

    return {
      edits,
      parkVolumes,
      recognized,
      unrecognized,
      dateRange: { from: minDate, to: maxDate },
      totalDataRows,
      skippedRows,
    };
  }
}
