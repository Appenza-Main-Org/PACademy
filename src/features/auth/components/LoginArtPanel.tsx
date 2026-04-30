import { Shield } from 'lucide-react';

export function LoginArtPanel(): JSX.Element {
  return (
    <div className="login-art">
      <div className="login-art-brand">
        <div className="brand-logo">
          <Shield size={18} strokeWidth={2.2} />
        </div>
        <div className="brand-text">
          <span>منظومة القبول</span>
          <span>أكاديمية الشرطة</span>
        </div>
      </div>

      <div className="login-art-content">
        <h1>التحول الرقمي الكامل لإجراءات القبول والاختبارات</h1>
        <p>
          منظومة معلوماتية متكاملة تربط ٩ تطبيقات على مستوى الإنترنت والشبكة الداخلية،
          بمستوى أمان وتشفير معتمد، لإدارة كامل دورة المتقدم بدقة وشفافية.
        </p>

        <div className="login-art-stats">
          <div>
            <div className="login-art-stat-value">9</div>
            <div className="login-art-stat-label">تطبيقات مترابطة</div>
          </div>
          <div>
            <div className="login-art-stat-value">12K+</div>
            <div className="login-art-stat-label">متقدم سنوياً</div>
          </div>
          <div>
            <div className="login-art-stat-value">100%</div>
            <div className="login-art-stat-label">رقمنة الإجراءات</div>
          </div>
        </div>
      </div>

      <div className="login-art-foot">© 2026 وزارة الداخلية · أكاديمية الشرطة · جميع الحقوق محفوظة</div>
    </div>
  );
}
