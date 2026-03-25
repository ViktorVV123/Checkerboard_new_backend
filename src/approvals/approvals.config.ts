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
    { username: 'kislovdmm',  fullName: 'Кислов Дмитрий Михайлович' },
    { username: 'borzovpe',      fullName: 'Борзов П.Е.' },
    { username: 'ivanovdmitrya',   fullName: 'Иванов Дмитрий Александрович' },
  ],
  'ННОС': [
    { username: 'vlasyukviv',    fullName: 'Власюк Виктор Васильевич' },
    { username: 'kislovdmm',  fullName: 'Кислов Дмитрий Михайлович' },
    { username: 'borzovpe',      fullName: 'Борзов П.Е.' },
    { username: 'ivanovdmitrya',   fullName: 'Иванов Дмитрий Александрович' },
  ],
  'ПНОС': [
    { username: 'vlasyukviv',    fullName: 'Власюк Виктор Васильевич' },
    { username: 'kislovdmm',  fullName: 'Кислов Дмитрий Михайлович' },
    { username: 'borzovpe',      fullName: 'Борзов П.Е.' },
    { username: 'ivanovdmitrya',   fullName: 'Иванов Дмитрий Александрович' },
  ],
};
