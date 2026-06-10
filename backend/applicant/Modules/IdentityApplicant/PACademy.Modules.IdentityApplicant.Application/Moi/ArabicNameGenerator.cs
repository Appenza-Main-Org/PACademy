namespace PACademy.Modules.IdentityApplicant.Application.Moi;

/// <summary>
/// Deterministic Egyptian full-name synthesizer for derived (non-directory)
/// MOI identities. Composes a four-part name — first + father + grandfather
/// + family — where each part is drawn independently from a dedicated
/// dataset, so the combination space exceeds 400 million male and 300
/// million female full names (the 50k-row staging dataset stays
/// effectively duplicate-free).
///
/// Selection is weighted three ways per dataset (common 45% / standard 35%
/// / rare 20%) to mimic the real-world frequency skew of Egyptian names
/// without letting the handful of very common names dominate.
///
/// Everything is keyed off the NID through 32-bit FNV-1a, so the same NID
/// always resolves to the same full name across logins and across services.
/// The first name is gender-matched to the NID's gender digit (digit 13,
/// odd = male, even = female) — callers pass the already-derived gender.
///
/// Mirrored in the frontend mock at
/// <c>frontend/src/shared/mock-data/arabic-names.ts</c> (same datasets,
/// same hash, same tier arithmetic) so mock-mode demos and the backend
/// derive identical names for identical NIDs. Keep the two in sync.
/// </summary>
public static class ArabicNameGenerator
{
    /// <summary>
    /// The 12 names the pre-engine <see cref="NidIdentityDeriver"/> pools
    /// could produce. Rows persisted with one of these are derived
    /// placeholders (applicants never typed them — the old derive path is
    /// the only writer of these exact 3-part strings), so the startup
    /// normalizer and any future self-heal may safely regenerate them.
    /// </summary>
    public static readonly IReadOnlySet<string> LegacyPlaceholderNames = new HashSet<string>(StringComparer.Ordinal)
    {
        "محمد إبراهيم سعد",
        "يوسف أحمد محمد",
        "علي حسن طه",
        "عمر مصطفى الشيخ",
        "كريم مجدي عبد الله",
        "محمود فؤاد العقاد",
        "مريم عادل منصور",
        "فاطمة أحمد السيد",
        "نورهان محمود سعيد",
        "سارة عبد الله حسن",
        "هبة علي إبراهيم",
        "ياسمين خالد فؤاد",
    };

    /// <summary>
    /// Gender encoded in a 14-digit NID: digit 13 (the last sequence
    /// digit) is odd for males, even for females. Single home for the
    /// parity rule shared by the derive and normalize flows.
    /// </summary>
    public static string GenderFromNid(string nationalId)
        => (nationalId[12] - '0') % 2 == 0 ? "female" : "male";

    /// <summary>
    /// Builds the deterministic four-part full name for a NID.
    /// <paramref name="gender"/> is <c>"male"</c> or <c>"female"</c> as
    /// derived from the NID gender digit by the caller.
    /// </summary>
    public static string FullNameFor(string nationalId, string gender)
    {
        var firstPool = gender == "female" ? FemaleFirst : MaleFirst;
        var first = Pick(firstPool, Fnv1a(nationalId + "#first"));
        var father = Pick(Paternal, Fnv1a(nationalId + "#father"));
        var grandfather = Pick(Paternal, Fnv1a(nationalId + "#grandfather"));
        if (grandfather == father)
            grandfather = Pick(Paternal, Fnv1a(nationalId + "#grandfather2"));
        var family = Pick(Family, Fnv1a(nationalId + "#family"));
        return $"{first} {father} {grandfather} {family}";
    }

    /// <summary>
    /// Weighted tier pick: low two digits of the seed choose the tier
    /// (0-44 common, 45-79 standard, 80-99 rare), the remaining bits index
    /// uniformly inside the tier. Single-seed, fully deterministic.
    /// </summary>
    private static string Pick(NamePool pool, uint seed)
    {
        var tierRoll = seed % 100u;
        var tier = tierRoll < 45u ? pool.Common : tierRoll < 80u ? pool.Standard : pool.Rare;
        return tier[(int)((seed / 100u) % (uint)tier.Length)];
    }

    /// <summary>32-bit FNV-1a over UTF-16 code units — portable to the TS mirror via Math.imul.</summary>
    private static uint Fnv1a(string s)
    {
        var h = 2166136261u;
        foreach (var c in s)
        {
            h ^= c;
            h = unchecked(h * 16777619u);
        }
        return h;
    }

    private sealed record NamePool(string[] Common, string[] Standard, string[] Rare);

    // ── Datasets ──────────────────────────────────────────────────────────
    // Curated from the QA enhancement request (2026-06) — common / standard /
    // rare tiers reflect contemporary Egyptian naming frequency. Applicant
    // first names skew young (birth cohort ≈ 2004-2008); the paternal pool
    // deliberately includes older-generation names that are no longer given
    // to newborns but are everywhere as fathers/grandfathers.

    private static readonly NamePool MaleFirst = new(
        Common:
        [
            "محمد", "أحمد", "محمود", "مصطفى", "يوسف", "عمر", "علي", "عبد الرحمن",
            "عبد الله", "إبراهيم", "خالد", "كريم", "حسن", "حسين", "عمرو", "طارق",
            "أشرف", "وليد", "أيمن", "هشام", "عبد العزيز", "زياد",
        ],
        Standard:
        [
            "إسماعيل", "ياسين", "عبد المنعم", "عبد الحميد", "شريف", "سامح", "سامي",
            "وائل", "مروان", "معاذ", "معتز", "تامر", "يحيى", "حمزة", "بلال", "أنس",
            "أدهم", "سيف", "سيف الدين", "رامي", "حازم", "هيثم", "شادي", "نادر",
            "مؤمن", "باسم", "فادي", "فؤاد", "حسام", "جمال", "كمال", "علاء", "محسن",
            "ماهر", "مازن", "زكريا", "صلاح", "أسامة", "سعد", "عادل", "عمار", "نبيل",
            "ناصر", "حمدي", "سليمان", "سمير", "هاني", "موسى",
        ],
        Rare:
        [
            "معتصم", "إياد", "بهاء", "جلال", "صبحي", "مدحت", "منير", "زين",
            "زين العابدين", "رجب", "سامر", "مصعب", "عاصم", "عوض", "ناجي", "نصر",
            "فايز", "فيصل", "صابر", "شوقي", "رشاد", "رفعت", "رمضان", "ربيع", "سيد",
            "صهيب", "شهاب", "قاسم", "يونس", "داوود", "رائد", "رفيق", "رأفت", "نواف",
            "جابر", "ثابت", "خليل", "عبد الوهاب", "عبد الستار", "عبد الباسط",
            "عبد الحكيم", "عبد الجليل", "عبد الرؤوف", "عبد الفتاح", "عبد القادر",
            "عبد المولى", "عبد الهادي", "عبد الناصر", "عبد السلام", "مهند", "لؤي",
        ]);

    private static readonly NamePool FemaleFirst = new(
        Common:
        [
            "مريم", "فاطمة", "سارة", "ياسمين", "نورهان", "آية", "ملك", "جنى",
            "سلمى", "حبيبة", "ندى", "منة الله", "إسراء", "أسماء", "شيماء", "هاجر",
            "ريم", "زينب", "شهد", "نور",
        ],
        Standard:
        [
            "رحمة", "نادين", "منة", "دعاء", "بسمة", "هبة", "رنا", "ريهام", "رشا",
            "رضوى", "خديجة", "عائشة", "سمر", "نهى", "إيمان", "أميرة", "أماني",
            "عبير", "داليا", "دنيا", "دينا", "نرمين", "نسرين", "مي", "ميار", "مروة",
            "مها", "يارا", "فرح", "فريدة", "رقية", "شذى", "شروق", "نورا", "تقى",
            "تسنيم", "لوجين", "لين", "لمياء", "ريتاج", "أروى", "أمل",
        ],
        Rare:
        [
            "صفاء", "سناء", "سوسن", "نجلاء", "إلهام", "جيهان", "سلوى", "ميادة",
            "ميارا", "مرام", "ميس", "ميساء", "يمنى", "يسر", "جودي", "جومانا",
            "جنى الله", "سجى", "سندس", "ليان", "لمار", "لميس", "ريتال", "كارما",
            "جوري", "تالا", "تالين", "دانا", "ديما", "أفنان", "أريج", "ولاء",
            "وفاء", "حنان", "ابتسام", "إيناس", "إكرام", "نوال", "نجوى", "كوثر",
            "فردوس",
        ]);

    /// <summary>Father + grandfather dataset — male names only, weighted toward the generations above the applicants.</summary>
    private static readonly NamePool Paternal = new(
        Common:
        [
            "محمد", "أحمد", "محمود", "إبراهيم", "علي", "حسن", "حسين", "مصطفى",
            "السيد", "خالد", "سعيد", "صلاح", "جمال", "كمال", "فتحي", "رمضان",
            "سمير", "سامي", "فؤاد", "أنور", "ماهر", "مجدي", "أيمن", "أشرف",
            "عادل", "عاطف", "صبري", "حمدي",
        ],
        Standard:
        [
            "عبد الله", "عبد الرحمن", "عبد العزيز", "عبد الحميد", "عبد المنعم",
            "عبد الفتاح", "عبد السلام", "عبد اللطيف", "عبد الحليم", "عبد الغني",
            "عبد العال", "عبد التواب", "عبد الرازق", "عبد الجواد", "عبد المقصود",
            "عبد الستار", "عبد الوهاب", "عبد القادر", "عبد الهادي", "عبد الناصر",
            "طارق", "شريف", "وليد", "هشام", "ياسر", "عماد", "عصام", "إيهاب",
            "أكرم", "أسامة", "سامح", "تامر", "وائل", "حازم", "حاتم", "هيثم",
            "نادر", "باسم", "حسام", "علاء", "محسن", "منير", "مازن", "زكريا",
            "رجب", "شعبان", "عاشور", "جمعة", "خميس", "عيد", "رزق", "بخيت",
            "توفيق", "نجيب", "حلمي", "فهمي", "لطفي", "شفيق", "حسني", "فوزي",
            "فاروق", "ممدوح", "صفوت", "عزت", "رفعت", "مدحت", "طلعت", "نشأت",
            "شوقي", "رشاد", "صابر", "سليمان", "سيد", "يونس", "موسى", "داوود",
            "يحيى", "خليل", "سالم", "سلامة",
        ],
        Rare:
        [
            "عثمان", "عمران", "غانم", "غنيم", "حماد", "حمدان", "مرسي", "عوض",
            "عوض الله", "عبد ربه", "جابر", "ثابت", "قاسم", "شهاب", "نصر", "ناجي",
            "نبيل", "فايز", "فيصل", "ربيع", "جلال", "بهاء", "صبحي", "هلال",
            "نوفل", "عبده", "عفيفي", "سرحان", "شلبي", "خاطر", "عامر", "بدوي",
            "زغلول", "أبو بكر", "أبو الفتوح", "أبو المجد", "أبو اليزيد",
            "سيد أحمد", "محمد علي", "أمين", "رؤوف", "رأفت", "رفيق", "رائد",
            "منصور", "مرزوق", "شاكر", "كرم", "مكرم", "نعيم", "فكري", "صدقي",
            "وهبة", "زاهر", "زكي", "غريب", "سعفان", "دسوقي", "قطب", "هريدي",
            "عبد العاطي", "عبد الغفار", "عبد الظاهر", "عبد الصمد", "عبد الدايم",
            "عبد الشافي", "عبد الحفيظ", "عبد العليم", "عبد المعطي", "عبد النبي",
            "عبد الحي",
        ]);

    private static readonly NamePool Family = new(
        Common:
        [
            "السيد", "علي", "حسن", "إبراهيم", "عبد الله", "عبد الرحمن",
            "عبد العزيز", "المصري", "الشافعي", "الدسوقي", "الشرقاوي", "الشريف",
            "النجار", "الحداد", "منصور", "سلامة", "مراد", "كامل", "خليل", "غانم",
            "فهمي", "يونس", "موسى", "عوض", "درويش", "زكي",
        ],
        Standard:
        [
            "فؤاد", "عبد المنعم", "الشاذلي", "البحيري", "المنوفي", "الجيزاوي",
            "البحراوي", "البدري", "القاضي", "الزيات", "صبري", "رضوان",
            "أبو النصر", "أبو زيد", "عبد الغني", "عبد المطلب", "عبد العال",
            "عبد الستار", "عبد الوهاب", "الجندي", "الأنصاري", "الشناوي", "البرعي",
            "الفقي", "السقا", "العطار", "حجازي", "حماد", "أبو العزم", "زهران",
            "أبو طالب", "الطحاوي", "بهجت", "البنا", "فرج", "لطفي", "عبد السلام",
            "شحاتة", "عبد المقصود", "عبد الجواد", "المليجي", "البسيوني",
            "الشربيني", "البكري", "القناوي", "الجمال", "عبد الحميد", "السعيد",
            "قنديل", "رشاد", "علام", "خفاجي",
        ],
        Rare:
        [
            "البهي", "الحسيني", "العدوي", "الصاوي", "الهواري", "الغمراوي",
            "أبو سريع", "السمان", "الخميسي", "الطوخي", "البلتاجي", "الدمرداش",
            "السنهوري", "العقاد", "الباز", "عفيفي", "الغريب", "سرحان", "شلبي",
            "خاطر", "عامر", "بدوي", "هلال", "نوفل", "عبده", "السباعي", "الديب",
            "الخولي", "العشماوي", "مرزوق", "الكفراوي", "النحاس", "الطنطاوي",
            "النواوي", "الخواجة", "الجوهري", "الرفاعي", "أبو حطب", "الششتاوي",
        ]);
}
