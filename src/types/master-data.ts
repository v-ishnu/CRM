export type MasterDataType =
  | 'SERVICE_CATEGORY'
  | 'SERVICE'
  | 'HOSTING_PROVIDER'
  | 'HOSTING_TYPE'
  | 'CREDENTIAL_TYPE'
  | 'TASK_TYPE'
  | 'PAYMENT_METHOD'
  | 'PAYMENT_TYPE'
  | 'TEAM_DESIGNATION';

export const MASTER_DATA_TYPES: MasterDataType[] = [
  'SERVICE_CATEGORY',
  'SERVICE',
  'HOSTING_PROVIDER',
  'HOSTING_TYPE',
  'CREDENTIAL_TYPE',
  'TASK_TYPE',
  'PAYMENT_METHOD',
  'PAYMENT_TYPE',
  'TEAM_DESIGNATION',
];

export interface MasterDataItem {
  _id: string;
  type: MasterDataType;
  key: string;
  label: string;
  description?: string;
  parentId?: { _id: string; label: string; key: string } | string | null;
  parentKey?: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystemDefault: boolean;
  metadata?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export type MasterDataItemDTO = MasterDataItem;
