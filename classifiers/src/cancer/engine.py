# ============================================================
# cancer/engine.py
# ============================================================
# Rule-based cancer risk screening engine.
#
# APPROACH:
#   Each cancer type has a score() function that:
#   1. Assigns weighted risk points based on clinical guidelines
#   2. Returns a score 0-100, risk category, and list of
#      triggered risk factors with their clinical source
#
# SOURCES:
#   Breast  : American Cancer Society + Gail Model risk factors
#             https://www.cancer.org/cancer/breast-cancer/risk-and-prevention
#   Prostate: American Urological Association (AUA) guidelines
#             https://www.auanet.org/guidelines/prostate-cancer
#   Skin    : Skin Cancer Foundation UV/behavioral risk factors
#             https://www.skincancer.org/risk-factors
#   Blood   : American Cancer Society leukemia/lymphoma warning signs
#             https://www.cancer.org/cancer/leukemia
#
# IMPORTANT DISCLAIMER (must be shown in UI):
#   This is a screening awareness tool, NOT a diagnostic system.
#   It identifies people who should discuss screening with a doctor.
#   It cannot detect or diagnose cancer.
# ============================================================

from dataclasses import dataclass, field
from typing      import List, Optional


@dataclass
class RiskFactor:
    """A single triggered risk factor with its clinical rationale."""
    factor:   str    # e.g. "Age > 50"
    points:   int    # contribution to total score
    source:   str    # clinical guideline this comes from
    action:   str    # what the user should do about it


@dataclass
class CancerRiskResult:
    cancer_type:    str
    score:          int            # 0–100
    category:       str            # Low / Medium / High
    triggered:      List[RiskFactor]
    screening_rec:  str            # concrete next step
    eligible_for_screening: bool   # whether standard screening applies


def _category(score: int) -> str:
    if score < 25:  return "Low"
    if score < 55:  return "Medium"
    return "High"


# ------------------------------------------------------------------ #
#  BREAST CANCER  (women only)
# ------------------------------------------------------------------ #
def score_breast(
    age:                    int,
    first_period_age:       Optional[int]  = None,   # menarche age
    first_birth_age:        Optional[int]  = None,   # age at first live birth
    menopause:              bool           = False,
    hrt_use:                bool           = False,   # hormone replacement therapy
    family_history_breast:  bool           = False,   # 1st degree relative
    family_history_ovarian: bool           = False,
    brca_known:             bool           = False,   # known BRCA1/2 mutation
    prior_biopsies:         int            = 0,
    dense_breasts:          bool           = False,
    alcohol_weekly_units:   int            = 0,
    bmi:                    float          = 22.0,
    physical_activity_low:  bool           = False,
) -> CancerRiskResult:
    """
    Gail Model + ACS risk factors for breast cancer.
    Only applicable for women.
    """
    score    = 0
    factors  = []

    # ── Age (biggest independent risk factor) ─────────────────
    if age >= 60:
        score += 30
        factors.append(RiskFactor(
            "Age ≥ 60", 30,
            "ACS: breast cancer risk increases sharply after 60",
            "Annual mammogram recommended"
        ))
    elif age >= 50:
        score += 20
        factors.append(RiskFactor(
            "Age 50–59", 20,
            "ACS: routine screening mammography recommended from age 50",
            "Biennial mammogram recommended (discuss annual with doctor)"
        ))
    elif age >= 40:
        score += 10
        factors.append(RiskFactor(
            "Age 40–49", 10,
            "ACS: women may choose to start annual mammograms at 40",
            "Discuss screening start age with your doctor"
        ))

    # ── Genetics ───────────────────────────────────────────────
    if brca_known:
        score += 35
        factors.append(RiskFactor(
            "Known BRCA1/2 mutation", 35,
            "BRCA1/2 carriers have 50–70% lifetime breast cancer risk",
            "Annual MRI + mammogram from age 25–30; genetic counselling"
        ))
    elif family_history_breast and family_history_ovarian:
        score += 20
        factors.append(RiskFactor(
            "Family history: breast + ovarian cancer", 20,
            "Combined family history suggests possible hereditary syndrome",
            "Refer for genetic counselling and BRCA testing"
        ))
    elif family_history_breast:
        score += 12
        factors.append(RiskFactor(
            "1st-degree relative with breast cancer", 12,
            "Gail Model: doubles relative risk vs no family history",
            "Discuss earlier/more frequent screening with doctor"
        ))

    # ── Reproductive history ───────────────────────────────────
    if first_period_age is not None and first_period_age <= 11:
        score += 5
        factors.append(RiskFactor(
            "Early menarche (≤11)", 5,
            "Gail Model: early menarche increases lifetime oestrogen exposure",
            "Mention to doctor during routine check-up"
        ))

    if first_birth_age is not None and first_birth_age >= 30:
        score += 5
        factors.append(RiskFactor(
            "First birth age ≥ 30 or nulliparous", 5,
            "ACS: later first birth associated with slightly higher risk",
            "Mention to doctor during routine check-up"
        ))

    if menopause and hrt_use:
        score += 8
        factors.append(RiskFactor(
            "Post-menopausal hormone replacement therapy", 8,
            "WHI study: combined HRT increases breast cancer risk by ~26%",
            "Discuss HRT duration and alternatives with your gynaecologist"
        ))

    # ── Medical history ────────────────────────────────────────
    if prior_biopsies >= 2:
        score += 10
        factors.append(RiskFactor(
            "2+ prior breast biopsies", 10,
            "Gail Model: multiple biopsies indicate higher surveillance need",
            "Ensure regular follow-up with your breast specialist"
        ))
    elif prior_biopsies == 1:
        score += 5
        factors.append(RiskFactor(
            "1 prior breast biopsy", 5,
            "Gail Model: prior biopsy increases relative risk",
            "Maintain regular mammogram schedule"
        ))

    if dense_breasts:
        score += 8
        factors.append(RiskFactor(
            "Dense breast tissue (reported on mammogram)", 8,
            "Dense breasts both increase cancer risk and reduce mammogram sensitivity",
            "Ask doctor about supplemental ultrasound or MRI screening"
        ))

    # ── Lifestyle ──────────────────────────────────────────────
    if alcohol_weekly_units >= 14:
        score += 7
        factors.append(RiskFactor(
            "High alcohol consumption (≥14 units/week)", 7,
            "ACS: alcohol is a dose-dependent breast cancer risk factor",
            "Reduce alcohol intake; ACS recommends < 1 drink/day for women"
        ))
    elif alcohol_weekly_units >= 7:
        score += 4
        factors.append(RiskFactor(
            "Moderate alcohol consumption (7–13 units/week)", 4,
            "ACS: even moderate alcohol modestly increases breast cancer risk",
            "Consider reducing alcohol consumption"
        ))

    if bmi >= 30 and menopause:
        score += 6
        factors.append(RiskFactor(
            "Obesity (BMI ≥ 30) after menopause", 6,
            "ACS: post-menopausal obesity increases oestrogen production in fat tissue",
            "Weight management and regular physical activity recommended"
        ))

    if physical_activity_low:
        score += 4
        factors.append(RiskFactor(
            "Low physical activity", 4,
            "ACS: regular exercise reduces breast cancer risk by 10–20%",
            "Aim for 150 min/week moderate activity"
        ))

    score = min(score, 100)

    screening_rec = (
        "Annual mammogram strongly recommended. Consider MRI."
        if score >= 55 else
        "Discuss mammogram schedule with your doctor."
        if score >= 25 else
        "Follow standard screening guidelines (mammogram from age 40–50)."
    )

    return CancerRiskResult(
        cancer_type   = "Breast Cancer",
        score         = score,
        category      = _category(score),
        triggered     = factors,
        screening_rec = screening_rec,
        eligible_for_screening = age >= 40,
    )


# ------------------------------------------------------------------ #
#  PROSTATE CANCER  (men only)
# ------------------------------------------------------------------ #
def score_prostate(
    age:                      int,
    family_history_prostate:  bool  = False,   # 1st degree relative
    family_history_brca2:     bool  = False,   # BRCA2 in family
    race_high_risk:           bool  = False,   # African ancestry
    psa_known:                Optional[float] = None,  # PSA in ng/mL
    prior_prostate_biopsy:    bool  = False,
    urinary_symptoms:         bool  = False,   # hesitancy, frequency, weak stream
    diet_high_red_meat:       bool  = False,
    obesity:                  bool  = False,
) -> CancerRiskResult:
    """
    AUA + American Cancer Society prostate cancer risk factors.
    Only applicable for men.
    """
    score   = 0
    factors = []

    # ── Age ────────────────────────────────────────────────────
    if age >= 70:
        score += 30
        factors.append(RiskFactor(
            "Age ≥ 70", 30,
            "ACS: ~60% of prostate cancers diagnosed in men over 65",
            "Discuss PSA screening with your doctor annually"
        ))
    elif age >= 55:
        score += 20
        factors.append(RiskFactor(
            "Age 55–69", 20,
            "AUA: PSA screening most beneficial for men aged 55–69",
            "PSA test every 1–2 years recommended in this age group"
        ))
    elif age >= 45:
        score += 8
        factors.append(RiskFactor(
            "Age 45–54 with risk factors", 8,
            "ACS: high-risk men should begin screening at 40–45",
            "Discuss early PSA baseline test with your doctor"
        ))

    # ── Genetics & family history ──────────────────────────────
    if family_history_brca2:
        score += 20
        factors.append(RiskFactor(
            "Family history of BRCA2 mutation", 20,
            "BRCA2 carriers have ~8.6× higher prostate cancer risk",
            "PSA screening from age 40; consider genetic testing"
        ))
    elif family_history_prostate:
        score += 15
        factors.append(RiskFactor(
            "1st-degree relative with prostate cancer", 15,
            "ACS: family history doubles or triples risk",
            "Begin PSA screening 10 years earlier than affected relative's diagnosis age"
        ))

    if race_high_risk:
        score += 10
        factors.append(RiskFactor(
            "African ancestry (high-risk group)", 10,
            "ACS: Black men have ~75% higher incidence rate than white men",
            "Discuss earlier and more frequent PSA screening with doctor"
        ))

    # ── PSA level (if known) ───────────────────────────────────
    if psa_known is not None:
        if psa_known >= 10:
            score += 30
            factors.append(RiskFactor(
                f"PSA ≥ 10 ng/mL (value: {psa_known})", 30,
                "AUA: PSA ≥ 10 associated with significant cancer risk",
                "Urgent referral to urologist for biopsy evaluation"
            ))
        elif psa_known >= 4:
            score += 20
            factors.append(RiskFactor(
                f"PSA 4–10 ng/mL (value: {psa_known})", 20,
                "AUA: PSA 4–10 is the 'grey zone' — biopsy often recommended",
                "Refer to urologist; consider repeat PSA and free PSA ratio"
            ))
        elif psa_known >= 2.5:
            score += 10
            factors.append(RiskFactor(
                f"PSA 2.5–4 ng/mL (value: {psa_known})", 10,
                "AUA: elevated PSA warrants monitoring even below 4 threshold",
                "Annual PSA monitoring; discuss with doctor"
            ))

    # ── Symptoms ───────────────────────────────────────────────
    if urinary_symptoms:
        score += 10
        factors.append(RiskFactor(
            "Urinary symptoms (hesitancy / weak stream / frequency)", 10,
            "Common in BPH but can overlap with prostate cancer symptoms",
            "See a urologist for prostate examination and PSA test"
        ))

    # ── Lifestyle ──────────────────────────────────────────────
    if diet_high_red_meat:
        score += 5
        factors.append(RiskFactor(
            "High red/processed meat diet", 5,
            "Some studies link high red meat intake to increased prostate cancer risk",
            "Reduce red meat; increase vegetables and fish"
        ))

    if obesity:
        score += 5
        factors.append(RiskFactor(
            "Obesity (BMI ≥ 30)", 5,
            "Obesity associated with higher-grade prostate cancer",
            "Weight management recommended"
        ))

    score = min(score, 100)

    screening_rec = (
        "PSA test urgently recommended. See a urologist."
        if score >= 55 else
        "Discuss PSA screening timeline with your doctor."
        if score >= 25 else
        "Follow AUA guidelines: discuss PSA screening from age 55."
    )

    return CancerRiskResult(
        cancer_type   = "Prostate Cancer",
        score         = score,
        category      = _category(score),
        triggered     = factors,
        screening_rec = screening_rec,
        eligible_for_screening = age >= 45,
    )


# ------------------------------------------------------------------ #
#  SKIN CANCER  (all genders)
# ------------------------------------------------------------------ #
def score_skin(
    age:                    int,
    skin_type:              int,    # Fitzpatrick 1–6 (1=very fair, 6=very dark)
    uv_exposure_high:       bool = False,  # outdoor work / tanning beds
    sunburn_history:        bool = False,  # blistering sunburns in childhood
    family_history_skin:    bool = False,
    prior_skin_cancer:      bool = False,
    many_moles:             bool = False,  # >50 moles
    immunosuppressed:       bool = False,
    geography_high_uv:      bool = False,  # equatorial / high altitude
) -> CancerRiskResult:
    score   = 0
    factors = []

    # ── Skin type ──────────────────────────────────────────────
    if skin_type <= 2:
        score += 20
        factors.append(RiskFactor(
            "Fair/very fair skin (Fitzpatrick type I–II)", 20,
            "Skin Cancer Foundation: fair skin has lowest melanin protection",
            "Daily SPF 30+ sunscreen; avoid peak UV hours (10am–4pm)"
        ))
    elif skin_type == 3:
        score += 8
        factors.append(RiskFactor(
            "Light-medium skin (Fitzpatrick type III)", 8,
            "Skin Cancer Foundation: moderate UV sensitivity",
            "Regular sunscreen use recommended"
        ))

    # ── UV exposure ────────────────────────────────────────────
    if uv_exposure_high:
        score += 20
        factors.append(RiskFactor(
            "High UV exposure (outdoor work / tanning beds)", 20,
            "WHO: UV radiation is a Group 1 carcinogen; tanning beds increase melanoma risk by 75%",
            "Protective clothing, SPF 50+, avoid tanning beds entirely"
        ))

    if sunburn_history:
        score += 15
        factors.append(RiskFactor(
            "History of blistering sunburns", 15,
            "Skin Cancer Foundation: 5+ blistering sunburns doubles melanoma risk",
            "Annual full-body skin exam by dermatologist"
        ))

    if geography_high_uv:
        score += 8
        factors.append(RiskFactor(
            "Lives in high UV geography (equatorial / high altitude)", 8,
            "UV index is significantly higher near equator and at altitude",
            "Year-round sun protection essential"
        ))

    # ── Medical / genetic ──────────────────────────────────────
    if prior_skin_cancer:
        score += 25
        factors.append(RiskFactor(
            "Personal history of skin cancer", 25,
            "Prior skin cancer is strongest predictor of new lesions",
            "6-monthly dermatologist check-up essential"
        ))

    if family_history_skin:
        score += 10
        factors.append(RiskFactor(
            "Family history of melanoma", 10,
            "1st-degree relative with melanoma increases personal risk ~2×",
            "Annual dermatologist exam; learn ABCDE self-check method"
        ))

    if many_moles:
        score += 12
        factors.append(RiskFactor(
            ">50 moles or atypical moles", 12,
            "Large number of moles increases melanoma risk significantly",
            "Annual full-body skin mapping by dermatologist"
        ))

    if immunosuppressed:
        score += 15
        factors.append(RiskFactor(
            "Immunosuppressed (transplant / HIV / long-term steroids)", 15,
            "Immunosuppression dramatically increases non-melanoma skin cancer risk",
            "Regular dermatology follow-up; discuss with treating physician"
        ))

    # ── Age ────────────────────────────────────────────────────
    if age >= 50:
        score += 8
        factors.append(RiskFactor(
            "Age ≥ 50", 8,
            "Cumulative UV damage increases non-melanoma risk with age",
            "Annual skin check recommended"
        ))

    score = min(score, 100)

    screening_rec = (
        "See a dermatologist immediately for a full-body skin exam."
        if score >= 55 else
        "Annual dermatologist skin check recommended."
        if score >= 25 else
        "Learn ABCDE self-check method; see dermatologist if any mole changes."
    )

    return CancerRiskResult(
        cancer_type   = "Skin Cancer",
        score         = score,
        category      = _category(score),
        triggered     = factors,
        screening_rec = screening_rec,
        eligible_for_screening = True,
    )


# ------------------------------------------------------------------ #
#  BLOOD CANCER (general awareness flags)
# ------------------------------------------------------------------ #
def score_blood(
    age:                      int,
    family_history_blood:     bool = False,
    prior_chemotherapy:       bool = False,
    prior_radiation:          bool = False,
    benzene_exposure:         bool = False,   # occupational
    immunosuppressed:         bool = False,
    persistent_fatigue:       bool = False,   # symptom flag
    unexplained_weight_loss:  bool = False,   # symptom flag
    night_sweats:             bool = False,   # symptom flag
    frequent_infections:      bool = False,   # symptom flag
    easy_bruising_bleeding:   bool = False,   # symptom flag
    swollen_lymph_nodes:      bool = False,   # symptom flag
) -> CancerRiskResult:
    """
    Blood cancer (leukaemia / lymphoma / myeloma) risk flags.
    NOTE: Symptom flags (fatigue, weight loss, etc.) are more
    important here than for other cancers — multiple symptoms
    together warrant urgent medical attention regardless of score.
    """
    score   = 0
    factors = []
    urgent  = False

    # ── Symptoms — multiple together = urgent flag ─────────────
    symptom_count = sum([
        persistent_fatigue, unexplained_weight_loss, night_sweats,
        frequent_infections, easy_bruising_bleeding, swollen_lymph_nodes
    ])

    if symptom_count >= 3:
        score += 40
        urgent = True
        factors.append(RiskFactor(
            f"{symptom_count} persistent symptoms present simultaneously", 40,
            "ACS: combination of fatigue, weight loss, night sweats, infections "
            "are classic B-symptoms warranting urgent haematology review",
            "⚠️ See a doctor urgently — do not wait for a routine appointment"
        ))
    elif symptom_count >= 1:
        score += symptom_count * 10
        sym_names = []
        if persistent_fatigue:       sym_names.append("persistent fatigue")
        if unexplained_weight_loss:  sym_names.append("unexplained weight loss")
        if night_sweats:             sym_names.append("night sweats")
        if frequent_infections:      sym_names.append("frequent infections")
        if easy_bruising_bleeding:   sym_names.append("easy bruising/bleeding")
        if swollen_lymph_nodes:      sym_names.append("swollen lymph nodes")
        factors.append(RiskFactor(
            f"Symptoms: {', '.join(sym_names)}", symptom_count * 10,
            "ACS: these symptoms can indicate blood disorders",
            "Mention these symptoms at your next doctor visit"
        ))

    # ── Prior treatment ────────────────────────────────────────
    if prior_chemotherapy or prior_radiation:
        score += 20
        factors.append(RiskFactor(
            "Prior chemotherapy or radiation treatment", 20,
            "Treatment-related leukaemia is a known late effect of prior cancer therapy",
            "Regular complete blood count (CBC) monitoring recommended"
        ))

    # ── Occupational/environmental ─────────────────────────────
    if benzene_exposure:
        score += 20
        factors.append(RiskFactor(
            "Occupational benzene/chemical exposure", 20,
            "IARC: benzene is a Group 1 carcinogen linked to AML",
            "Occupational health review; regular CBC monitoring"
        ))

    # ── Genetics / immune ──────────────────────────────────────
    if family_history_blood:
        score += 15
        factors.append(RiskFactor(
            "Family history of blood cancer", 15,
            "Some blood cancers (CLL, myeloma) have familial patterns",
            "Inform doctor of family history; baseline CBC recommended"
        ))

    if immunosuppressed:
        score += 10
        factors.append(RiskFactor(
            "Immunosuppressed", 10,
            "Immune dysfunction increases lymphoma risk",
            "Regular haematology monitoring with treating physician"
        ))

    # ── Age ────────────────────────────────────────────────────
    if age >= 60:
        score += 10
        factors.append(RiskFactor(
            "Age ≥ 60", 10,
            "ACS: myeloma and CLL predominantly affect older adults",
            "Annual blood panel (CBC) recommended as routine screening"
        ))

    score = min(score, 100)

    if urgent:
        screening_rec = "⚠️ See a doctor urgently. Multiple symptoms require immediate blood tests."
    elif score >= 55:
        screening_rec = "Request a complete blood count (CBC) from your doctor soon."
    elif score >= 25:
        screening_rec = "Mention your risk factors to your doctor; request baseline CBC."
    else:
        screening_rec = "No immediate action needed. Maintain annual health check-ups."

    return CancerRiskResult(
        cancer_type   = "Blood Cancer",
        score         = score,
        category      = _category(score),
        triggered     = factors,
        screening_rec = screening_rec,
        eligible_for_screening = score >= 25 or urgent,
    )