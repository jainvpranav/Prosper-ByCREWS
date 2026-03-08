'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { FloatingChat } from '@/components/FloatingChat';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  CheckCircle2, AlertCircle, AlertTriangle,
  Sparkles, Download, TrendingUp, Loader2, Heart, ShieldCheck, ShieldAlert,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import Link from 'next/link';
import type { RiskAssessment } from '@/lib/riskAssessmentService';
import type { FullProfile } from '@/lib/profileService';

// ---------------------------------------------------------------------------
// ML API result types (from /predict and /cancer/all)
// ---------------------------------------------------------------------------
interface TriggeredFactor {
  factor: string;
  points: number;
  source: string;
  action: string;
}

interface CancerResult {
  cancer_type: string;
  score: number;
  category: 'Low' | 'Medium' | 'High';
  triggered_factors: TriggeredFactor[];
  screening_recommendation: string;
  eligible_for_screening: boolean;
  disclaimer: string;
}

interface TopFactor {
  feature: string;
  impact: number;
  direction: 'increases_risk' | 'decreases_risk' | 'neutral';
}

interface CardioResult {
  risk_probability: number;
  risk_category: string;
  at_risk: boolean;
  threshold_used: number;
  top_factors: TopFactor[];
}

// ---------------------------------------------------------------------------
// Fallback static data — shown when no ML results are available
// ---------------------------------------------------------------------------
const FALLBACK_PROJECTIONS = [
  { month: 'Month 0', predicted: 82, baseline: 82 },
  { month: 'Month 1', predicted: 80, baseline: 82 },
  { month: 'Month 2', predicted: 77, baseline: 82 },
  { month: 'Month 3', predicted: 73, baseline: 82 },
  { month: 'Month 4', predicted: 68, baseline: 82 },
  { month: 'Month 5', predicted: 62, baseline: 82 },
  { month: 'Month 6', predicted: 55, baseline: 82 },
];

const FALLBACK_RISK_FACTORS = [
  { name: 'Age', value: 35 },
  { name: 'Family History', value: 28 },
  { name: 'Vitals', value: 15 },
  { name: 'Activity Level', value: 4 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function categoryColor(cat: string) {
  if (cat === 'High')   return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800';
  if (cat === 'Medium') return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-700';
  return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800';
}

function categoryBarColor(cat: string) {
  if (cat === 'High')   return 'from-red-500 to-rose-400';
  if (cat === 'Medium') return 'from-yellow-500 to-amber-400';
  return 'from-green-500 to-emerald-400';
}

function cardioRiskColor(atRisk: boolean, category: string) {
  if (atRisk || category.toLowerCase() === 'high') return 'text-red-500';
  if (category.toLowerCase() === 'medium') return 'text-yellow-500';
  return 'text-green-500';
}

function featureLabel(feature: string) {
  const map: Record<string, string> = {
    age: 'Age',
    cigsperday: 'Cigarettes / day',
    systolic_bp: 'Systolic BP',
    diastolic_bp: 'Diastolic BP',
    bmi: 'BMI',
    cholesterol: 'Cholesterol',
    glucose: 'Glucose',
    resting_hr: 'Resting Heart Rate',
    smoker: 'Smoker',
    diabetes: 'Diabetes',
    hypertension: 'Hypertension',
  };
  return map[feature] ?? feature.replace(/_/g, ' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Derive ML results from the fetched assessment
  const cancerResults = (assessment?.cancerResults as CancerResult[]) ?? null;
  const cardioResult = (assessment?.cardioResult as CardioResult) ?? null;

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);



  useEffect(() => {
    if (!user) return;
    async function loadData() {
      try {
        const [assessmentRes, profileRes] = await Promise.all([
          fetch(`/api/risk-assessment?userId=${user!.userId}`),
          fetch(`/api/profile?userId=${user!.userId}`),
        ]);

        if (assessmentRes.ok) {
          const data = await assessmentRes.json();
          setAssessment(data.assessment ?? null);
        }
        if (profileRes.ok) {
          const data = await profileRes.json();
          setProfile(data.profile ?? null);
        }
      } catch (err) {
        console.error('[Dashboard] Error loading data:', err);
        setError('Could not load your health data. Showing demo data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  // Build chart data from DB or fallback
  const projectionData = assessment?.projections?.map((p) => ({
    month: `Month ${p.monthOffset}`,
    predicted: p.predictedScore,
    baseline: p.baselineScore,
  })) ?? FALLBACK_PROJECTIONS;

  const riskFactorsData = assessment?.riskFactors?.map((f) => ({
    name: f.factorName,
    value: f.contributionPct,
  })) ?? FALLBACK_RISK_FACTORS;

  const aiInsight = assessment?.aiInsightSummary ??
    "Based on your profile, your biggest opportunities for improvement are in lifestyle factors. Increasing physical activity and improving sleep quality could reduce your overall risk score by up to 20% in 6 months.";

  const hasMLResults = !!cancerResults || !!cardioResult;

  return (
    <main className="bg-background min-h-screen">
      <Navbar />
      <FloatingChat />

      <div className="px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="mx-auto max-w-7xl">

          {/* Loading / Error State */}
          {loading && (
            <div className="flex items-center gap-3 mb-8 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading your health data…</span>
            </div>
          )}
          {error && (
            <div className="mb-8 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm">
              ⚠️ {error}
            </div>
          )}

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center justify-between flex-col sm:flex-row gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
                  <span className="text-sm font-medium text-primary">
                    {profile ? `${profile.city ?? 'Your City'} • ${profile.age ?? '—'} yrs` : 'Patient ID: PROS-2025-0421'}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold">Your Health Overview</h1>
                <p className="text-muted-foreground mt-2">Personalized health analysis and recommendations</p>
              </div>

              <div className="flex gap-3">
                <Link href="/profile" className="px-6 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  New Assessment
                </Link>
                <button className="px-6 py-2 rounded-xl border border-border text-foreground hover:bg-muted transition-colors font-semibold flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export Report
                </button>
              </div>
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* SECTION: Overview (from DB risk_assessments)                       */}
          {/* ------------------------------------------------------------------ */}
          {assessment && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              <div className="bg-card p-6 rounded-2xl border border-border">
                <p className="text-sm text-muted-foreground mb-1">Overall Risk Score</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold">{assessment.overallRiskScore}/100</span>
                </div>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border">
                <p className="text-sm text-muted-foreground mb-1">Genetic Disposition</p>
                <p className="text-xl font-bold">{assessment.geneticDisposition ?? '—'}</p>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border">
                <p className="text-sm text-muted-foreground mb-1">Lifestyle Impact</p>
                <p className="text-xl font-bold">{assessment.lifestyleImpact ?? '—'}</p>
              </div>

              <div className="bg-card p-6 rounded-2xl border border-border">
                <p className="text-sm text-muted-foreground mb-1">Medical History</p>
                <p className="text-xl font-bold">{assessment.medicalHistoryRisk ?? '—'}</p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------ */}
          {/* SECTION: Cardiovascular Risk (ML result)                            */}
          {/* ------------------------------------------------------------------ */}
          {cardioResult ? (
            <div className="bg-card border border-border rounded-2xl p-8 mb-12">
              <div className="flex items-center gap-3 mb-6">
                <Heart className="w-6 h-6 text-rose-500" />
                <h2 className="text-xl font-bold">Cardiovascular Risk Assessment</h2>
                <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold border ${categoryColor(cardioResult.risk_category)}`}>
                  {cardioResult.risk_category} Risk
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Risk Probability */}
                <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted/40 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Risk Probability</p>
                  <p className={`text-4xl font-bold ${cardioRiskColor(cardioResult.at_risk, cardioResult.risk_category)}`}>
                    {(cardioResult.risk_probability * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Threshold: {(cardioResult.threshold_used * 100).toFixed(1)}%</p>
                </div>

                {/* At Risk */}
                <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted/40 border border-border">
                  <p className="text-sm text-muted-foreground mb-2">At Risk</p>
                  {cardioResult.at_risk ? (
                    <ShieldAlert className="w-10 h-10 text-red-500 mb-1" />
                  ) : (
                    <ShieldCheck className="w-10 h-10 text-green-500 mb-1" />
                  )}
                  <p className={`text-sm font-semibold ${cardioResult.at_risk ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    {cardioResult.at_risk ? 'Yes — consult a physician' : 'No — within safe range'}
                  </p>
                </div>

                {/* Top Factors */}
                <div className="p-6 rounded-xl bg-muted/40 border border-border">
                  <p className="text-sm text-muted-foreground mb-3 font-medium">Top Contributing Factors</p>
                  <ul className="space-y-2">
                    {cardioResult.top_factors.slice(0, 3).map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{featureLabel(f.feature)}</span>
                        <span className={`flex items-center gap-1 text-xs font-semibold ${
                          f.direction === 'increases_risk' ? 'text-red-500' :
                          f.direction === 'decreases_risk' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                        }`}>
                          {f.direction === 'increases_risk' ? <ArrowUpRight className="w-3 h-3" /> :
                           f.direction === 'decreases_risk' ? <ArrowDownRight className="w-3 h-3" /> :
                           <Minus className="w-3 h-3" />}
                          {Math.abs(f.impact * 100).toFixed(1)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {/* ------------------------------------------------------------------ */}
          {/* SECTION: Cancer Risk by Type (ML result)                            */}
          {/* ------------------------------------------------------------------ */}
          {cancerResults && cancerResults.length > 0 ? (
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="w-6 h-6 text-primary" />
                <h2 className="text-xl font-bold">Cancer Risk by Type</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cancerResults.map((result, idx) => (
                  <div key={idx} className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-base">{result.cancer_type}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${categoryColor(result.category)}`}>
                        {result.category}
                      </span>
                    </div>

                    {/* Score bar */}
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Risk Score</span>
                        <span className="font-semibold text-foreground">{result.score} / 100</span>
                      </div>
                      <div className="w-full bg-border rounded-full h-2">
                        <div
                          className={`bg-gradient-to-r ${categoryBarColor(result.category)} h-2 rounded-full transition-all`}
                          style={{ width: `${Math.min(result.score, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Triggered factors */}
                    {result.triggered_factors.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Key Factors</p>
                        <ul className="space-y-1">
                          {result.triggered_factors.map((tf, ti) => (
                            <li key={ti} className="text-xs text-foreground/80 flex items-start gap-1.5">
                              <span className="mt-0.5 text-primary">•</span>
                              <span>{tf.factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommended action */}
                    {result.triggered_factors[0]?.action && (
                      <div className="rounded-lg bg-muted/60 px-3 py-2">
                        <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Recommended Action</p>
                        <p className="text-xs">{result.triggered_factors[0].action}</p>
                      </div>
                    )}

                    {/* Screening recommendation */}
                    <div className="mt-auto pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">{result.screening_recommendation}</p>
                      <span className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${result.eligible_for_screening ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        {result.eligible_for_screening ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {result.eligible_for_screening ? 'Eligible for screening' : 'Not yet eligible for screening'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              {cancerResults[0]?.disclaimer && (
                <p className="mt-4 text-xs text-muted-foreground text-center italic px-4">
                  ⚠️ {cancerResults[0].disclaimer}
                </p>
              )}
            </div>
          ) : !hasMLResults ? (
            /* Fallback: show static guideline cards when no ML results */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-card border-2 border-green-500/30 bg-green-50 dark:bg-green-950/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <h3 className="font-bold text-green-900 dark:text-green-100">AHA/ACC Guidelines</h3>
                </div>
                <p className="text-sm text-green-800 dark:text-green-200">Your profile aligns with recommended prevention strategies</p>
              </div>

              <div className="bg-card border-2 border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                  <h3 className="font-bold text-yellow-900 dark:text-yellow-100">Diabetes Prevention</h3>
                </div>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">Consider lifestyle modifications to reduce risk</p>
              </div>

              <div className="bg-card border-2 border-orange-500/30 bg-orange-50 dark:bg-orange-950/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-bold text-orange-900 dark:text-orange-100">WHO CVD Framework</h3>
                </div>
                <p className="text-sm text-orange-800 dark:text-orange-200">Cardiovascular risk management recommended</p>
              </div>
            </div>
          ) : null}

          {/* ------------------------------------------------------------------ */}
          {/* SECTION: Risk Factor Contribution                                   */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-card border border-border rounded-2xl p-8 mb-12">
            <h2 className="text-xl font-bold mb-6">Risk Factor Contribution</h2>
            <div className="space-y-4">
              {riskFactorsData.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-2">
                    <span className="font-medium text-sm">{item.name}</span>
                    <span className="text-sm font-semibold text-primary">{item.value}%</span>
                  </div>
                  <div className="w-full bg-border rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary to-rose-400 h-2 rounded-full"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* SECTION: 6-Month Projection Chart                                   */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-card border border-border rounded-2xl p-8 mb-12">
            <h2 className="text-xl font-bold mb-6">6-Month Health Risk Projection</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '0.75rem',
                  }}
                  labelStyle={{ color: 'var(--foreground)' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="var(--primary)"
                  name="With Interventions"
                  strokeWidth={2}
                  dot={{ fill: 'var(--primary)' }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke="var(--muted-foreground)"
                  name="Without Changes"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* SECTION: Recommended Actions                                        */}
          {/* ------------------------------------------------------------------ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {[
              { num: '1', title: 'Increase Physical Activity', desc: 'Aim for 150 minutes of moderate exercise weekly' },
              { num: '2', title: 'Improve Diet Quality', desc: 'Reduce processed foods and increase vegetables' },
              { num: '3', title: 'Schedule Checkup', desc: 'Book an appointment with your healthcare provider' },
            ].map((action, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-6">
                <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center mb-4">
                  {action.num}
                </div>
                <h3 className="font-bold mb-2">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.desc}</p>
              </div>
            ))}
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* SECTION: Generate Care Plan CTA                                     */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-gradient-to-r from-primary/10 to-rose-400/10 border border-primary/30 rounded-2xl p-8 text-center mb-12">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="text-2xl font-bold mb-2">Ready for Your Personalized Care Plan?</h3>
            <p className="text-muted-foreground mb-6">Get detailed recommendations tailored to your health profile</p>
            <Link
              href="/appointments"
              className="inline-block px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
            >
              Book an Appointment
            </Link>
          </div>

          {/* ------------------------------------------------------------------ */}
          {/* SECTION: AI Insights                                                */}
          {/* ------------------------------------------------------------------ */}
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <Sparkles className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-bold mb-2">Pip&apos;s Health Insight</h3>
                <p className="text-muted-foreground mb-4">{aiInsight}</p>
                <button className="text-primary font-semibold text-sm hover:gap-2 flex items-center gap-1 transition-all">
                  Chat with Pip →
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
