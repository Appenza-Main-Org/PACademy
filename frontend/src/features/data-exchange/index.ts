/**
 * Data-Exchange feature public API. Page is consumed by the admin route table;
 * everything else stays internal to the feature.
 */
export { DataExchangePage } from './pages/DataExchangePage';
export type {
  ExchangeDomain,
  ExportLayout,
  ExportFilter,
  ImportRowClass,
  ImportPreview,
  ImportApplyMode,
  DataExchangeHistoryEntry,
} from './types';
export { SHEET_NAMES } from './types';
