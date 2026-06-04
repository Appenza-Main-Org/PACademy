/**
 * Realistic Egyptian dictionaries — TIER 2 mock data realism pass.
 * Expanded for evaluator credibility per the realism audit.
 */

export const ARABIC_FIRST_NAMES = [
  'محمد', 'أحمد', 'محمود', 'مصطفى', 'عمر', 'يوسف', 'إبراهيم', 'عبدالله', 'عبدالرحمن',
  'علي', 'حسن', 'حسين', 'خالد', 'طارق', 'وليد', 'هشام', 'أيمن', 'عماد', 'شريف', 'ياسر',
  'كريم', 'سامح', 'أسامة', 'حازم', 'فادي', 'بلال', 'زياد', 'رامي', 'مروان', 'ساري',
  'مازن', 'جمال', 'سعد', 'فتحي', 'عاطف', 'صلاح', 'كمال', 'سيد', 'بدر', 'عبدالناصر',
  'فهمي', 'رمضان', 'سعيد', 'مكاوي', 'بسيوني',
] as const;

/** Egyptian father-name-style middle name (يوسف بن أحمد، أحمد بن محمد). */
export const ARABIC_MIDDLE_NAMES = ARABIC_FIRST_NAMES;

/** Egyptian family / tribal surnames common in Cairo, Delta, Upper Egypt. */
export const ARABIC_LAST_NAMES = [
  'الفقي', 'المصري', 'الأنصاري', 'الخطيب', 'الشربيني', 'الديب', 'البنا', 'الجمل',
  'الزعيم', 'الجوهري', 'الرفاعي', 'الشافعي', 'حافظ', 'رمضان', 'منصور', 'عبدالحليم',
  'شاكر', 'عبدالباقي', 'صبحي', 'فاروق', 'نصر', 'يحيى', 'زكي', 'شعبان', 'عبدالعزيز',
  'سعيد', 'حماده', 'الجندي', 'الأشرف', 'الخولي', 'العشماوي', 'مرزوق', 'القاضي',
  'الكفراوي', 'النحاس', 'الحلبي', 'الشيخ', 'البياضي', 'الدسوقي', 'البدوي', 'القلش',
  'الطنطاوي', 'الششتاوي', 'النواوي', 'النجار', 'الخواجة',
] as const;

/** All 27 Egyptian governorates — exact official Arabic names. */
export const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'الدقهلية', 'الشرقية', 'المنوفية', 'القليوبية',
  'بني سويف', 'الفيوم', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'أسوان', 'البحر الأحمر',
  'الوادي الجديد', 'مرسى مطروح', 'شمال سيناء', 'جنوب سيناء', 'بورسعيد', 'دمياط', 'كفر الشيخ',
  'الغربية', 'الإسماعيلية', 'السويس', 'الأقصر', 'البحيرة',
] as const;

/** Realistic Egyptian governorate population weights (used for distribution). */
export const GOVERNORATE_WEIGHTS: Record<string, number> = {
  'القاهرة': 18, 'الجيزة': 15, 'الإسكندرية': 9, 'الدقهلية': 7, 'الشرقية': 8,
  'المنوفية': 5, 'القليوبية': 6, 'بني سويف': 3, 'الفيوم': 3, 'المنيا': 5,
  'أسيوط': 4, 'سوهاج': 4, 'قنا': 3, 'أسوان': 2, 'البحر الأحمر': 1,
  'الوادي الجديد': 1, 'مرسى مطروح': 1, 'شمال سيناء': 1, 'جنوب سيناء': 1,
  'بورسعيد': 2, 'دمياط': 2, 'كفر الشيخ': 3, 'الغربية': 5, 'الإسماعيلية': 2,
  'السويس': 1, 'الأقصر': 2, 'البحيرة': 5,
};

/** Major Egyptian cities/districts — used for current/permanent address fields. */
export const CITIES = [
  'مدينة نصر', 'المعادي', 'مصر الجديدة', 'الزمالك', 'حلوان', 'شبرا', 'الدقي',
  'المهندسين', 'العجوزة', 'إمبابة', 'فيصل', 'الهرم', 'الحوامدية', 'بدر',
  'العاشر من رمضان', 'السادس من أكتوبر', 'المنصورة', 'طنطا', 'المحلة الكبرى',
  'كفر الدوار', 'دمنهور', 'بنها', 'شبين الكوم', 'الزقازيق', 'الفيوم',
  'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان',
  'الإسماعيلية', 'بورسعيد', 'السويس', 'العريش', 'الغردقة',
] as const;

export const CERTIFICATES = [
  { type: 'ثانوية عامة', section: 'علمي علوم' },
  { type: 'ثانوية عامة', section: 'علمي رياضة' },
  { type: 'ثانوية عامة', section: 'أدبي' },
  { type: 'ثانوية أزهرية', section: 'علمي' },
  { type: 'ثانوية أزهرية', section: 'أدبي' },
] as const;

/** Realistic Egyptian secondary school names. */
export const EGYPTIAN_SCHOOLS = [
  'مدرسة العباسية الثانوية بنين',
  'مدرسة سعيد الثانوية',
  'مدرسة طه حسين الثانوية',
  'مدرسة الزراعة الثانوية ببنها',
  'مدرسة قصر العيني الثانوية',
  'مدرسة الإسكندرية الثانوية',
  'مدرسة المعادي الجديدة الثانوية',
  'مدرسة شبين الكوم الثانوية النموذجية',
  'مدرسة طنطا الثانوية بنين',
  'مدرسة المنصورة الجديدة الثانوية',
  'مدرسة أسيوط الثانوية النموذجية',
  'مدرسة سوهاج الثانوية بنين',
  'معهد القاهرة الثانوي الأزهري',
  'معهد طنطا الديني الثانوي',
  'معهد الإسكندرية الديني الثانوي',
  'مدرسة الزقازيق الثانوية النموذجية',
  'مدرسة بني سويف الثانوية',
  'مدرسة المنيا الثانوية الجديدة',
  'مدرسة قنا الثانوية',
  'مدرسة أسوان الثانوية بنين',
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
  /* Workflow-runtime statuses (post-polish — RFP §3 / §6 pipeline). */
  under_medical_review: { label: 'قيد الكشف الطبي', color: 'info' },
  passed_physical: { label: 'اجتاز اللياقة', color: 'success' },
  failed_interview: { label: 'لم يجتز المقابلة', color: 'danger' },
  awaiting_board_decision: { label: 'بانتظار قرار الهيئة', color: 'warning' },
  /* Applicant-flow milestone statuses — ordered from registration to acquaintance doc. */
  draft: { label: 'مسودة', color: 'neutral' },
  personal_data_completed: { label: 'استكمال البيانات الشخصية', color: 'info' },
  awaiting_payment: { label: 'في انتظار السداد', color: 'warning' },
  fees_paid: { label: 'تم سداد الرسوم', color: 'success' },
  family_data_in_progress: { label: 'بيانات العائلة قيد الإدخال', color: 'info' },
  family_data_approved: { label: 'اعتماد بيانات العائلة', color: 'success' },
  awaiting_exam_booking: { label: 'في انتظار حجز موعد الاختبار', color: 'warning' },
  exam_scheduled: { label: 'تم حجز موعد الاختبار', color: 'info' },
  attendance_card_available: { label: 'بطاقة التردد متاحة', color: 'success' },
  awaiting_exam_result: { label: 'في انتظار نتيجة الاختبار', color: 'warning' },
  suspended: { label: 'موقوف', color: 'danger' },
  acquaintance_doc_opened: { label: 'وثيقة التعارف', color: 'success' },
};
