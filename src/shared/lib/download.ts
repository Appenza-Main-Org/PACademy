/**
 * downloadBlob — trigger a browser-side file download for a generated Blob.
 *
 * Sprint 1 utility used by audit + reports exports. SSR-safe (no-op when
 * the document object isn't available).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  /* Allow the click to settle before revoking. */
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
