/** Centralised UI strings for backend-integration error states (FR-007, FR-008). */

export const strings = {
  ar: {
    superAdminFloorBlocked: {
      title: 'لا يمكن تعطيل الحساب',
      description: 'يجب أن يبقى مدير نظام رئيسي واحد على الأقل نشطاً.',
      acknowledge: 'حسناً',
    },
    bulkImportInProgress: {
      title: 'جارٍ استيراد الملف',
      description: 'يتم معالجة الملف. قد تستغرق العملية بضع دقائق للملفات الكبيرة.',
    },
    bulkImportPartialSuccess: {
      title: 'اكتمل الاستيراد جزئياً',
      description:
        'تم استيراد {{successCount}} صف بنجاح. فشل {{failCount}} صف — راجع تقرير الأخطاء.',
      download: 'تحميل تقرير الأخطاء',
    },
    bulkImportRowCapExceeded: {
      title: 'تجاوز الحد الأقصى للصفوف',
      description: 'يتجاوز الملف الحد الأقصى البالغ {{maxRows}} صف. يرجى تقسيم الملف.',
      acknowledge: 'حسناً',
    },
    nationalIdLoginInvalidFormat: {
      title: 'رقم قومي غير صحيح',
      description: 'يجب أن يتكوّن الرقم القومي من 14 رقماً بالضبط.',
    },
    backendDown: {
      title: 'الخدمة غير متاحة مؤقتاً',
      description: 'تعذّر الوصول إلى الخادم. يرجى المحاولة مجدداً بعد قليل.',
      retry: 'إعادة المحاولة',
    },
    conflictRejected: {
      title: 'تعارض في البيانات',
      description: 'تم تعديل هذا السجل من طرف آخر. يرجى تحديث الصفحة والمحاولة مجدداً.',
      refresh: 'تحديث',
    },
    sessionExpired: {
      title: 'انتهت الجلسة',
      description: 'انتهت صلاحية جلستك. يرجى تسجيل الدخول مجدداً.',
      login: 'تسجيل الدخول',
    },
    genericError: {
      title: 'حدث خطأ',
      description: 'حدث خطأ غير متوقع. يرجى المحاولة مجدداً.',
      retry: 'إعادة المحاولة',
    },
  },
  en: {
    superAdminFloorBlocked: {
      title: 'Cannot deactivate account',
      description: 'At least one active super-admin must remain.',
      acknowledge: 'OK',
    },
    bulkImportInProgress: {
      title: 'Import in progress',
      description: 'The file is being processed. Large files may take a few minutes.',
    },
    bulkImportPartialSuccess: {
      title: 'Import partially completed',
      description:
        '{{successCount}} rows imported successfully. {{failCount}} rows failed — see the error report.',
      download: 'Download error report',
    },
    bulkImportRowCapExceeded: {
      title: 'Row limit exceeded',
      description:
        'The file exceeds the maximum of {{maxRows}} rows. Please split the file.',
      acknowledge: 'OK',
    },
    nationalIdLoginInvalidFormat: {
      title: 'Invalid national ID',
      description: 'The national ID must be exactly 14 digits.',
    },
    backendDown: {
      title: 'Service temporarily unavailable',
      description: 'Could not reach the server. Please try again shortly.',
      retry: 'Retry',
    },
    conflictRejected: {
      title: 'Data conflict',
      description: 'This record was modified by someone else. Refresh the page and try again.',
      refresh: 'Refresh',
    },
    sessionExpired: {
      title: 'Session expired',
      description: 'Your session has expired. Please sign in again.',
      login: 'Sign in',
    },
    genericError: {
      title: 'An error occurred',
      description: 'An unexpected error occurred. Please try again.',
      retry: 'Retry',
    },
  },
} as const;

export type Locale = keyof typeof strings;

/** Returns strings for the current locale (defaults to Arabic). */
export function useStrings(locale: Locale = 'ar') {
  return strings[locale];
}
