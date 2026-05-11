/**
 * ImportLookupButton — page-header trigger for the import wizard.
 *
 * Renders a secondary button that opens <ImportLookupModal>.
 * The caller is responsible for supplying pre-fetched existing rows so the
 * collision pass can run synchronously after parsing.
 *
 * Usage (in LookupTab):
 *   <ImportLookupButton
 *     lookupKey="educationTypes"
 *     lookupTitle="أنواع التعليم"
 *     existingRows={existingRows}
 *     existingSortMax={existingSortMax}
 *   />
 */

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/shared/components';
import type { ExistingRow, ImportLookupKey } from '../../api/lookup-import';
import { ImportLookupModal } from './ImportLookupModal';

interface ImportLookupButtonProps {
  lookupKey: ImportLookupKey;
  lookupTitle: string;
  existingRows: ExistingRow[];
  existingSortMax?: number;
  parentRows?: ExistingRow[];
}

/** Secondary button that opens the import wizard modal. */
export function ImportLookupButton({
  lookupKey,
  lookupTitle,
  existingRows,
  existingSortMax = 0,
  parentRows,
}: ImportLookupButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        leadingIcon={<Upload size={14} strokeWidth={1.75} />}
        onClick={() => setOpen(true)}
      >
        استيراد من ملف
      </Button>

      <ImportLookupModal
        open={open}
        onClose={() => setOpen(false)}
        lookupKey={lookupKey}
        lookupTitle={lookupTitle}
        existingRows={existingRows}
        existingSortMax={existingSortMax}
        parentRows={parentRows}
      />
    </>
  );
}
