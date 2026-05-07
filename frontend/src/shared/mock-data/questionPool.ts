/**
 * Shared question pool — single source of truth for MCQs displayed on
 * /question-bank and exposed via the bank-CRUD/exam pipeline.
 *
 * Both `MOCK.questions` (legacy `Question` shape) in index.ts and
 * `BANK_QUESTIONS` (richer `BankQuestion` shape) in sprint3to9.ts derive
 * from this pool, so the public categories overview, the filterable list,
 * and the CRUD/exam screens all show coherent counts and content.
 *
 * Categories match the 5-category taxonomy used by BANK_QUESTIONS:
 *   قدرات لفظية · قدرات عددية · منطق · سرعة بديهة · ثقافة عامة
 *
 * Each category carries 10 items (50 total) authored in Egyptian-Arabic
 * MSA, balanced across difficulty (سهل / متوسط / صعب).
 */

export interface PoolQuestion {
  category: 'قدرات لفظية' | 'قدرات عددية' | 'منطق' | 'سرعة بديهة' | 'ثقافة عامة';
  difficultyLabel: 'سهل' | 'متوسط' | 'صعب';
  text: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

export const QUESTION_POOL: PoolQuestion[] = [
  /* ── قدرات لفظية ─────────────────────────────────────────── */
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'سهل',
    text: 'ما مرادف كلمة "همّة"؟',
    options: ['عزيمة', 'كسل', 'همس', 'هَمْسة'],
    correctIndex: 0,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'سهل',
    text: 'ما ضدّ كلمة "سخاء"؟',
    options: ['كرم', 'بخل', 'جود', 'عطاء'],
    correctIndex: 1,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'سهل',
    text: 'ما ضدّ كلمة "سرّ"؟',
    options: ['خفاء', 'علن', 'كتمان', 'همس'],
    correctIndex: 1,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'متوسط',
    text: 'ما الكلمة الشاذّة عن المجموعة؟',
    options: ['شمس', 'قمر', 'كوكب', 'مدينة'],
    correctIndex: 3,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'متوسط',
    text: 'ما جمع كلمة "قانون"؟',
    options: ['قوانين', 'أقوان', 'قنون', 'قاوينات'],
    correctIndex: 0,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'متوسط',
    text: 'أكمل: "إنّ المجاهد ... يصدع بالحقّ ولا يخشى لومة لائم."',
    options: ['الجبان', 'المتردّد', 'الشجاع', 'الصامت'],
    correctIndex: 2,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'متوسط',
    text: 'ما المعنى الأقرب لتعبير "يُمعن النظر"؟',
    options: ['يُسرع النظر', 'يدقّق ويتأمّل', 'يُغلق عينيه', 'ينظر بعجلة'],
    correctIndex: 1,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'متوسط',
    text: 'معنى عبارة "يحمل على عاتقه" هو:',
    options: ['يتحمّل المسؤوليّة', 'يحمل على كتفه ثقلاً ماديّاً', 'يتذمّر من الواجب', 'يتجاهل المهمّة'],
    correctIndex: 0,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'صعب',
    text: 'اختر الجملة الصحيحة نحويّاً:',
    options: [
      'حضر الطلابُ المتفوّقون',
      'حضر الطلابَ المتفوّقين',
      'حضر الطلابُ المتفوّقين',
      'حضر الطلابِ المتفوّقون',
    ],
    correctIndex: 0,
  },
  {
    category: 'قدرات لفظية',
    difficultyLabel: 'صعب',
    text: 'ما إعراب كلمة "الوطنُ" في جملة "الوطنُ غالٍ"؟',
    options: ['مبتدأ مرفوع', 'خبر مرفوع', 'فاعل مرفوع', 'مفعول به منصوب'],
    correctIndex: 0,
  },

  /* ── قدرات عددية ─────────────────────────────────────────── */
  {
    category: 'قدرات عددية',
    difficultyLabel: 'سهل',
    text: 'إذا كان 7 × س = 91، فإنّ س =',
    options: ['11', '12', '13', '14'],
    correctIndex: 2,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'سهل',
    text: 'كم تساوي 25% من 480؟',
    options: ['100', '110', '120', '130'],
    correctIndex: 2,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'سهل',
    text: 'ما مساحة مستطيل طوله 12 وعرضه 7؟',
    options: ['76', '84', '90', '96'],
    correctIndex: 1,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'متوسط',
    text: 'أكمل المتتالية: 2، 5، 10، 17، 26، ...',
    options: ['33', '35', '37', '38'],
    correctIndex: 2,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'متوسط',
    text: 'قطع متدرّب 12 كم في ساعة ونصف. ما متوسّط سرعته بالكم/ساعة؟',
    options: ['6', '8', '9', '10'],
    correctIndex: 1,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'متوسط',
    text: 'ما مجموع الأعداد الزوجيّة من 2 إلى 20 (بالشمول)؟',
    options: ['90', '100', '110', '120'],
    correctIndex: 2,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'متوسط',
    text: 'عمر أحمد ثلاثة أمثال عمر أخيه، ومجموع عمريهما 24 سنة. كم عمر أحمد؟',
    options: ['16', '18', '20', '22'],
    correctIndex: 1,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'متوسط',
    text: 'محيط دائرة قطرها 10 سم تقريباً (π ≈ 3.14):',
    options: ['15.7 سم', '31.4 سم', '62.8 سم', '78.5 سم'],
    correctIndex: 1,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'صعب',
    text: 'ما ناتج: 8 + 4 ÷ 2 × 3 − 2 ؟',
    options: ['12', '14', '16', '18'],
    correctIndex: 0,
  },
  {
    category: 'قدرات عددية',
    difficultyLabel: 'صعب',
    text: 'اشترى تاجر بضاعة بـ 800 جنيه وباعها بـ 920 جنيهاً. ما نسبة الربح؟',
    options: ['10%', '12%', '15%', '20%'],
    correctIndex: 2,
  },

  /* ── منطق ────────────────────────────────────────────────── */
  {
    category: 'منطق',
    difficultyLabel: 'سهل',
    text: 'كلّ المحقّقين فطنون. عليّ محقّق. إذًا:',
    options: ['عليّ ليس فطناً', 'عليّ فطن', 'لا يمكن التحديد', 'بعض المحقّقين فقط فطنون'],
    correctIndex: 1,
  },
  {
    category: 'منطق',
    difficultyLabel: 'سهل',
    text: 'إذا كان "أ" أكبر من "ب"، و"ب" أكبر من "ج"، فإنّ "أ" بالنسبة لـ"ج":',
    options: ['أكبر', 'أصغر', 'مساوٍ', 'لا يمكن تحديده'],
    correctIndex: 0,
  },
  {
    category: 'منطق',
    difficultyLabel: 'متوسط',
    text: 'أيّ المتتاليات الآتية تكسر النمط؟',
    options: ['1، 2، 4، 8، 16', '3، 6، 9، 12', '2، 4، 6، 7، 10', '5، 10، 15، 20'],
    correctIndex: 2,
  },
  {
    category: 'منطق',
    difficultyLabel: 'متوسط',
    text: 'أكمل العلاقة: قلم : كاتب :: ميزان : ___',
    options: ['قاضٍ', 'تاجر', 'حارس', 'محقّق'],
    correctIndex: 1,
  },
  {
    category: 'منطق',
    difficultyLabel: 'متوسط',
    text: 'كلّ الموظّفين منضبطون. سامي ليس منضبطاً. ما الاستنتاج الصحيح؟',
    options: [
      'سامي موظّف غير ملتزم',
      'سامي ليس موظّفاً',
      'بعض الموظّفين غير منضبطين',
      'لا يمكن الاستنتاج'
    ],
    correctIndex: 1,
  },
  {
    category: 'منطق',
    difficultyLabel: 'متوسط',
    text: 'في غرفة 5 أشخاص، صافح كلٌّ منهم الآخر مرّةً واحدة. كم مصافحةً تمّت؟',
    options: ['8', '10', '12', '20'],
    correctIndex: 1,
  },
  {
    category: 'منطق',
    difficultyLabel: 'متوسط',
    text: 'سار شخص شمالاً 4 خطوات، ثم شرقاً 3 خطوات. ما المسافة المباشرة عن نقطة البداية؟',
    options: ['4 خطوات', '5 خطوات', '6 خطوات', '7 خطوات'],
    correctIndex: 1,
  },
  {
    category: 'منطق',
    difficultyLabel: 'صعب',
    text: 'إذا كانت "كلّ الجواسيس يكذبون" صحيحة، فالعبارة "بعض من يكذبون جواسيس" تكون:',
    options: [
      'صحيحة بالضرورة',
      'خاطئة بالضرورة',
      'محتملة وليست بالضرورة',
      'لا علاقة لها بالأولى'
    ],
    correctIndex: 2,
  },
  {
    category: 'منطق',
    difficultyLabel: 'صعب',
    text: 'قال محقّق: "إن لم يكن المتّهم في المكان فلديه دليل غياب." لا يوجد دليل غياب. إذًا:',
    options: ['كان في المكان', 'لم يكن في المكان', 'لا يمكن الاستنتاج', 'البيان غير منطقي'],
    correctIndex: 0,
  },
  {
    category: 'منطق',
    difficultyLabel: 'صعب',
    text: 'لو قال جنديٌّ صادقٌ "أنا أكذب"، فإنّ القول:',
    options: ['متناقض ذاتيّاً', 'صادق', 'كاذب', 'لا يحمل معنىً'],
    correctIndex: 0,
  },

  /* ── سرعة بديهة ──────────────────────────────────────────── */
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'سهل',
    text: 'كم شهراً في السنة يحتوي على 28 يوماً على الأقل؟',
    options: ['شهر واحد', 'شهران', 'سبعة أشهر', 'كلّ الشهور'],
    correctIndex: 3,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'سهل',
    text: 'ما الذي يكبر كلّما أخذنا منه؟',
    options: ['الكنز', 'الحفرة', 'الميزان', 'الكتاب'],
    correctIndex: 1,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'سهل',
    text: 'كم لاعباً من فريقٍ واحد على أرض ملعب كرة القدم وقت اللعب؟',
    options: ['9', '10', '11', '12'],
    correctIndex: 2,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'متوسط',
    text: 'والد سامي له ثلاثة أبناء: محمّد، وأحمد، ومن الثالث؟',
    options: ['عليّ', 'حسن', 'سامي', 'لا يمكن تحديده'],
    correctIndex: 2,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'متوسط',
    text: 'إذا قسمتَ 30 على نصف ثمّ أضفت 10، فما الناتج؟',
    options: ['25', '40', '70', '20'],
    correctIndex: 2,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'متوسط',
    text: 'كم مرّة يمكنك طرح الرقم 5 من الرقم 25؟',
    options: ['مرّة واحدة', 'مرّتان', 'ثلاث مرّات', 'خمس مرّات'],
    correctIndex: 0,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'متوسط',
    text: 'شجرة عليها 10 طيور، أطلق صيّاد طلقةً وأصاب طائراً. كم طائراً بقي على الشجرة؟',
    options: ['9', '10', '0', 'لا يمكن التحديد'],
    correctIndex: 2,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'متوسط',
    text: 'ساعة معطّلة (لا تعمل). كم مرّةً تكون عقاربها صحيحة في اليوم الواحد؟',
    options: ['صفر', 'مرّة', 'مرّتان', 'أربع مرّات'],
    correctIndex: 2,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'صعب',
    text: 'أبٌ وابنه عمراهما معاً 50 سنة، وعمر الأب أربعة أمثال عمر الابن. كم عمر الابن؟',
    options: ['8', '10', '12', '15'],
    correctIndex: 1,
  },
  {
    category: 'سرعة بديهة',
    difficultyLabel: 'صعب',
    text: 'ما الذي ينكسر بمجرّد ذكر اسمه؟',
    options: ['الزجاج', 'الصمت', 'الوعد', 'العهد'],
    correctIndex: 1,
  },

  /* ── ثقافة عامة ──────────────────────────────────────────── */
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'سهل',
    text: 'ما عاصمة جمهوريّة مصر العربيّة؟',
    options: ['الإسكندريّة', 'القاهرة', 'الجيزة', 'أسوان'],
    correctIndex: 1,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'سهل',
    text: 'ما أطول نهر في العالم؟',
    options: ['نهر الأمازون', 'نهر النيل', 'نهر اليانغتسي', 'نهر المسيسبي'],
    correctIndex: 1,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'سهل',
    text: 'العملة الرسميّة لجمهوريّة مصر العربيّة هي:',
    options: ['الجنيه المصري', 'الدينار', 'الدرهم', 'الريال'],
    correctIndex: 0,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'سهل',
    text: 'ما تاريخ الاحتفال بعيد الشرطة المصريّة سنويّاً؟',
    options: ['23 يوليو', '6 أكتوبر', '25 يناير', '18 يونيو'],
    correctIndex: 2,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'سهل',
    text: 'في أيّ عام قامت ثورة 23 يوليو في مصر؟',
    options: ['1948', '1950', '1952', '1956'],
    correctIndex: 2,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'متوسط',
    text: 'ألوان علم جمهوريّة مصر العربيّة من أعلى إلى أسفل هي:',
    options: ['أخضر، أبيض، أسود', 'أحمر، أبيض، أسود', 'أحمر، أبيض، أخضر', 'أسود، أبيض، أحمر'],
    correctIndex: 1,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'متوسط',
    text: 'في أيّ محافظة يقع مقرّ كليّة الشرطة (أكاديميّة الشرطة)؟',
    options: ['الإسكندريّة', 'القاهرة', 'الجيزة', 'القليوبيّة'],
    correctIndex: 1,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'متوسط',
    text: 'في أيّ مدينة يقع المقرّ الرئيسيّ لمنظّمة الأمم المتّحدة؟',
    options: ['جنيف', 'نيويورك', 'باريس', 'فيينا'],
    correctIndex: 1,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'متوسط',
    text: 'في أيّ محافظة مصريّة تقع قمّة جبل كاترين، أعلى قمّة في مصر؟',
    options: ['البحر الأحمر', 'جنوب سيناء', 'مرسى مطروح', 'أسوان'],
    correctIndex: 1,
  },
  {
    category: 'ثقافة عامة',
    difficultyLabel: 'صعب',
    text: 'وفقاً للدستور المصريّ الصادر عام 2014، نظام الحكم في مصر هو:',
    options: ['ملكيّ دستوريّ', 'جمهوريّ ديمقراطيّ', 'فيدراليّ', 'برلمانيّ بحت'],
    correctIndex: 1,
  },
];
