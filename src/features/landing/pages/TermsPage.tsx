/**
 * TermsPage — public terms-of-use placeholder.
 * Source: ARCH-04 (public surface footer link).
 */

import { PublicShell } from '@/app/layouts/PublicShell';
import { Card, CardHeader, KhayameyaStripe } from '@/shared/components';

export function TermsPage(): JSX.Element {
  return (
    <PublicShell>
      <article className="mx-auto max-w-content px-6 py-12">
        <header className="mb-8 text-center">
          <h1 className="font-ar-display text-3xl font-bold text-ink-900">شروط الاستخدام</h1>
          <p className="mt-2 text-sm text-ink-500">منظومة قبول أكاديمية الشرطة · وزارة الداخلية</p>
        </header>

        <Card className="mb-6">
          <CardHeader title="١. الالتزامات العامة" />
          <p className="text-sm leading-relaxed text-ink-700">
            باستخدامك هذه المنصّة، فإنّك تُقرّ بأن جميع البيانات التي تُدخلها صحيحة وكاملة، وتتحمّل
            المسؤولية القانونية الكاملة عن أي معلومات مُضلّلة. أيّ استخدام للمنظومة لأغراض غير
            مشروعة يُعرّض المستخدم للمساءلة القانونية وفقاً للتشريعات السارية.
          </p>
        </Card>

        <Card className="mb-6">
          <CardHeader title="٢. حماية البيانات الشخصية" />
          <p className="text-sm leading-relaxed text-ink-700">
            تُعالَج بياناتك وفقاً لسياسة حماية البيانات المُعتمدة من الجهات الرقابية. تُحفَظ
            بياناتك على بنية تحتية حكومية معتمدة، مع تشفير at-rest وaudit log لكل عملية
            وصول. لن تُستخدم بياناتك لأغراض غير المتعلقة بإجراءات القبول.
          </p>
        </Card>

        <Card className="mb-6">
          <CardHeader title="٣. السيادة الرقمية" />
          <p className="text-sm leading-relaxed text-ink-700">
            جميع البيانات المُدخلة في هذه المنظومة تُستضاف داخل البنية التحتية الحكومية
            المصرية ولا تُنقَل خارج حدود الجمهورية. الوصول للبيانات مُقتصر على الجهات
            المخوّلة قانوناً وفق مبدأ الحدّ الأدنى من الصلاحيات.
          </p>
        </Card>

        <Card className="mb-6">
          <CardHeader title="٤. تكامل مع الجهات الحكومية" />
          <p className="text-sm leading-relaxed text-ink-700">
            تتكامل المنظومة مع: منصّة التحقّق الرقمي للحكومة المصرية، وزارة التربية والتعليم،
            الأزهر الشريف، الإدارة العامة للأحوال المدنية، بوابة الدفع الإلكتروني،
            وقطاع الأمن العام. يتم تبادل البيانات وفق بروتوكولات آمنة ومُعتمدة.
          </p>
        </Card>

        <Card>
          <CardHeader title="٥. الدعم والاستفسار" />
          <p className="text-sm leading-relaxed text-ink-700">
            للاستفسار أو الإبلاغ عن أي مشكلة فنية، يُرجى التواصل عبر الخط الساخن
            <span className="mx-2 inline-block font-mono font-bold text-teal-700" dir="ltr">19000</span>
            من الأحد إلى الخميس بين الساعة ٩ صباحاً والساعة ٩ مساءً، أو عبر البريد
            الإلكتروني: <span className="font-mono" dir="ltr">support@police-academy.gov.eg</span>
          </p>
        </Card>

        <div className="mt-8">
          <KhayameyaStripe height="lg" />
        </div>
      </article>
    </PublicShell>
  );
}
