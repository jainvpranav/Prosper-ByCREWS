'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { FloatingChat } from '@/components/FloatingChat';
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, CheckCircle2, User, Activity, Heart, Dna, MapPin, Scale, Cigarette, Pill, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AnimatePresence, motion } from 'framer-motion';
import type { FullProfile } from '@/lib/profileService';
import type { RiskAssessment } from '@/lib/riskAssessmentService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Gender = 'Male' | 'Female';

/**
 * 17 questions total:
 *   Q1–Q4   Core (everyone)
 *   Q5–Q9   Heart health (everyone)
 *   Q10–Q14 Cancer shared (everyone)
 *   F_Q15–F_Q17  Female only
 *   M_Q15–M_Q17  Male only
 */
type QuestionId =
  | 'Q1' | 'Q2' | 'Q_CITY' | 'Q3' | 'Q4'
  | 'Q5' | 'Q6' | 'Q7' | 'Q8' | 'Q9'
  | 'Q10' | 'Q11' | 'Q12' | 'Q13' | 'Q14'
  | 'F_Q15' | 'F_Q16' | 'F_Q17'
  | 'M_Q15' | 'M_Q16' | 'M_Q17';

interface Answers {
  // Core
  gender?: Gender;
  age?: number;
  city?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  skin_type?: number;

  // Cardiovascular /predict
  smoker?: 0 | 1;
  cigsperday?: number | null;
  hypertension?: 0 | 1;
  bp_medication?: 0 | 1;
  diabetes?: 0 | 1;
  prev_stroke?: 0 | 1;
  bpKnowledge?: 'yes' | 'no' | 'unknown';
  systolic_bp?: number | null;
  diastolic_bp?: number | null;
  cholesterol?: number | null;
  glucose?: number | null;
  resting_hr?: number | null;

  // Cancer shared
  // Q10 — sun/skin (3 toggles)
  uv_exposure_high?: boolean;
  sunburn_history?: boolean;
  geography_high_uv?: boolean;

  // Q11 — family history multi-select
  family_history_breast?: boolean;
  family_history_ovarian?: boolean;
  family_history_prostate?: boolean;
  family_history_skin?: boolean;
  family_history_blood?: boolean;
  family_history_brca2?: boolean;

  // Q12 — prior medical multi-select
  prior_chemotherapy?: boolean;
  prior_radiation?: boolean;
  prior_skin_cancer?: boolean;
  immunosuppressed?: boolean;

  // Q13 — blood symptoms set 1
  persistent_fatigue?: boolean;
  unexplained_weight_loss?: boolean;
  night_sweats?: boolean;

  // Q14 — blood symptoms set 2
  frequent_infections?: boolean;
  easy_bruising_bleeding?: boolean;
  swollen_lymph_nodes?: boolean;

  // Female only (F_Q15–F_Q17)
  brca_known?: boolean;
  menopauseChoice?: 'yes' | 'no' | 'not_sure';
  menopause?: boolean;
  hrt_use?: boolean;
  alcohol_weekly_units?: number;
  physical_activity_low?: boolean;
  activityChoice?: 'active' | 'somewhat' | 'low' | 'sedentary';

  // Male only (M_Q15–M_Q17)
  race_high_risk?: boolean;
  urinary_symptoms?: boolean;
  diet_high_red_meat?: boolean;
  psaChoice?: 'yes' | 'no' | 'never';
  psa_known?: number | null;
  obesity?: boolean;
  // alcohol_weekly_units and physical_activity_low shared — defined above
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FIRST_QUESTION: QuestionId = 'Q1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function computeBmi(heightCm?: number, weightKg?: number): number | undefined {
  if (!heightCm || !weightKg) return undefined;
  const hM = heightCm / 100;
  const bmi = weightKg / (hM * hM);
  if (!Number.isFinite(bmi)) return undefined;
  return parseFloat(bmi.toFixed(1));
}

// ---------------------------------------------------------------------------
// Navigation tree — lean 17-question flow
// ---------------------------------------------------------------------------
function getNextQuestionId(current: QuestionId, a: Answers): QuestionId | null {
  switch (current) {
    // Core
    case 'Q1': return 'Q2';
    case 'Q2': return 'Q_CITY';
    case 'Q_CITY': return 'Q3';
    case 'Q3': return 'Q4';
    case 'Q4': return 'Q5';

    // Heart
    case 'Q5': return 'Q6';
    case 'Q6': return 'Q7';
    case 'Q7': return 'Q8';
    case 'Q8': return 'Q9';
    case 'Q9': return 'Q10';

    // Cancer shared
    case 'Q10': return 'Q11';
    case 'Q11': return 'Q12';
    case 'Q12': return 'Q13';
    case 'Q13': return 'Q14';

    // Gender split
    case 'Q14':
      if (a.gender === 'Female') return 'F_Q15';
      if (a.gender === 'Male')   return 'M_Q15';
      return null;

    // Female path
    case 'F_Q15': return 'F_Q16';
    case 'F_Q16': return 'F_Q17';
    case 'F_Q17': return null;

    // Male path
    case 'M_Q15': return 'M_Q16';
    case 'M_Q16': return 'M_Q17';
    case 'M_Q17': return null;

    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const forceAssess = searchParams.get('mode') === 'assess';

  // ── Profile view state ────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [profileData, setProfileData] = useState<FullProfile | null>(null);
  const [assessmentData, setAssessmentData] = useState<RiskAssessment | null>(null);

  // ── Questionnaire state ───────────────────────────────────
  const [answers, setAnswers] = useState<Answers>({});
  const [currentQuestion, setCurrentQuestion] = useState<QuestionId>(FIRST_QUESTION);
  const [history, setHistory] = useState<QuestionId[]>([FIRST_QUESTION]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cardioResult, setCardioResult] = useState<any | null>(null);
  const [cancerResults, setCancerResults] = useState<any[] | null>(null);

  // ── Load profile data on mount ────────────────────────────
  useEffect(() => {
    if (!user) { setIsLoading(false); setIsAssessmentOpen(true); return; }

    async function loadProfile() {
      try {
        const [profileRes, assessmentRes] = await Promise.all([
          fetch(`/api/profile?userId=${user!.userId}`),
          fetch(`/api/risk-assessment?userId=${user!.userId}`),
        ]);

        let pDataRaw = null;
        if (profileRes.ok) {
          pDataRaw = await profileRes.json();
          setProfileData(pDataRaw.profile ?? null);
        }
        if (assessmentRes.ok) {
          const aData = await assessmentRes.json();
          setAssessmentData(aData.assessment ?? null);
        }

        if (!pDataRaw?.profile || forceAssess) {
          setIsAssessmentOpen(true);
        }
      } catch {
        setIsAssessmentOpen(true);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, [user, forceAssess]);

  // Total questions: 14 shared + 3 gender-specific + 1 location
  const totalQuestions = 18;

  const currentIndex = useMemo(
    () => history.findIndex((q) => q === currentQuestion) + 1,
    [history, currentQuestion],
  );

  // ── Answer updater with derived field logic ────────────
  const updateAnswers = (patch: Partial<Answers>) => {
    setAnswers((prev) => {
      const merged: Answers = { ...prev, ...patch };

      // BMI + obesity auto-derive
      if (patch.heightCm !== undefined || patch.weightKg !== undefined) {
        const bmi = computeBmi(
          patch.heightCm ?? prev.heightCm,
          patch.weightKg ?? prev.weightKg,
        );
        if (bmi !== undefined) {
          merged.bmi = bmi;
          merged.obesity = bmi >= 30;
        }
      }

      // obesity re-check if gender changes after BMI set
      if (patch.gender !== undefined && merged.bmi !== undefined) {
        merged.obesity = merged.bmi >= 30;
      }

      // BP nulls when not known
      if (patch.bpKnowledge !== undefined && patch.bpKnowledge !== 'yes') {
        merged.systolic_bp  = null;
        merged.diastolic_bp = null;
      }

      // Menopause → hrt_use
      if (patch.menopauseChoice !== undefined) {
        merged.menopause = patch.menopauseChoice === 'yes';
        if (patch.menopauseChoice !== 'yes') merged.hrt_use = false;
      }

      // Activity choice → boolean
      if (patch.activityChoice !== undefined) {
        merged.physical_activity_low =
          patch.activityChoice === 'low' || patch.activityChoice === 'sedentary';
      }

      return merged;
    });
  };

  // ── Navigation ─────────────────────────────────────────
  const handleNext = async () => {
    const next = getNextQuestionId(currentQuestion, answers);
    if (!next) {
      await handleSubmit();
      return;
    }
    setSubmitError(null);
    setHistory((prev) => {
      const idx = prev.findIndex((q) => q === currentQuestion);
      const trimmed = idx >= 0 ? prev.slice(0, idx + 1) : prev;
      return [...trimmed, next];
    });
    setCurrentQuestion(next);
  };

  const handlePrevious = () => {
    if (history.length <= 1) return;
    setSubmitError(null);
    setHistory((prev) => {
      const nextHistory = prev.slice(0, -1);
      setCurrentQuestion(nextHistory[nextHistory.length - 1]);
      return nextHistory;
    });
  };

  // ── Submit ─────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!answers.gender || !answers.age || !answers.bmi || !answers.skin_type) {
      setSubmitError('Please complete the required questions first.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setCardioResult(null);
    setCancerResults(null);

    try {
      const cardioPayload = {
        age:          answers.age,
        gender:       answers.gender,
        bmi:          answers.bmi,
        smoker:       answers.smoker ?? 0,
        cigsperday:   answers.smoker === 1 ? (answers.cigsperday ?? 0) : 0,
        hypertension: answers.hypertension ?? 0,
        bp_medication:
          answers.hypertension === 1 ? (answers.bp_medication ?? 0) : 0,
        diabetes:     answers.diabetes ?? 0,
        prev_stroke:  answers.prev_stroke ?? 0,
        systolic_bp:  answers.systolic_bp   ?? null,
        diastolic_bp: answers.diastolic_bp  ?? null,
        cholesterol:  answers.cholesterol   ?? null,
        glucose:      answers.glucose       ?? null,
        resting_hr:   answers.resting_hr    ?? null,
      };

      const isFemale = answers.gender === 'Female';
      const isMale   = answers.gender === 'Male';

      const cancerPayload = {
        gender:      answers.gender,
        age:         answers.age,
        bmi:         answers.bmi,
        skin_type:   answers.skin_type,

        // Q10
        uv_exposure_high:  !!answers.uv_exposure_high,
        sunburn_history:   !!answers.sunburn_history,
        geography_high_uv: !!answers.geography_high_uv,

        // Q11 — family history (gender-gated at payload)
        family_history_breast:   isFemale ? !!answers.family_history_breast   : false,
        family_history_ovarian:  isFemale ? !!answers.family_history_ovarian  : false,
        family_history_prostate: isMale   ? !!answers.family_history_prostate : false,
        family_history_skin:     !!answers.family_history_skin,
        family_history_blood:    !!answers.family_history_blood,
        family_history_brca2:    isMale   ? !!answers.family_history_brca2    : false,

        // Q12 — prior medical
        prior_chemotherapy: !!answers.prior_chemotherapy,
        prior_radiation:    !!answers.prior_radiation,
        prior_skin_cancer:  !!answers.prior_skin_cancer,
        immunosuppressed:   !!answers.immunosuppressed,

        // Q13
        persistent_fatigue:      !!answers.persistent_fatigue,
        unexplained_weight_loss: !!answers.unexplained_weight_loss,
        night_sweats:            !!answers.night_sweats,

        // Q14
        frequent_infections:     !!answers.frequent_infections,
        easy_bruising_bleeding:  !!answers.easy_bruising_bleeding,
        swollen_lymph_nodes:     !!answers.swollen_lymph_nodes,

        // Female only
        brca_known:           isFemale ? !!answers.brca_known  : false,
        menopause:            isFemale ? !!answers.menopause   : false,
        hrt_use:              isFemale ? !!answers.hrt_use     : false,
        alcohol_weekly_units: answers.alcohol_weekly_units ?? 0,
        physical_activity_low: !!answers.physical_activity_low,

        // Male only
        race_high_risk:        isMale ? !!answers.race_high_risk      : false,
        urinary_symptoms:      isMale ? !!answers.urinary_symptoms     : false,
        diet_high_red_meat:    isMale ? !!answers.diet_high_red_meat   : false,
        obesity:               isMale ? !!answers.obesity              : false,
        psa_known:
          isMale
            ? answers.psaChoice === 'yes'
              ? (answers.psa_known ?? null)
              : null
            : null,
      };

      const [cardioRes, cancerRes] = await Promise.all([
        fetch('/api/predict', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(cardioPayload),
        }),
        fetch('/api/cancer/all', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(cancerPayload),
        }),
      ]);

      if (!cardioRes.ok) {
        const body = await cardioRes.text();
        throw new Error(`Cardiovascular API error: ${body || cardioRes.status}`);
      }
      if (!cancerRes.ok) {
        const body = await cancerRes.text();
        throw new Error(`Cancer API error: ${body || cancerRes.status}`);
      }

      const cardioData = await cardioRes.json();
      const cancerData = await cancerRes.json();

      setCardioResult(cardioData);
      setCancerResults(Array.isArray(cancerData) ? cancerData : []);

      // ── Persist questionnaire answers + risk assessment to the database ───
      if (user?.userId) {
        // Save questionnaire answers (user_profiles Q3/Q4 + health_questionnaire Q5–Q17)
        try {
          await fetch('/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.userId,
              // Required ProfileInput defaults (not collected in this flow)
              age: answers.age ?? null,
              gender: answers.gender ?? '',
              activityLevel: answers.activityChoice ?? '',
              city: answers.city ?? '',
              familyHistory: [],
              smoking: answers.smoker === 1 ? 'Current' : 'Never',
              alcohol: '',
              sleep: '',
              foodPreference: '',
              dietQuality: '',
              medications: '',
              allergies: '',
              conditions: '',
              lastCheckup: '',
              // Q3 / Q4 — physical & skin
              heightCm: answers.heightCm ?? null,
              weightKg: answers.weightKg ?? null,
              bmi: answers.bmi ?? null,
              skinType: answers.skin_type ?? null,
              // Q5–Q9 — heart health
              smoker: answers.smoker ?? null,
              cigsperday: answers.cigsperday ?? null,
              hypertension: answers.hypertension ?? null,
              bpMedication: answers.bp_medication ?? null,
              diabetes: answers.diabetes ?? null,
              prevStroke: answers.prev_stroke ?? null,
              bpKnowledge: answers.bpKnowledge ?? null,
              systolicBp: answers.systolic_bp ?? null,
              diastolicBp: answers.diastolic_bp ?? null,
              cholesterol: answers.cholesterol ?? null,
              glucose: answers.glucose ?? null,
              restingHr: answers.resting_hr ?? null,
              // Q10–Q14 — cancer shared
              uvExposureHigh: !!answers.uv_exposure_high,
              sunburnHistory: !!answers.sunburn_history,
              geographyHighUv: !!answers.geography_high_uv,
              familyHistoryBreast: !!answers.family_history_breast,
              familyHistoryOvarian: !!answers.family_history_ovarian,
              familyHistoryProstate: !!answers.family_history_prostate,
              familyHistorySkin: !!answers.family_history_skin,
              familyHistoryBlood: !!answers.family_history_blood,
              familyHistoryBrca2: !!answers.family_history_brca2,
              priorChemotherapy: !!answers.prior_chemotherapy,
              priorRadiation: !!answers.prior_radiation,
              priorSkinCancer: !!answers.prior_skin_cancer,
              immunosuppressed: !!answers.immunosuppressed,
              persistentFatigue: !!answers.persistent_fatigue,
              unexplainedWeightLoss: !!answers.unexplained_weight_loss,
              nightSweats: !!answers.night_sweats,
              frequentInfections: !!answers.frequent_infections,
              easyBruisingBleeding: !!answers.easy_bruising_bleeding,
              swollenLymphNodes: !!answers.swollen_lymph_nodes,
              // Female only
              brcaKnown: answers.brca_known ?? null,
              menopause: answers.menopause ?? null,
              hrtUse: answers.hrt_use ?? null,
              // Male only
              raceHighRisk: answers.race_high_risk ?? null,
              urinarySymptoms: answers.urinary_symptoms ?? null,
              dietHighRedMeat: answers.diet_high_red_meat ?? null,
              psaKnown: answers.psa_known ?? null,
              // Shared lifestyle
              alcoholWeeklyUnits: answers.alcohol_weekly_units ?? null,
              activityChoice: answers.activityChoice ?? null,
              // Derived
              physicalActivityLow: answers.physical_activity_low ?? null,
              obesity: answers.obesity ?? null,
            }),
          });
        } catch (profileDbErr) {
          console.error('[Onboarding] Failed to save profile/questionnaire to DB:', profileDbErr);
        }

        // Derive missing assessment fields
        const riskScore = Math.round((cardioData.risk_score ?? cardioData.risk_probability ?? 0) * 100);
        
        const hasAnyFamilyHistory = answers.family_history_breast || answers.family_history_ovarian || 
          answers.family_history_prostate || answers.family_history_skin || answers.family_history_blood || answers.family_history_brca2;
        const geneticDisposition = hasAnyFamilyHistory ? 'Moderate' : 'Low';
        
        const activityLevel = answers.activityChoice ?? 'somewhat';
        const lifestyleImpact = answers.smoker === 1 ? 'Critical' :
          activityLevel === 'sedentary' ? 'Critical' :
          activityLevel === 'low' ? 'Moderate' : 'Low';

        const medicalHistoryRisk = (answers.hypertension || answers.diabetes || answers.prev_stroke) ? 'Moderate' : 'Low Risk';

        const topFactors = (cardioData.top_factors ?? []).slice(0, 4).map((f: any) => ({
          factorName: f.feature.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          contributionPct: Math.min(Math.round(Math.abs(f.impact) * 100), 100),
        }));

        const projections = Array.from({ length: 7 }, (_, i) => ({
          monthOffset: i,
          predictedScore: Math.max(Math.round(riskScore * (1 - i * 0.06)), 10),
          baselineScore: riskScore,
        }));

        // Save risk assessment result
        try {
          await fetch('/api/risk-assessment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.userId,
              overallRiskScore: riskScore,
              geneticDisposition,
              lifestyleImpact,
              medicalHistoryRisk,
              riskFactors: topFactors.length > 0 ? topFactors : [
                { factorName: 'Age', contributionPct: 30 },
                { factorName: 'Family History', contributionPct: 25 },
                { factorName: 'Lifestyle', contributionPct: 25 },
                { factorName: 'Vitals', contributionPct: 20 },
              ],
              projections,
              aiInsightSummary:
                `Cardiovascular risk: ${cardioData.risk_band ?? cardioData.risk_category ?? 'Unknown'} (${riskScore}%). ` +
                `Cancer assessments completed for ${(Array.isArray(cancerData) ? cancerData : []).map((c: any) => c.cancer_type).join(', ')}.`,
              cardioResult: cardioData,
              cancerResults: Array.isArray(cancerData) ? cancerData : [],
            }),
          });
        } catch (dbErr) {
          console.error('[Onboarding] Failed to save risk assessment to DB:', dbErr);
        }
      }

      // Persist results for the dashboard to consume
      sessionStorage.setItem(
        'prosper_ml_results',
        JSON.stringify({ cardio: cardioData, cancer: Array.isArray(cancerData) ? cancerData : [] }),
      );

      setSubmitted(true);
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err: any) {
      console.error('[Onboarding submit]', err);
      setSubmitError(err.message ?? 'Failed to submit assessment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Disable-next logic ─────────────────────────────────
  const isNextDisabled = (): boolean => {
    switch (currentQuestion) {
      // Core
      case 'Q1': return !answers.gender;
      case 'Q2': return !answers.age;
      case 'Q_CITY': return !answers.city || answers.city.trim().length === 0;
      case 'Q3': return !answers.heightCm || !answers.weightKg;
      case 'Q4': return !answers.skin_type;

      // Heart
      case 'Q5': return answers.smoker === undefined;
      case 'Q6': return answers.hypertension === undefined;
      case 'Q7': return answers.diabetes === undefined || answers.prev_stroke === undefined;
      case 'Q8':
        if (!answers.bpKnowledge) return true;
        if (answers.bpKnowledge === 'yes')
          return !answers.systolic_bp || !answers.diastolic_bp;
        return false;
      case 'Q9': return false; // all optional

      // Cancer shared — all multi-select, always continuable
      case 'Q10': return false;
      case 'Q11': return false;
      case 'Q12': return false;
      case 'Q13': return false;
      case 'Q14': return false;

      // Female
      case 'F_Q15': return answers.brca_known === undefined;
      case 'F_Q16': return answers.menopauseChoice === undefined;
      case 'F_Q17':
        return answers.alcohol_weekly_units === undefined || !answers.activityChoice;

      // Male
      case 'M_Q15': return false; // three toggles, all optional booleans
      case 'M_Q16':
        if (!answers.psaChoice) return true;
        if (answers.psaChoice === 'yes')
          return answers.psa_known === undefined || answers.psa_known === null;
        return false;
      case 'M_Q17':
        return answers.alcohol_weekly_units === undefined || !answers.activityChoice;

      default: return false;
    }
  };

  const isLastQuestion = getNextQuestionId(currentQuestion, answers) === null;

  // ── Section label for progress bar ─────────────────────
  const sectionLabel = (): string => {
    if (['Q1','Q2','Q_CITY','Q3','Q4'].includes(currentQuestion))                              return 'Core';
    if (['Q5','Q6','Q7','Q8','Q9'].includes(currentQuestion))                         return 'Heart Health';
    if (['Q10','Q11','Q12','Q13','Q14'].includes(currentQuestion))                    return 'Cancer Risk';
    if (['F_Q15','F_Q16','F_Q17'].includes(currentQuestion))                          return 'Breast Health';
    if (['M_Q15','M_Q16','M_Q17'].includes(currentQuestion))                          return 'Prostate Health';
    return '';
  };

  // ── Header ─────────────────────────────────────────────
  const renderHeader = () => (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Prosper Health Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Answer a few questions so we can run your cardiovascular and cancer risk checks.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{sectionLabel()}</span>
          <span>{currentIndex} / {totalQuestions}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(currentIndex / totalQuestions) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );

  // ── Reusable Yes/No button row ──────────────────────────
  const YesNo = ({
    value,
    onYes,
    onNo,
  }: {
    value?: boolean;
    onYes: () => void;
    onNo: () => void;
  }) => (
    <div className="grid grid-cols-2 gap-3 mt-4">
      {[{ l: 'Yes', fn: onYes, v: true }, { l: 'No', fn: onNo, v: false }].map((opt) => (
        <button
          key={opt.l}
          type="button"
          onClick={opt.fn}
          className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
            value === opt.v
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {opt.l}
        </button>
      ))}
    </div>
  );

  // ── Checkbox item ───────────────────────────────────────
  const CheckItem = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label className="flex items-center gap-3 p-3 border border-border rounded-xl hover:bg-muted cursor-pointer text-sm">
      <input
        type="checkbox"
        className="w-4 h-4 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );

  // ── Question renderer ───────────────────────────────────
  const renderQuestion = () => {
    switch (currentQuestion) {

      // ──────────────────────────────────────────────────
      // SECTION 1 — CORE  (Q1–Q4)
      // ──────────────────────────────────────────────────
      case 'Q1':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q1. What is your biological sex?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This is used to choose the right cancer risk rules for you.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(['Male', 'Female'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => updateAnswers({ gender: g })}
                  className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    answers.gender === g
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </>
        );

      case 'Q2':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q2. How old are you?</h2>
            <input
              type="number"
              min={1}
              max={120}
              value={answers.age ?? ''}
              onChange={(e) =>
                updateAnswers({ age: e.target.value ? Number(e.target.value) : undefined })
              }
              className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Age in years"
            />
          </>
        );

      case 'Q_CITY':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q2.5. Which city do you live in?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Knowing your location helps us contextualize environmental and regional factors.
            </p>
            <input
              type="text"
              value={answers.city ?? ''}
              onChange={(e) => updateAnswers({ city: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && answers.city?.trim()) handleNext();
              }}
              className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. London"
            />
          </>
        );

      case 'Q3':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q3. What is your height and weight?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              We calculate your Body Mass Index (BMI) from this.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min={80}
                  max={250}
                  value={answers.heightCm ?? ''}
                  onChange={(e) =>
                    updateAnswers({ heightCm: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. 170"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={answers.weightKg ?? ''}
                  onChange={(e) =>
                    updateAnswers({ weightKg: e.target.value ? Number(e.target.value) : undefined })
                  }
                  className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. 70"
                />
              </div>
            </div>
            {answers.bmi && (
              <p className="text-xs text-muted-foreground">
                Calculated BMI:{' '}
                <span className="font-semibold text-foreground">{answers.bmi}</span>
                {answers.bmi >= 30 ? ' · Obese' : answers.bmi >= 25 ? ' · Overweight' : ' · Normal'}
              </p>
            )}
          </>
        );

      case 'Q4':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q4. What is your skin tone?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Fitzpatrick scale — used to assess UV sensitivity for skin cancer risk.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { v: 1, label: '1 Very fair' },
                { v: 2, label: '2 Fair' },
                { v: 3, label: '3 Medium' },
                { v: 4, label: '4 Olive' },
                { v: 5, label: '5 Brown' },
                { v: 6, label: '6 Dark' },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => updateAnswers({ skin_type: opt.v })}
                  className={`py-2 px-2 rounded-xl border-2 text-[11px] font-medium transition-all ${
                    answers.skin_type === opt.v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        );

      // ──────────────────────────────────────────────────
      // SECTION 2 — HEART HEALTH  (Q5–Q9)
      // ──────────────────────────────────────────────────
      case 'Q5':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q5. Do you currently smoke cigarettes?</h2>
            <YesNo
              value={answers.smoker === undefined ? undefined : answers.smoker === 1}
              onYes={() => updateAnswers({ smoker: 1 })}
              onNo={() => updateAnswers({ smoker: 0, cigsperday: 0 })}
            />
            {/* Inline cigarettes/day sub-input */}
            {answers.smoker === 1 && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  How many cigarettes per day on average?
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={answers.cigsperday ?? ''}
                  onChange={(e) =>
                    updateAnswers({ cigsperday: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. 10"
                />
              </div>
            )}
          </>
        );

      case 'Q6':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q6. Has a doctor ever told you that you have high blood pressure?
            </h2>
            <YesNo
              value={answers.hypertension === undefined ? undefined : answers.hypertension === 1}
              onYes={() => updateAnswers({ hypertension: 1 })}
              onNo={() => updateAnswers({ hypertension: 0, bp_medication: 0 })}
            />
            {/* Inline BP medication sub-toggle */}
            {answers.hypertension === 1 && (
              <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border">
                <p className="text-sm font-medium mb-3">
                  Are you currently taking medication for blood pressure?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ l: 'Yes', v: 1 as 0|1 }, { l: 'No', v: 0 as 0|1 }].map((opt) => (
                    <button
                      key={opt.l}
                      type="button"
                      onClick={() => updateAnswers({ bp_medication: opt.v })}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        answers.bp_medication === opt.v
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        );

      case 'Q7':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q7. Have you been diagnosed with either of the following?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Answer both.</p>
            <div className="space-y-3">
              {/* Diabetes */}
              <div className="p-4 rounded-xl border border-border">
                <p className="text-sm font-medium mb-3">Diabetes</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ l: 'Yes', v: 1 as 0|1 }, { l: 'No', v: 0 as 0|1 }].map((opt) => (
                    <button
                      key={opt.l}
                      type="button"
                      onClick={() => updateAnswers({ diabetes: opt.v })}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        answers.diabetes === opt.v
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Stroke */}
              <div className="p-4 rounded-xl border border-border">
                <p className="text-sm font-medium mb-3">Prior stroke</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ l: 'Yes', v: 1 as 0|1 }, { l: 'No', v: 0 as 0|1 }].map((opt) => (
                    <button
                      key={opt.l}
                      type="button"
                      onClick={() => updateAnswers({ prev_stroke: opt.v })}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        answers.prev_stroke === opt.v
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      case 'Q8':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q8. Do you know your most recent blood pressure reading?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Optional — leave blank and the model will estimate it.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Yes', value: 'yes' as const },
                { label: 'No', value: 'no' as const },
                { label: "I don't know", value: 'unknown' as const },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => updateAnswers({ bpKnowledge: opt.value })}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    answers.bpKnowledge === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {answers.bpKnowledge === 'yes' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Systolic (mmHg)
                  </label>
                  <input
                    type="number"
                    min={60}
                    max={250}
                    value={answers.systolic_bp ?? ''}
                    onChange={(e) =>
                      updateAnswers({ systolic_bp: e.target.value ? Number(e.target.value) : null })
                    }
                    className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. 120"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Diastolic (mmHg)
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={150}
                    value={answers.diastolic_bp ?? ''}
                    onChange={(e) =>
                      updateAnswers({ diastolic_bp: e.target.value ? Number(e.target.value) : null })
                    }
                    className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="e.g. 80"
                  />
                </div>
              </div>
            )}
          </>
        );

      case 'Q9':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q9. Do you know any values from a recent blood test?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              All optional — skip any you don't know. The model will impute missing values.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Cholesterol (mg/dL)', field: 'cholesterol' as const, min: 50, max: 600 },
                { label: 'Glucose (mg/dL)',      field: 'glucose'     as const, min: 40, max: 500 },
                { label: 'Resting HR (bpm)',     field: 'resting_hr'  as const, min: 30, max: 220 },
              ].map((item) => (
                <div key={item.field}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {item.label}
                  </label>
                  <input
                    type="number"
                    min={item.min}
                    max={item.max}
                    value={(answers[item.field] as number | null | undefined) ?? ''}
                    onChange={(e) =>
                      updateAnswers({
                        [item.field]: e.target.value ? Number(e.target.value) : null,
                      } as any)
                    }
                    className="w-full px-3 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="optional"
                  />
                </div>
              ))}
            </div>
          </>
        );

      // ──────────────────────────────────────────────────
      // SECTION 3 — CANCER SHARED  (Q10–Q14)
      // ──────────────────────────────────────────────────
      case 'Q10':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q10. Sun and skin exposure</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply to you.
            </p>
            <div className="space-y-2">
              <CheckItem
                label="I work outdoors, spend a lot of time in the sun, or have used tanning beds"
                checked={!!answers.uv_exposure_high}
                onChange={(v) => updateAnswers({ uv_exposure_high: v })}
              />
              <CheckItem
                label="I have had a blistering sunburn (skin that peeled or blistered badly)"
                checked={!!answers.sunburn_history}
                onChange={(v) => updateAnswers({ sunburn_history: v })}
              />
              <CheckItem
                label="I live near the equator or at high altitude (e.g. India, Australia, East Africa, Andes)"
                checked={!!answers.geography_high_uv}
                onChange={(v) => updateAnswers({ geography_high_uv: v })}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Leave all unchecked if none apply.
            </p>
          </>
        );

      case 'Q11':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q11. Has anyone in your immediate family been diagnosed with any of the following?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply. Leave unchecked if none apply.
            </p>
            <div className="space-y-2">
              {answers.gender === 'Female' && (
                <>
                  <CheckItem
                    label="Breast cancer (mother, sister or daughter)"
                    checked={!!answers.family_history_breast}
                    onChange={(v) => updateAnswers({ family_history_breast: v })}
                  />
                  <CheckItem
                    label="Ovarian cancer"
                    checked={!!answers.family_history_ovarian}
                    onChange={(v) => updateAnswers({ family_history_ovarian: v })}
                  />
                </>
              )}
              {answers.gender === 'Male' && (
                <>
                  <CheckItem
                    label="Prostate cancer (father or brother)"
                    checked={!!answers.family_history_prostate}
                    onChange={(v) => updateAnswers({ family_history_prostate: v })}
                  />
                  <CheckItem
                    label="BRCA2 gene mutation in the family"
                    checked={!!answers.family_history_brca2}
                    onChange={(v) => updateAnswers({ family_history_brca2: v })}
                  />
                </>
              )}
              <CheckItem
                label="Skin cancer or melanoma"
                checked={!!answers.family_history_skin}
                onChange={(v) => updateAnswers({ family_history_skin: v })}
              />
              <CheckItem
                label="Leukaemia, lymphoma, or myeloma"
                checked={!!answers.family_history_blood}
                onChange={(v) => updateAnswers({ family_history_blood: v })}
              />
            </div>
          </>
        );

      case 'Q12':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q12. Have you ever had any of the following?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply. Leave unchecked if none apply.
            </p>
            <div className="space-y-2">
              <CheckItem
                label="Chemotherapy"
                checked={!!answers.prior_chemotherapy}
                onChange={(v) => updateAnswers({ prior_chemotherapy: v })}
              />
              <CheckItem
                label="Radiation treatment"
                checked={!!answers.prior_radiation}
                onChange={(v) => updateAnswers({ prior_radiation: v })}
              />
              <CheckItem
                label="A previous skin cancer diagnosis"
                checked={!!answers.prior_skin_cancer}
                onChange={(v) => updateAnswers({ prior_skin_cancer: v })}
              />
              <CheckItem
                label="Organ transplant, HIV, or long-term immunosuppressive medication"
                checked={!!answers.immunosuppressed}
                onChange={(v) => updateAnswers({ immunosuppressed: v })}
              />
            </div>
          </>
        );

      case 'Q13':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q13. In the past 3 months, have you experienced any of the following?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply. Leave unchecked if none apply.
            </p>
            <div className="space-y-2">
              <CheckItem
                label="Persistent, unexplained fatigue that doesn't improve with rest"
                checked={!!answers.persistent_fatigue}
                onChange={(v) => updateAnswers({ persistent_fatigue: v })}
              />
              <CheckItem
                label="Unexplained weight loss of 5kg or more"
                checked={!!answers.unexplained_weight_loss}
                onChange={(v) => updateAnswers({ unexplained_weight_loss: v })}
              />
              <CheckItem
                label="Regularly waking up drenched in sweat at night"
                checked={!!answers.night_sweats}
                onChange={(v) => updateAnswers({ night_sweats: v })}
              />
            </div>
          </>
        );

      case 'Q14':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q14. Have you recently noticed any of the following?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply. Leave unchecked if none apply.
            </p>
            <div className="space-y-2">
              <CheckItem
                label="Getting infections more often than usual"
                checked={!!answers.frequent_infections}
                onChange={(v) => updateAnswers({ frequent_infections: v })}
              />
              <CheckItem
                label="Bruising or bleeding very easily"
                checked={!!answers.easy_bruising_bleeding}
                onChange={(v) => updateAnswers({ easy_bruising_bleeding: v })}
              />
              <CheckItem
                label="Swollen lumps in the neck, armpit, or groin"
                checked={!!answers.swollen_lymph_nodes}
                onChange={(v) => updateAnswers({ swollen_lymph_nodes: v })}
              />
            </div>
          </>
        );

      // ──────────────────────────────────────────────────
      // SECTION 4A — FEMALE  (F_Q15–F_Q17)
      // ──────────────────────────────────────────────────
      case 'F_Q15':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q15. Do you know if you carry a BRCA1 or BRCA2 gene mutation?
            </h2>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { l: 'Yes, I carry it', v: true },
                { l: 'No', v: false },
                { l: 'Never been tested', v: false },
              ].map((opt) => (
                <button
                  key={opt.l}
                  type="button"
                  onClick={() => updateAnswers({ brca_known: opt.v })}
                  className={`py-2 px-3 rounded-xl border-2 text-[11px] font-medium transition-all ${
                    opt.l === 'Yes, I carry it'
                      ? answers.brca_known === true
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                      : answers.brca_known === false && answers.brca_known !== undefined
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </>
        );

      case 'F_Q16':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q16. Have you gone through menopause?</h2>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { l: 'Yes', v: 'yes' as const },
                { l: 'No', v: 'no' as const },
                { l: 'Not sure', v: 'not_sure' as const },
              ].map((opt) => (
                <button
                  key={opt.l}
                  type="button"
                  onClick={() => updateAnswers({ menopauseChoice: opt.v })}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    answers.menopauseChoice === opt.v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            {/* Inline HRT sub-toggle */}
            {answers.menopauseChoice === 'yes' && (
              <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border">
                <p className="text-sm font-medium mb-3">
                  Are you currently taking hormone replacement therapy (HRT)?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ l: 'Yes', v: true }, { l: 'No', v: false }].map((opt) => (
                    <button
                      key={opt.l}
                      type="button"
                      onClick={() => updateAnswers({ hrt_use: opt.v })}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        answers.hrt_use === opt.v
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        );

      case 'F_Q17':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q17. A couple of lifestyle questions</h2>
            <div className="space-y-5 mt-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  How many alcoholic drinks do you have in a typical week?
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  1 unit = 1 standard drink (beer / wine / shot)
                </p>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={answers.alcohol_weekly_units ?? ''}
                  onChange={(e) =>
                    updateAnswers({
                      alcohol_weekly_units: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. 4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">
                  How would you describe your weekly physical activity level?
                </label>
                <div className="space-y-2">
                  {[
                    { v: 'active',    label: 'Active (150+ min/week exercise)' },
                    { v: 'somewhat',  label: 'Moderate (60–149 min/week)' },
                    { v: 'low',       label: 'Low (under 60 min/week)' },
                    { v: 'sedentary', label: 'Sedentary' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateAnswers({ activityChoice: opt.v as any })}
                      className={`w-full text-left py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        answers.activityChoice === opt.v
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      // ──────────────────────────────────────────────────
      // SECTION 4B — MALE  (M_Q15–M_Q17)
      // ──────────────────────────────────────────────────
      case 'M_Q15':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q15. A few questions about your prostate health
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply. Leave unchecked if none apply.
            </p>
            <div className="space-y-2">
              <CheckItem
                label="I am of African, Caribbean, or African-American descent"
                checked={!!answers.race_high_risk}
                onChange={(v) => updateAnswers({ race_high_risk: v })}
              />
              <CheckItem
                label="I have urinary symptoms (weak stream, difficulty starting, or frequent urination)"
                checked={!!answers.urinary_symptoms}
                onChange={(v) => updateAnswers({ urinary_symptoms: v })}
              />
              <CheckItem
                label="I eat red or processed meat (beef, pork, sausage, bacon) daily or 3–5 times a week"
                checked={!!answers.diet_high_red_meat}
                onChange={(v) => updateAnswers({ diet_high_red_meat: v })}
              />
            </div>
            {/* BMI/obesity read-only display */}
            {answers.bmi && (
              <div className="mt-4 rounded-xl border border-dashed border-border p-4 bg-muted/40 text-sm">
                <p>
                  Your BMI is <span className="font-semibold">{answers.bmi}</span> —{' '}
                  <span className="font-semibold">
                    {answers.bmi >= 30 ? 'Obese' : answers.bmi >= 25 ? 'Overweight' : 'Normal'}
                  </span>
                </p>
              </div>
            )}
          </>
        );

      case 'M_Q16':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">
              Q16. Do you know your most recent PSA (prostate-specific antigen) test result?
            </h2>
            <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
              {[
                { l: 'Yes', v: 'yes' as const },
                { l: 'No', v: 'no' as const },
                { l: 'Never been tested', v: 'never' as const },
              ].map((opt) => (
                <button
                  key={opt.l}
                  type="button"
                  onClick={() => updateAnswers({ psaChoice: opt.v })}
                  className={`py-2 px-3 rounded-xl border-2 text-xs font-medium transition-all ${
                    answers.psaChoice === opt.v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            {answers.psaChoice === 'yes' && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  PSA value (ng/mL)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={answers.psa_known ?? ''}
                  onChange={(e) =>
                    updateAnswers({ psa_known: e.target.value ? Number(e.target.value) : null })
                  }
                  className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. 2.5"
                />
              </div>
            )}
          </>
        );

      case 'M_Q17':
        return (
          <>
            <h2 className="text-lg font-semibold mb-2">Q17. A couple of lifestyle questions</h2>
            <div className="space-y-5 mt-2">
              <div>
                <label className="block text-sm font-medium mb-1">
                  How many alcoholic drinks do you have in a typical week?
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  1 unit = 1 standard drink (beer / wine / shot)
                </p>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={answers.alcohol_weekly_units ?? ''}
                  onChange={(e) =>
                    updateAnswers({
                      alcohol_weekly_units: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="e.g. 4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">
                  How would you describe your weekly physical activity level?
                </label>
                <div className="space-y-2">
                  {[
                    { v: 'active',    label: 'Active (150+ min/week exercise)' },
                    { v: 'somewhat',  label: 'Moderate (60–149 min/week)' },
                    { v: 'low',       label: 'Low (under 60 min/week)' },
                    { v: 'sedentary', label: 'Sedentary' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => updateAnswers({ activityChoice: opt.v as any })}
                      className={`w-full text-left py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        answers.activityChoice === opt.v
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  // ── Profile View Card ─────────────────────────────────────
  const ProfileInfoCard = ({ icon: Icon, title, children }: { icon: any, title: string, children: React.ReactNode }) => (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );

  const ProfileField = ({ label, value }: { label: string, value: string | number | null | undefined }) => (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value ?? '—'}</span>
    </div>
  );

  // ── Render ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <main className="bg-background min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading your profile…</span>
        </div>
      </main>
    );
  }

  const bmiVal = profileData?.heightCm && profileData?.weightKg
    ? (profileData.weightKg / ((profileData.heightCm / 100) ** 2)).toFixed(1)
    : null;

  return (
    <main className="bg-background min-h-screen">
      <Navbar />
      <FloatingChat />

      <div className="px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
          {profileData ? (
            <>
              {/* Header */}
              <div className="mb-10 flex items-center justify-between flex-col sm:flex-row gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl md:text-3xl font-bold">My Profile</h1>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsAssessmentOpen(true)}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retake Assessment
                </button>
              </div>

            {/* Risk Summary Banner */}
            {assessmentData && (
              <div className="mb-8 bg-gradient-to-r from-primary/10 to-rose-400/10 border border-primary/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Overall Risk Score</p>
                  <p className="text-3xl font-bold">{assessmentData.overallRiskScore}<span className="text-lg text-muted-foreground font-normal"> / 100</span></p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assessed {new Date(assessmentData.assessedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Genetic</p>
                    <p className="font-semibold">{assessmentData.geneticDisposition ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Lifestyle</p>
                    <p className="font-semibold">{assessmentData.lifestyleImpact ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Medical</p>
                    <p className="font-semibold">{assessmentData.medicalHistoryRisk ?? '—'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Data Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Info */}
              <ProfileInfoCard icon={User} title="Personal Information">
                <ProfileField label="Gender" value={profileData.gender} />
                <ProfileField label="Age" value={profileData.age ? `${profileData.age} years` : null} />
                <ProfileField label="City" value={profileData.city} />
                <ProfileField label="Activity Level" value={profileData.activityLevel} />
              </ProfileInfoCard>

              {/* Body Metrics */}
              <ProfileInfoCard icon={Scale} title="Body Metrics">
                <ProfileField label="Height" value={profileData.heightCm ? `${profileData.heightCm} cm` : null} />
                <ProfileField label="Weight" value={profileData.weightKg ? `${profileData.weightKg} kg` : null} />
                <ProfileField label="BMI" value={bmiVal} />
                <ProfileField label="Skin Type (Fitzpatrick)" value={profileData.skinType ? `Type ${profileData.skinType}` : null} />
              </ProfileInfoCard>

              {/* Cardiovascular */}
              <ProfileInfoCard icon={Heart} title="Cardiovascular Health">
                <ProfileField label="Smoker" value={profileData.smoker === 1 ? 'Yes' : profileData.smoker === 0 ? 'No' : null} />
                <ProfileField label="Cigarettes/Day" value={profileData.cigsperday} />
                <ProfileField label="Hypertension" value={profileData.hypertension === 1 ? 'Yes' : profileData.hypertension === 0 ? 'No' : null} />
                <ProfileField label="Diabetes" value={profileData.diabetes === 1 ? 'Yes' : profileData.diabetes === 0 ? 'No' : null} />
                <ProfileField label="Previous Stroke" value={profileData.prevStroke === 1 ? 'Yes' : profileData.prevStroke === 0 ? 'No' : null} />
                <ProfileField label="Systolic BP" value={profileData.systolicBp ? `${profileData.systolicBp} mmHg` : null} />
                <ProfileField label="Diastolic BP" value={profileData.diastolicBp ? `${profileData.diastolicBp} mmHg` : null} />
                <ProfileField label="Cholesterol" value={profileData.cholesterol ? `${profileData.cholesterol} mg/dL` : null} />
                <ProfileField label="Resting HR" value={profileData.restingHr ? `${profileData.restingHr} bpm` : null} />
              </ProfileInfoCard>

              {/* Lifestyle & Medical */}
              <ProfileInfoCard icon={Activity} title="Lifestyle & Medical History">
                <ProfileField label="Family History" value={profileData.familyHistory?.length > 0 ? profileData.familyHistory.join(', ') : 'None reported'} />
                {profileData.medicalData && (
                  <>
                    <ProfileField label="Medications" value={profileData.medicalData.medications} />
                    <ProfileField label="Allergies" value={profileData.medicalData.allergies} />
                    <ProfileField label="Conditions" value={profileData.medicalData.conditions} />
                    <ProfileField label="Last Checkup" value={profileData.medicalData.lastCheckup} />
                  </>
                )}
              </ProfileInfoCard>
            </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-border">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to your Profile</h2>
              <p className="text-muted-foreground mb-6 max-w-md">Please complete your initial health risk assessment to build your personalized profile and view your analysis.</p>
              <button onClick={() => setIsAssessmentOpen(true)} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                Start Health Assessment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Assessment Dialog ─────────────────────────────── */}
      <Dialog open={isAssessmentOpen} onOpenChange={setIsAssessmentOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 sm:rounded-3xl shadow-2xl">
          <DialogHeader className="sticky top-0 p-6 md:px-8 md:py-6 flex flex-row items-center justify-between z-20 bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm">
            <DialogTitle className="text-xl font-bold">Health Assessment</DialogTitle>
          </DialogHeader>

          <div className="p-6 md:p-8">
            {renderHeader()}

            {submitError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="mb-8 rounded-2xl border border-border bg-card p-6 md:p-8 relative"
              >
                {renderQuestion()}
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={history.length <= 1 || isSubmitting}
                className="flex items-center gap-2 rounded-xl border border-border px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={isNextDisabled() || isSubmitting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLastQuestion ? (
                  isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Submit assessment'
                  )
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>

            {submitted && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-8 text-center"
                >
                  <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
                  <h3 className="text-lg font-bold text-green-900 dark:text-green-100">Assessment Submitted!</h3>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Your results are ready. Generating your profile...
                  </p>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}