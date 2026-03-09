'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Loader2, Sparkles, Brain, RefreshCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { SmokingPlan } from './SmokingPlan';
import { DrinkingPlan } from './DrinkingPlan';
import { DietPlan } from './DietPlan';
import { ExercisePlan } from './ExercisePlan';
import { MedicationPlan } from './MedicationPlan';

export function HealthPlanCards() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Bedrock AI specific
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    async function loadData() {
      try {
        const [profRes, assessRes] = await Promise.all([
          fetch(`/api/profile?userId=${user?.userId}`),
          fetch(`/api/risk-assessment?userId=${user?.userId}`)
        ]);
        
        const profile = profRes.ok ? await profRes.json() : null;
        const assessment = assessRes.ok ? await assessRes.json() : null;

        setData({
          profile: profile?.profile,
          assessment: assessment?.assessment
        });
      } catch (err) {
        console.error('Failed to load context for health plans', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const generateAIPlan = async () => {
    if (!user) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/health-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId })
      });
      const result = await res.json();
      if (res.ok) {
        setAiPlan(result.plan);
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate AI plan. Wait a moment and try again.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.profile || !data?.assessment) {
    return (
      <div className="text-center p-12 bg-muted/50 rounded-2xl border border-border">
        <p className="text-muted-foreground">Please complete your health assessment first to view personalized plans.</p>
      </div>
    );
  }

  const riskBand = data.assessment.cardioResult?.risk_band ?? data.assessment.cardioResult?.risk_category ?? 'Unknown';

  return (
    <div className="space-y-8">
      {/* Dynamic Bedrock AI Section */}
      <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-2xl p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-primary/20 rounded-xl">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Concierge Plan</h2>
            <p className="text-muted-foreground text-sm">Synthesized from your daily logs, historical tests, and cardiovascular risk profile.</p>
          </div>
        </div>
        
        {aiPlan?.aiPlan ? (
          <div className="space-y-4">
            <div className="prose dark:prose-invert max-w-none text-sm p-6 bg-background rounded-xl border border-border [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1 [&_strong]:text-foreground">
              <ReactMarkdown>{aiPlan.aiPlan}</ReactMarkdown>
            </div>
            <button
              onClick={generateAIPlan}
              disabled={aiLoading}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Regenerate Plan
            </button>
          </div>
        ) : (
          <button 
            onClick={generateAIPlan} 
            disabled={aiLoading}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 flex items-center gap-2"
          >
            {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            Generate My Dynamic Plan
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DietPlan 
          cholesterol={data.profile.cholesterol ?? 150} 
          glucose={data.profile.glucose ?? 90} 
          bmi={data.profile.bmi ?? 22} 
          aiData={aiPlan?.diet}
        />
        
        <ExercisePlan 
          restingHr={data.profile.restingHr ?? 70} 
          riskBand={riskBand} 
          bmi={data.profile.bmi ?? 22} 
          aiData={aiPlan?.exercise}
        />

        <MedicationPlan 
          bpMedication={data.profile.bpMedication === 1} 
          diabetes={data.profile.diabetes === 1} 
        />
        
        <DrinkingPlan riskBand={riskBand} />

        {data.profile.smoker === 1 && (
          <div className="lg:col-span-2">
            <SmokingPlan cigsperday={data.profile.cigsperday ?? 0} />
          </div>
        )}
      </div>
    </div>
  );
}
