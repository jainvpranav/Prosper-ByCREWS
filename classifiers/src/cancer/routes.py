# ============================================================
# cancer/routes.py
# ============================================================
# FastAPI router for all cancer risk endpoints.
# Mounted in serve.py with prefix /cancer
#
# ENDPOINTS:
#   POST /cancer/breast    (women only)
#   POST /cancer/prostate  (men only)
#   POST /cancer/skin      (all)
#   POST /cancer/blood     (all)
#   POST /cancer/all       (runs all applicable for gender)
# ============================================================

from typing   import Optional, List
from fastapi  import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cancer.engine import (
    score_breast, score_prostate, score_skin, score_blood,
    CancerRiskResult, RiskFactor
)

router = APIRouter(prefix="/cancer", tags=["Cancer Risk"])


# ------------------------------------------------------------------ #
#  Shared response model
# ------------------------------------------------------------------ #
class RiskFactorOut(BaseModel):
    factor:  str
    points:  int
    source:  str
    action:  str

class CancerRiskOut(BaseModel):
    cancer_type:             str
    score:                   int
    category:                str
    triggered_factors:       List[RiskFactorOut]
    screening_recommendation: str
    eligible_for_screening:  bool
    disclaimer:              str = (
        "This is a screening awareness tool only. "
        "It does not diagnose cancer. Always consult a qualified "
        "medical professional for personal health advice."
    )

def _format(result: CancerRiskResult) -> CancerRiskOut:
    return CancerRiskOut(
        cancer_type              = result.cancer_type,
        score                    = result.score,
        category                 = result.category,
        triggered_factors        = [
            RiskFactorOut(
                factor=f.factor, points=f.points,
                source=f.source, action=f.action
            ) for f in result.triggered
        ],
        screening_recommendation = result.screening_rec,
        eligible_for_screening   = result.eligible_for_screening,
    )


# ------------------------------------------------------------------ #
#  Input schemas
# ------------------------------------------------------------------ #
class BreastInput(BaseModel):
    age:                    int   = Field(..., ge=18, le=120)
    first_period_age:       Optional[int]   = Field(None, ge=8,  le=20)
    first_birth_age:        Optional[int]   = Field(None, ge=15, le=60)
    menopause:              bool  = False
    hrt_use:                bool  = False
    family_history_breast:  bool  = False
    family_history_ovarian: bool  = False
    brca_known:             bool  = False
    prior_biopsies:         int   = Field(0, ge=0, le=20)
    dense_breasts:          bool  = False
    alcohol_weekly_units:   int   = Field(0, ge=0, le=100)
    bmi:                    float = Field(22.0, ge=10, le=80)
    physical_activity_low:  bool  = False


class ProstateInput(BaseModel):
    age:                      int   = Field(..., ge=18, le=120)
    family_history_prostate:  bool  = False
    family_history_brca2:     bool  = False
    race_high_risk:           bool  = False
    psa_known:                Optional[float] = Field(None, ge=0, le=100)
    prior_prostate_biopsy:    bool  = False
    urinary_symptoms:         bool  = False
    diet_high_red_meat:       bool  = False
    obesity:                  bool  = False


class SkinInput(BaseModel):
    age:                  int = Field(..., ge=1, le=120)
    skin_type:            int = Field(..., ge=1, le=6,
                              description="Fitzpatrick scale 1=very fair, 6=very dark")
    uv_exposure_high:     bool = False
    sunburn_history:      bool = False
    family_history_skin:  bool = False
    prior_skin_cancer:    bool = False
    many_moles:           bool = False
    immunosuppressed:     bool = False
    geography_high_uv:    bool = False


class BloodInput(BaseModel):
    age:                     int  = Field(..., ge=1, le=120)
    family_history_blood:    bool = False
    prior_chemotherapy:      bool = False
    prior_radiation:         bool = False
    benzene_exposure:        bool = False
    immunosuppressed:        bool = False
    persistent_fatigue:      bool = False
    unexplained_weight_loss: bool = False
    night_sweats:            bool = False
    frequent_infections:     bool = False
    easy_bruising_bleeding:  bool = False
    swollen_lymph_nodes:     bool = False


class AllCancerInput(BaseModel):
    """Runs all applicable cancer checks in one call."""
    gender: str = Field(..., description="'Male' or 'Female'")
    # shared
    age:               int   = Field(..., ge=18, le=120)
    bmi:               float = Field(22.0, ge=10, le=80)
    # skin
    skin_type:         int   = Field(3, ge=1, le=6)
    uv_exposure_high:  bool  = False
    sunburn_history:   bool  = False
    family_history_skin: bool = False
    prior_skin_cancer: bool  = False
    many_moles:        bool  = False
    immunosuppressed:  bool  = False
    geography_high_uv: bool  = False
    # blood
    family_history_blood:    bool = False
    prior_chemotherapy:      bool = False
    prior_radiation:         bool = False
    benzene_exposure:        bool = False
    persistent_fatigue:      bool = False
    unexplained_weight_loss: bool = False
    night_sweats:            bool = False
    frequent_infections:     bool = False
    easy_bruising_bleeding:  bool = False
    swollen_lymph_nodes:     bool = False
    # breast (women)
    family_history_breast:   bool = False
    family_history_ovarian:  bool = False
    brca_known:              bool = False
    menopause:               bool = False
    hrt_use:                 bool = False
    dense_breasts:           bool = False
    alcohol_weekly_units:    int  = 0
    physical_activity_low:   bool = False
    # prostate (men)
    family_history_prostate: bool = False
    family_history_brca2:    bool = False
    race_high_risk:          bool = False
    psa_known:               Optional[float] = None
    urinary_symptoms:        bool = False
    diet_high_red_meat:      bool = False
    obesity:                 bool = False


# ------------------------------------------------------------------ #
#  Routes
# ------------------------------------------------------------------ #
@router.post("/breast", response_model=CancerRiskOut)
def breast_risk(payload: BreastInput):
    """Breast cancer risk assessment (women only)."""
    result = score_breast(**payload.model_dump())
    return _format(result)


@router.post("/prostate", response_model=CancerRiskOut)
def prostate_risk(payload: ProstateInput):
    """Prostate cancer risk assessment (men only)."""
    result = score_prostate(**payload.model_dump())
    return _format(result)


@router.post("/skin", response_model=CancerRiskOut)
def skin_risk(payload: SkinInput):
    """Skin cancer risk assessment (all genders)."""
    result = score_skin(**payload.model_dump())
    return _format(result)


@router.post("/blood", response_model=CancerRiskOut)
def blood_risk(payload: BloodInput):
    """Blood cancer risk awareness flags (all genders)."""
    result = score_blood(**payload.model_dump())
    return _format(result)


@router.post("/all", response_model=List[CancerRiskOut])
def all_cancer_risk(payload: AllCancerInput):
    """
    Runs all applicable cancer checks based on gender.
    Women: breast + skin + blood
    Men:   prostate + skin + blood
    Returns a list of results sorted by score descending.
    """
    if payload.gender not in ("Male", "Female"):
        raise HTTPException(status_code=422,
                            detail="gender must be 'Male' or 'Female'")

    results = []

    # Skin and blood apply to everyone
    results.append(score_skin(
        age=payload.age, skin_type=payload.skin_type,
        uv_exposure_high=payload.uv_exposure_high,
        sunburn_history=payload.sunburn_history,
        family_history_skin=payload.family_history_skin,
        prior_skin_cancer=payload.prior_skin_cancer,
        many_moles=payload.many_moles,
        immunosuppressed=payload.immunosuppressed,
        geography_high_uv=payload.geography_high_uv,
    ))
    results.append(score_blood(
        age=payload.age,
        family_history_blood=payload.family_history_blood,
        prior_chemotherapy=payload.prior_chemotherapy,
        prior_radiation=payload.prior_radiation,
        benzene_exposure=payload.benzene_exposure,
        immunosuppressed=payload.immunosuppressed,
        persistent_fatigue=payload.persistent_fatigue,
        unexplained_weight_loss=payload.unexplained_weight_loss,
        night_sweats=payload.night_sweats,
        frequent_infections=payload.frequent_infections,
        easy_bruising_bleeding=payload.easy_bruising_bleeding,
        swollen_lymph_nodes=payload.swollen_lymph_nodes,
    ))

    if payload.gender == "Female":
        results.append(score_breast(
            age=payload.age, bmi=payload.bmi,
            family_history_breast=payload.family_history_breast,
            family_history_ovarian=payload.family_history_ovarian,
            brca_known=payload.brca_known,
            menopause=payload.menopause, hrt_use=payload.hrt_use,
            dense_breasts=payload.dense_breasts,
            alcohol_weekly_units=payload.alcohol_weekly_units,
            physical_activity_low=payload.physical_activity_low,
        ))
    else:
        results.append(score_prostate(
            age=payload.age,
            family_history_prostate=payload.family_history_prostate,
            family_history_brca2=payload.family_history_brca2,
            race_high_risk=payload.race_high_risk,
            psa_known=payload.psa_known,
            urinary_symptoms=payload.urinary_symptoms,
            diet_high_red_meat=payload.diet_high_red_meat,
            obesity=payload.obesity,
        ))

    results.sort(key=lambda r: r.score, reverse=True)
    return [_format(r) for r in results]