export const ARABIC_FIRST_NAMES = [
  'محمد', 'أحمد', 'محمود', 'مصطفى', 'عمر', 'يوسف', 'إبراهيم', 'عبدالله', 'عبدالرحمن',
  'علي', 'حسن', 'حسين', 'خالد', 'طارق', 'وليد', 'هشام', 'أيمن', 'عماد', 'شريف', 'ياسر',
  'كريم', 'سامح', 'أسامة', 'حازم', 'فادي', 'بلال', 'زياد', 'رامي', 'مروان', 'ساري',
] as const;

export const ARABIC_LAST_NAMES = [
  'محمد علي', 'حسن إبراهيم', 'عبدالعزيز', 'الشربيني', 'الفقي', 'المصري', 'الأنصاري',
  'الخطيب', 'حافظ', 'رمضان', 'منصور', 'عبدالحليم', 'شاكر', 'عبدالباقي', 'رفاعي', 'الديب',
  'البنا', 'الجمل', 'الزعيم', 'الجوهري', 'صبحي', 'فاروق', 'نصر', 'يحيى', 'زكي', 'شعبان',
] as const;

export const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'المنوفية', 'القليوبية',
  'بني سويف', 'الفيوم', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'أسوان', 'البحر الأحمر',
  'الوادي الجديد', 'مرسى مطروح', 'شمال سيناء', 'جنوب سيناء', 'بورسعيد', 'دمياط', 'كفر الشيخ',
  'الغربية', 'الإسماعيلية', 'السويس', 'الأقصر', 'البحيرة',
] as const;

export const CITIES = [
  'مدينة نصر', 'المعادي', 'مصر الجديدة', 'الزمالك', 'حلوان', 'شبرا',
] as const;

export const CERTIFICATES = [
  { type: 'ثانوية عامة', section: 'علمي علوم' },
  { type: 'ثانوية عامة', section: 'علمي رياضة' },
  { type: 'ثانوية عامة', section: 'أدبي' },
  { type: 'ثانوية أزهرية', section: 'علمي' },
  { type: 'ثانوية أزهرية', section: 'أدبي' },
] as const;

export const STATUSES = [
  'pending',
  'under-review',
  'approved',
  'rejected',
  'on-hold',
  'documents-required',
] as const;

export const STAGE_LABELS = [
  'تسجيل أولي',
  'دفع رسوم',
  'بيانات الأسرة',
  'بيانات الأقارب',
  'موعد اختبار',
  'كارت تردد',
  'القومسيون الطبي',
  'اختبار اللياقة',
  'المقابلة الشخصية',
  'الاختبار النهائي',
  'النتيجة',
] as const;

export const COMMITTEES_NAMES = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'] as const;

export const QUESTION_CATEGORIES = [
  'ثقافة عامة',
  'لغة عربية',
  'لغة إنجليزية',
  'رياضيات',
  'منطق',
  'تاريخ مصر',
  'جغرافيا',
] as const;

export const AUDIT_ACTIONS = [
  { action: 'create', label: 'إدراج', color: 'success' },
  { action: 'update', label: 'تعديل', color: 'info' },
  { action: 'delete', label: 'حذف', color: 'danger' },
  { action: 'view', label: 'استعلام', color: 'neutral' },
  { action: 'login', label: 'تسجيل دخول', color: 'neutral' },
  { action: 'export', label: 'تصدير', color: 'warning' },
] as const;

export const STATUS_LABELS: Record<string, { label: string; color: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  pending: { label: 'في الانتظار', color: 'neutral' },
  'under-review': { label: 'قيد المراجعة', color: 'warning' },
  approved: { label: 'مقبول', color: 'success' },
  rejected: { label: 'مرفوض', color: 'danger' },
  'on-hold': { label: 'موقوف', color: 'warning' },
  'documents-required': { label: 'مستندات ناقصة', color: 'info' },
};
