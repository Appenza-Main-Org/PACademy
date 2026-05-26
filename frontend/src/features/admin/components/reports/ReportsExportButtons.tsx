import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button, DropdownMenu, toast } from '@/shared/components';
import { reportsService } from '../../api/reports.service';
import { useReportsFiltersStore } from '../../reports/store';
import type { ReportsExportFormat, ReportsExportKind } from '../../reports/types';

export type ReportExportColumn<TRow> = {
  key: string;
  label: string;
  value?: (row: TRow) => string | number | null | undefined;
};

interface ReportsExportButtonsProps<TRow> {
  title: string;
  report: ReportsExportKind;
  getRows: () => readonly TRow[];
  getColumns: () => readonly ReportExportColumn<TRow>[];
  printNodeRef?: React.RefObject<HTMLElement>;
}

function cellValue<TRow>(row: TRow, column: ReportExportColumn<TRow>): string | number {
  const value = column.value
    ? column.value(row)
    : (row as Record<string, unknown>)[column.key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return value == null ? '' : String(value);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function rowsToHtml<TRow>(
  title: string,
  rows: readonly TRow[],
  columns: readonly ReportExportColumn<TRow>[],
): string {
  const escape = (value: string | number) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  const head = columns.map((column) => `<th>${escape(column.label)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${escape(cellValue(row, column))}</td>`).join('')}</tr>`)
    .join('');
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;direction:rtl}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:6px;text-align:right}th{background:#eee}</style></head><body><h1>${escape(title)}</h1><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

async function exportClientSide<TRow>(
  format: ReportsExportFormat,
  title: string,
  rows: readonly TRow[],
  columns: readonly ReportExportColumn<TRow>[],
): Promise<void> {
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const sheetRows = rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column.label, cellValue(row, column)])),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), 'Reports');
    XLSX.writeFile(workbook, `${title}.xlsx`);
    return;
  }
  const html = rowsToHtml(title, rows, columns);
  const extension = format === 'docx' ? 'doc' : 'html';
  const type = format === 'docx' ? 'application/msword;charset=utf-8' : 'text/html;charset=utf-8';
  downloadBlob(new Blob([html], { type }), `${title}.${extension}`);
}

export function ReportsExportButtons<TRow>({
  title,
  report,
  getRows,
  getColumns,
  printNodeRef,
}: ReportsExportButtonsProps<TRow>): JSX.Element {
  const filters = useReportsFiltersStore((state) => state.filters);

  const run = async (format: ReportsExportFormat | 'print'): Promise<void> => {
    const rows = getRows();
    const columns = getColumns();
    if (format === 'print') {
      printNodeRef?.current?.setAttribute('data-print-scope', title);
      window.print();
      toast('تم إرسال التقرير للطباعة', 'success');
      return;
    }
    if (rows.length > 5000) {
      toast('جاري التحضير على الخادم…', 'info');
      try {
        const blob = await reportsService.exportReport({ filters, format, report, title });
        downloadBlob(blob, `${title}.${format === 'docx' ? 'docx' : format}`);
        toast('تم تجهيز ملف التصدير', 'success');
        return;
      } catch {
        toast('تعذر تجهيز الملف على الخادم، سيتم استخدام التصدير المحلي.', 'warning');
      }
    }
    await exportClientSide(format, title, rows, columns);
    toast('تم تصدير التقرير', 'success');
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button variant="secondary" size="sm" leadingIcon={<Download size={16} />}>
          تصدير
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item leadingIcon={<Printer size={16} />} onSelect={() => void run('print')}>
          طباعة
        </DropdownMenu.Item>
        <DropdownMenu.Item leadingIcon={<FileSpreadsheet size={16} />} onSelect={() => void run('xlsx')}>
          Excel (.xlsx)
        </DropdownMenu.Item>
        <DropdownMenu.Item leadingIcon={<FileText size={16} />} onSelect={() => void run('docx')}>
          Word (.doc)
        </DropdownMenu.Item>
        <DropdownMenu.Item leadingIcon={<FileText size={16} />} onSelect={() => void run('pdf')}>
          PDF
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
