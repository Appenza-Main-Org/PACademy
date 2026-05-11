/**
 * Public surface for the Lookup Management Module.
 *
 * External consumers (admin pages, committees, applicant portal) read
 * lookup data through the typed query hooks and the strongly-typed
 * `LookupTypeCode`. Components and pages stay internal — feature pages
 * compose them via the in-feature paths, not the barrel.
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

export {
  lookupsService,
  type LookupItemInput,
  type LookupItemPatch,
} from './api/lookups.service';

export {
  lookupKeys,
  useLookupTypes,
  useLookupList,
  useLookupTree,
  useLookupMappings,
  useCreateLookup,
  useUpdateLookup,
  useDeleteLookup,
  useReorderLookups,
  useAddMapping,
  useRemoveMapping,
} from './api/lookups.queries';
