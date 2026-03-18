// src/approvals/approvals.config.ts
// Фиксированные согласующие по заводам
// Позже можно заменить на ldap-группы

export interface Approver {
  username: string;
  fullName: string;
}

export const APPROVERS_BY_ENTERPRISE: Record<string, Approver[]> = {
  'ВНП': [
    { username: 'vlasyukviv',    fullName: 'Власюк Виктор Васильевич' },
    { username: 'mikhajlovdmn',  fullName: 'Михайлов Д.М.' },
    { username: 'borzovpe',      fullName: 'Борзов П.Е.' },
    { username: 'mikhajlovnn',   fullName: 'Михайлов Н.Н.' },
  ],
  'ННОС': [
    { username: 'vlasyukviv',    fullName: 'Власюк Виктор Васильевич' },
    { username: 'mikhajlovdmn',  fullName: 'Михайлов Д.М.' },
    { username: 'borzovpe',      fullName: 'Борзов П.Е.' },
    { username: 'mikhajlovnn',   fullName: 'Михайлов Н.Н.' },
  ],
  'ПНОС': [
    { username: 'vlasyukviv',    fullName: 'Власюк Виктор Васильевич' },
    { username: 'mikhajlovdmn',  fullName: 'Михайлов Д.М.' },
    { username: 'borzovpe',      fullName: 'Борзов П.Е.' },
    { username: 'mikhajlovnn',   fullName: 'Михайлов Н.Н.' },
  ],
};
