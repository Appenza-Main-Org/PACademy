/**
 * Barcode card configuration (US-BC-008/009/010) — College System
 * Administrator surface, gated by `barcode:config`. Three config-driven
 * sections (format / content / layout) with a live card preview. The
 * preview renders through the shared Code128Barcode regardless of the
 * chosen symbology (mock renderer is linear Code 128).
 */

import { useMemo, useState } from 'react';
import { Save, ScanBarcode, Settings2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Code128Barcode,
  KhayameyaStripe,
  LoadingState,
  PageHeader,
  Select,
  Switch,
  Tabs,
  toast,
} from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, maskNationalId, num } from '@/shared/lib/format';
import { useBarcodeConfig, useUpdateBarcodeConfigMutation } from '../api/barcode.queries';
import {
  BARCODE_LABEL_SIZES,
  BARCODE_SYMBOLOGIES,
  LAYOUT_ORIENTATIONS,
  PRINTER_TYPES,
  labelSizeByCode,
  printableFields,
  type BarcodeConfig,
} from '../lib/barcodeConfig';

const MODULE_WIDTHS = ['1', '1.2', '1.4', '1.6', '2'] as const;
const HEIGHTS = ['40', '48', '56', '72', '88'] as const;

export function BarcodeConfigPage(): JSX.Element {
  const { data, isLoading } = useBarcodeConfig();
  const saveMut = useUpdateBarcodeConfigMutation();
  const [draft, setDraft] = useState<BarcodeConfig | null>(null);

  /* Seed the editable draft from server state on first arrival. Adjusting
   * state during render (with a guard) is the React-endorsed alternative to
   * a syncing useEffect — no data fetching happens here. */
  if (data && !draft) {
    setDraft({ format: { ...data.format }, content: data.content.map((f) => ({ ...f })), layout: { ...data.layout } });
  }

  const dirty = useMemo(
    () => Boolean(data && draft && JSON.stringify(data) !== JSON.stringify(draft)),
    [data, draft],
  );

  if (isLoading || !draft) {
    return (
      <>
        <PageHeader title="إعدادات الباركود" subtitle="ضبط شكل ومحتوى وتخطيط كارت التردد" />
        <LoadingState variant="detail" />
      </>
    );
  }

  const setFormat = (patch: Partial<BarcodeConfig['format']>): void =>
    setDraft((d) => (d ? { ...d, format: { ...d.format, ...patch } } : d));
  const setLayout = (patch: Partial<BarcodeConfig['layout']>): void =>
    setDraft((d) => (d ? { ...d, layout: { ...d.layout, ...patch } } : d));
  const setField = (key: string, patch: Partial<BarcodeConfig['content'][number]>): void =>
    setDraft((d) => (d ? { ...d, content: d.content.map((f) => (f.key === key ? { ...f, ...patch } : f)) } : d));

  const handleSave = (): void => {
    saveMut.mutate(draft, {
      onSuccess: () => toast('تم حفظ إعدادات الباركود', 'success'),
      onError: () => toast('تعذّر حفظ الإعدادات', 'danger'),
    });
  };

  return (
    <>
      <PageHeader
        title="إعدادات الباركود"
        subtitle="ضبط شكل ومحتوى وتخطيط كارت التردد · متاح لمدير نظام الكلية فقط"
        actions={
          <Button variant="primary" leadingIcon={<Save size={14} strokeWidth={1.75} />} disabled={!dirty} isLoading={saveMut.isPending} onClick={handleSave}>
            حفظ الإعدادات
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="الإعدادات" subtitle="اختر القسم لضبط الخيارات" actions={<Badge tone="accent" icon={<Settings2 size={11} strokeWidth={1.75} />}>قابل للتهيئة</Badge>} />
          <CardBody>
            <Tabs defaultValue="format">
              <Tabs.List>
                <Tabs.Tab value="format">الشكل والصيغة</Tabs.Tab>
                <Tabs.Tab value="content">المحتوى والحقول</Tabs.Tab>
                <Tabs.Tab value="layout">تخطيط الطباعة</Tabs.Tab>
              </Tabs.List>

              {/* Format (US-BC-008) */}
              <Tabs.Panel value="format">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="صيغة الباركود"
                    value={draft.format.symbology}
                    onChange={(e) => setFormat({ symbology: e.target.value as BarcodeConfig['format']['symbology'] })}
                    options={BARCODE_SYMBOLOGIES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                  <Select
                    label="عرض الوحدة (px)"
                    value={String(draft.format.moduleWidth)}
                    onChange={(e) => setFormat({ moduleWidth: Number(e.target.value) })}
                    options={MODULE_WIDTHS.map((w) => ({ value: w, label: w }))}
                  />
                  <Select
                    label="ارتفاع الرمز (px)"
                    value={String(draft.format.heightPx)}
                    onChange={(e) => setFormat({ heightPx: Number(e.target.value) })}
                    options={HEIGHTS.map((h) => ({ value: h, label: h }))}
                  />
                  <div className="flex items-end pb-1">
                    <Switch label="إظهار الكود النصي أسفل الرمز" checked={draft.format.showText} onCheckedChange={(v) => setFormat({ showText: v })} />
                  </div>
                </div>
              </Tabs.Panel>

              {/* Content (US-BC-009) */}
              <Tabs.Panel value="content">
                <p className="mb-3 text-2xs text-ink-500">
                  حدّد الحقول الظاهرة على الكارت. الحقول المعلّمة «مخفي إدارياً» تُحفظ في النظام ولا تُطبع على الكارت إطلاقاً.
                </p>
                <div className="flex flex-col gap-2">
                  {draft.content.map((f) => (
                    <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-ink-50 px-3 py-2.5">
                      <span className="text-sm font-medium text-ink-900">{f.labelAr}</span>
                      <div className="flex items-center gap-4">
                        <Switch
                          label="ظاهر على الكارت"
                          checked={f.visible && !f.adminHidden}
                          disabled={f.adminHidden}
                          onCheckedChange={(v) => setField(f.key, { visible: v })}
                        />
                        <Switch
                          label="مخفي إدارياً"
                          checked={f.adminHidden}
                          onCheckedChange={(v) => setField(f.key, { adminHidden: v, ...(v ? { visible: false } : {}) })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Tabs.Panel>

              {/* Layout (US-BC-010) */}
              <Tabs.Panel value="layout">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select
                    label="اتجاه الكارت"
                    value={draft.layout.orientation}
                    onChange={(e) => setLayout({ orientation: e.target.value as BarcodeConfig['layout']['orientation'] })}
                    options={LAYOUT_ORIENTATIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                  <Select
                    label="نوع الطابعة"
                    value={draft.layout.printerType}
                    onChange={(e) => setLayout({ printerType: e.target.value as BarcodeConfig['layout']['printerType'] })}
                    options={PRINTER_TYPES.map((p) => ({ value: p.value, label: p.label }))}
                  />
                  <Select
                    label="مقاس الملصق"
                    value={draft.layout.labelSizeCode}
                    onChange={(e) => setLayout({ labelSizeCode: e.target.value })}
                    options={BARCODE_LABEL_SIZES.map((s) => ({ value: s.code, label: s.labelAr }))}
                    containerClassName="sm:col-span-2"
                  />
                </div>
              </Tabs.Panel>
            </Tabs>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="معاينة حيّة" subtitle="انعكاس فوري لإعدادات الكارت" actions={<Badge tone="info" icon={<ScanBarcode size={11} strokeWidth={1.75} />}>Code 128</Badge>} />
          <CardBody>
            <ConfigPreview config={draft} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/** Live card preview reflecting the draft config. */
function ConfigPreview({ config }: { config: BarcodeConfig }): JSX.Element {
  const applicant = MOCK.applicants[0]!;
  const fields = printableFields(config);
  const size = labelSizeByCode(config.layout.labelSizeCode);
  const sampleCode = '26-CAI-00001234';

  const valueFor = (key: string): string => {
    switch (key) {
      case 'name': return applicant.name;
      case 'applicantId': return applicant.id;
      case 'nationalId': return maskNationalId(applicant.nationalId);
      case 'governorate': return applicant.governorate;
      case 'committee': return `لجنة ${applicant.committee}`;
      case 'category': return 'قسم الضباط (قسم عام)';
      case 'qualification': return applicant.certType;
      case 'validUntil': return `صالح حتى ${fmtDate(Date.now() + 90 * 86_400_000, 'short')}`;
      default: return '';
    }
  };

  const showPhoto = fields.some((f) => f.key === 'photo');
  const textFields = fields.filter((f) => f.key !== 'photo');

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="overflow-hidden rounded-lg border bg-white shadow-md"
        style={{ borderColor: 'var(--accent-500)', borderWidth: 2, width: '100%', maxWidth: 340 }}
      >
        <div className="px-3 py-2 text-white" style={{ background: 'var(--accent-700)' }}>
          <p className="font-ar-display text-xs font-bold">أكاديمية الشرطة · منظومة القبول</p>
        </div>

        <div className={config.layout.orientation === 'horizontal' ? 'flex items-center gap-3 p-3' : 'flex flex-col gap-3 p-3'}>
          <div className="flex items-center gap-3">
            {showPhoto && (
              <div className="flex h-16 w-14 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-ink-300 bg-ink-50 text-2xs text-ink-500">صورة</div>
            )}
            <div className="flex flex-col gap-0.5 text-2xs">
              {textFields.length === 0 ? (
                <span className="text-ink-400">لا توجد حقول ظاهرة</span>
              ) : (
                textFields.map((f) => (
                  <span key={f.key}>
                    <span className="text-ink-500">{f.labelAr}: </span>
                    <span className="font-medium text-ink-900">{valueFor(f.key)}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center gap-1">
            <Code128Barcode value={sampleCode} height={config.format.heightPx} moduleWidth={config.format.moduleWidth} showText={config.format.showText} />
          </div>
        </div>

        <KhayameyaStripe height="sm" />
      </div>

      <p className="text-2xs text-ink-500">
        {PRINTER_TYPES.find((p) => p.value === config.layout.printerType)?.label}
        {size ? ` · ${size.labelAr} (${num(size.widthMm)}×${num(size.heightMm)} مم)` : ''}
      </p>
    </div>
  );
}
