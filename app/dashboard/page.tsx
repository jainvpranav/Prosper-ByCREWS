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
  AlertTriangle, Dna, Flame, Timer, CheckCircle2, AlertCircle,
  Sparkles, Download, TrendingUp, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import type { RiskAssessment } from '@/lib/riskAssessmentService';
import type { FullProfile } from '@/lib/profileService';



// ---------------------------------------------------------------------------
// Fallback static data — shown when DB is not yet connected / no data exists
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

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<RiskAssessment | null>(null);
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const overallScore = assessment?.overallRiskScore ?? 82;
  const geneticDisp  = assessment?.geneticDisposition ?? 'Moderate';
  const lifestyleImpact = assessment?.lifestyleImpact ?? 'Critical';
  const medHistoryRisk  = assessment?.medicalHistoryRisk ?? 'Low Risk';
  const aiInsight = assessment?.aiInsightSummary ??
    "Based on your profile, your biggest opportunities for improvement are in lifestyle factors. Increasing physical activity and improving sleep quality could reduce your overall risk score by up to 20% in 6 months.";

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

          {/* Risk Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Overall Risk Score</p>
                  <p className="text-3xl font-bold mt-1">{overallScore}/100</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-xs text-red-500 font-semibold">↑ 5% from last month</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Genetic Disposition</p>
                  <p className="text-3xl font-bold mt-1">{geneticDisp}</p>
                </div>
                <Dna className="w-8 h-8 text-violet-500" />
              </div>
              <p className="text-xs text-muted-foreground">Based on family history</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Lifestyle Impact</p>
                  <p className="text-3xl font-bold mt-1">{lifestyleImpact}</p>
                </div>
                <Flame className="w-8 h-8 text-orange-500" />
              </div>
              <p className="text-xs text-orange-500 font-semibold">Needs improvement</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Medical History</p>
                  <p className="text-3xl font-bold mt-1">{medHistoryRisk}</p>
                </div>
                <Timer className="w-8 h-8 text-teal-500" />
              </div>
              <p className="text-xs text-muted-foreground">No major concerns</p>
            </div>
          </div>

          {/* Risk Factor Contribution */}
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

          {/* Guidelines Matched */}
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

          {/* 6-Month Projection Chart */}
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

          {/* Recommended Actions */}
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

          {/* Generate Care Plan CTA */}
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

          {/* AI Insights */}
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
