/**
 * Public surface for the Lookup Management Module.
 *
 * External consumers (admin pages, committees, applicant portal) read
 * lookup data through the typed query hooks and the strongly-typed
 * `LookupTypeCode`. Components and pages stay internal — feature pages
 * compose them via the in-feature paths, not the barrel.
 *
 * NOTE — query hooks and the service are added in the next commit; this
 * barrel currently only exposes types.
 */

export {
  LOOKUP_TYPE_CODES,
  HIERARCHICAL_TYPES,
  type LookupTypeCode,
  type LookupType,
  type LookupItem,
  type LookupTreeNode,
  type LookupMappingPair,
  type LookupMappings,
  type LookupMappingKind,
  type LookupFilters,
  type LookupConflictCode,
} from './types';
