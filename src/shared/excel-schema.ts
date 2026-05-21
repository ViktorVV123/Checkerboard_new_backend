// src/shared/excel-schema.ts
//
// Источник истины для импорта шахматки из Excel.
// Используется бэком (chess-excel.parser.ts).
// Копия этого файла должна лежать на фронте в src/utils/excelSchema.ts
// (нужна для подсветки превью).

/**
 * Маппинг префикса кода (R4 в шапке шахматки) → поле в chess_data_new.
 *
 * Если на одну ячейку (date × product × field) приходит несколько колонок
 * одного префикса (например ЖД ВР + ЖД экспорт = два столбца "3_"),
 * значения СУММИРУЮТСЯ.
 *
 * 700_ (свободная ёмкость) намеренно отсутствует — freeCapacity производное
 * (parkVolume - tradeRemains), фронт пересчитает сам.
 */
export const PREFIX_TO_FIELD: Record<string, string> = {
  '3': 'railwayShipmentFact', // Ж/Д (ВР, экспорт, СУПЭ)
  '1': 'waterShipmentFact',   // Вода (причалы)
  '2': 'pipeShipmentFact',    // Труба
  '5': 'mnppShipmentFact',    // МНПП
  '203': 'expected',          // Выработка
  '201': 'expected',          // Переработка (для Нефти)
  '505': 'tradeRemains',      // Накопление (товар + компонент)
};

/**
 * Точечные исключения: для конкретного product_id переопределить
 * маппинг префикса на другое поле.
 *
 * Зачем: у Нефти в шаблоне колонка называется "Поставка" и стоит под
 * префиксом 3_ (по аналогии с ЖД у обычных продуктов), но физически
 * нефть приходит по трубе. Поэтому 3_2054 → pipeShipmentFact, а не
 * railwayShipmentFact (как у других продуктов).
 *
 * Структура: product_id → prefix → field
 */
export const PREFIX_OVERRIDES: Record<string, Record<string, string>> = {
  '2054': { // Нефть
    '3': 'pipeShipmentFact',
  },
};

/**
 * Маппинг product_id из кода R4 → продукт для предприятия ВНП.
 *
 * dbProduct  — точное название в chess_data_new (для запросов).
 * displayName — как продукт показывается пользователю (то, что видит на фронте).
 * Они различаются у ТС-1: в БД хранится "Авиакеросины", отображается "ТС-1".
 *
 * Канонизация имён файла → БД:
 *   ВГЛ  → ВГО
 *   ДТ С/F → ДТ сорт
 *   БГС/КБН/СУПЭ → Нафта
 *   ТС-1 в файле → "Авиакеросины" в БД
 *   ТБЛ DMA → ТБЛ (без кода в файле, маппинга нет — игнорируем)
 *
 * Продукты, которых нет в файле (ДТ кл., СУГ, Кокс, Кост) —
 * импорт их не трогает; в БД остаются прежние значения.
 */
export const PRODUCT_ID_TO_DB: Record<
  string,
  { enterprise: string; dbProduct: string; displayName: string }
> = {
  '2054':    { enterprise: 'ВНП', dbProduct: 'Нефть',         displayName: 'Нефть' },
  '1480873': { enterprise: 'ВНП', dbProduct: 'Мазут',         displayName: 'Мазут' },
  '1481031': { enterprise: 'ВНП', dbProduct: 'ВГО',           displayName: 'ВГО' },
  '3006993': { enterprise: 'ВНП', dbProduct: 'ДТ сорт',       displayName: 'ДТ сорт' },
  '1629478': { enterprise: 'ВНП', dbProduct: 'ТБЛ',           displayName: 'ТБЛ' },
  '12020':   { enterprise: 'ВНП', dbProduct: 'Нафта',         displayName: 'Нафта' },
  '1740109': { enterprise: 'ВНП', dbProduct: 'АИ-92',         displayName: 'АИ-92' },
  '2150510': { enterprise: 'ВНП', dbProduct: 'АИ-95',         displayName: 'АИ-95' },
  '1318':    { enterprise: 'ВНП', dbProduct: 'Авиакеросины',  displayName: 'ТС-1' },
};

/**
 * Список префиксов, которые мы НЕ грузим (но видим в файле).
 * 700_ — это значение freeCapacity по датам; freeCapacity производное.
 */
export const IGNORED_PREFIXES = new Set(['700']);

/**
 * Продукты с "инвертированной" логикой остатков:
 * вместо «выработка → отгрузка» у них «поставка → переработка».
 *
 *  • Нефть на любом заводе — приходит, перерабатывается.
 *  • ВГО на ННОС — то же самое.
 *
 * Формула остатков:
 *   обычные:    Остатки[N] = Остатки[N-1] + Выработка[N] - Отгрузка[N]
 *   инверт.:    Остатки[N] = Остатки[N-1] + |Отгрузка[N]| - Выработка[N]
 *
 * Дублируется на фронте в src/utils/calculations.ts (isInvertedProduct).
 * При изменении — менять оба.
 */
export const isInvertedProduct = (enterprise: string, product: string): boolean => {
  if (product === 'Нефть') return true;
  if (enterprise === 'ННОС' && product === 'ВГО') return true;
  return false;
};

/**
 * Поддерживаемые предприятия для импорта.
 * Пока только ВНП — у других заводов свои форматы шахматок.
 */
export const IMPORT_SUPPORTED_ENTERPRISES = ['ВНП'] as const;
export type ImportEnterprise = (typeof IMPORT_SUPPORTED_ENTERPRISES)[number];

/**
 * Имя листа шахматки внутри xlsx.
 */
export const CHESS_SHEET_NAME = 'Шахматка';

/**
 * Строки шапки. R5 и далее — данные.
 */
export const HEADER_ROWS = {
  PRODUCT: 2,  // R2: название продукта (merged cells)
  METRIC: 3,   // R3: показатель (Выработка/Накопление/ЖД/...)
  CODE: 4,     // R4: код вида <prefix>_<product_id>
} as const;

export const FIRST_DATA_ROW = 5;
