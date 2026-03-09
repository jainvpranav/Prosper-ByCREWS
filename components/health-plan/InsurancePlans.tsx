'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Shield, ShieldAlert, ShieldCheck, ShieldPlus, UserPlus, HeartPulse, Sparkles, Activity, Brain, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';

const SERVICE_CATALOG: Record<string, any> = {
  "Comprehensive Health Insurance": {
    icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20',
    desc: 'Top-tier medical coverage including specialists and advanced care.', type: 'Insurance Plan', price: '₹999/mo'
  },
  "Standard Health Insurance": {
    icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
    desc: 'Solid baseline coverage for everyday health and wellness.', type: 'Insurance Plan', price: '₹1999/mo'
  },
  "Preventive Health Plan": {
    icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
    desc: 'Focus on regular checkups, screenings, and staying healthy.', type: 'Insurance Plan', price: '₹2999/mo'
  },
  "High Coverage Life Insurance": {
    icon: UserPlus, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20',
    desc: 'Maximum financial protection for your family.', type: 'Life Insurance', price: '₹1999/mo'
  },
  "Standard Life Insurance": {
    icon: UserPlus, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20',
    desc: 'Essential financial security policy.', type: 'Life Insurance', price: '₹999/mo'
  },
  "Cardiovascular Screening": {
    icon: HeartPulse, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20',
    desc: 'Comprehensive heart health check and lipid profiling.', type: 'Screening Module', price: '₹499/mo'
  },
  "Cancer Screening Package": {
    icon: Sparkles, color: 'text-fuchsia-500', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20',
    desc: 'Targeted oncology markers based on your profile.', type: 'Screening Module', price: '₹999/mo'
  },
  "Weight Management Program": {
    icon: Activity, color: 'text-orange-500', bg: 'bg-orange-500/10', border: 'border-orange-500/20',
    desc: 'Dietitian support and personalized fitness tracking.', type: 'Wellness Program', price: '₹1999/mo'
  },
  "Mental Wellness Program": {
    icon: Brain, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20',
    desc: 'Therapy access and stress management protocols.', type: 'Wellness Program', price: '₹1999/mo'
  }
};

export function InsurancePlans() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [assessmentRes, profileRes, logsRes] = await Promise.all([
          fetch(`/api/risk-assessment?userId=${user?.userId}`),
          fetch(`/api/profile?userId=${user?.userId}`),
          fetch(`/api/daily-logs?userId=${user?.userId}`)
        ]);

        const assessmentData = assessmentRes.ok ? await assessmentRes.json() : null;
        const profileData = profileRes.ok ? await profileRes.json() : null;
        const logsData = logsRes.ok ? await logsRes.json() : null;

        const asmt = assessmentData?.assessment;
        const prof = profileData?.profile;
         
        // Feature mapping
        const cardio_risk = asmt?.cardioResult?.risk_probability ?? 0.1;
        
        let cancer_risk = 0.1;
        if (asmt?.cancerResults?.length) {
          cancer_risk = Math.max(...asmt.cancerResults.map((c: any) => c.score)) / 100;
        }

        const bmi = prof?.bmi ?? 24;
        const bmi_risk = bmi > 30 ? 0.8 : bmi > 25 ? 0.5 : 0.2;
        const smoking_risk = prof?.smoker === 1 ? 0.8 : 0.2;
        const age = prof?.age ?? 30;
        const age_risk = age > 60 ? 0.8 : age > 40 ? 0.5 : 0.2;
        
        // Log parsing
        const recentLogs = logsData?.logs || [];
        const exercise_risk = recentLogs.length > 0 && (recentLogs[0].exercise_mins || 0) < 30 ? 0.8 : 0.2;
        const stress_level = recentLogs.length > 0 && (recentLogs[0].stress_level || 0) > 7 ? 'high' : 'normal';

        // Advanced Matrix Formula
        const health_risk = 
            0.3 * cardio_risk +
            0.25 * cancer_risk +
            0.2 * bmi_risk +
            0.15 * smoking_risk +
            0.1 * exercise_risk;

        const life_risk = 
            0.35 * cardio_risk +
            0.25 * age_risk +
            0.2 * smoking_risk +
            0.2 * bmi_risk;

        const recs: string[] = [];

        if (health_risk > 0.6) recs.push("Comprehensive Health Insurance");
        else if (health_risk > 0.4) recs.push("Standard Health Insurance");
        else recs.push("Preventive Health Plan");

        if (life_risk > 0.6) recs.push("High Coverage Life Insurance");
        else if (life_risk > 0.4) recs.push("Standard Life Insurance");

        if (cardio_risk > 0.5) recs.push("Cardiovascular Screening");
        if (cancer_risk > 0.4) recs.push("Cancer Screening Package");
        if (bmi > 27) recs.push("Weight Management Program");
        if (stress_level === "high") recs.push("Mental Wellness Program");

        setRecommendations(recs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) {
    return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/10 rounded-xl">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Recommended Coverage & Programs</h2>
          <p className="text-muted-foreground text-sm">We generated a custom suite of services using your multi-variable risk matrix.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {recommendations.map((recKey) => {
          const plan = SERVICE_CATALOG[recKey];
          if (!plan) return null;
          const Icon = plan.icon;

          return (
            <div 
              key={recKey}
              className={`relative flex flex-col rounded-2xl border bg-card transition-all border-border hover:border-primary shadow-sm hover:shadow-md hover:-translate-y-1`}
            >
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${plan.bg}`}>
                    <Icon className={`w-6 h-6 ${plan.color}`} />
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-full tracking-wide">
                    {plan.type}
                  </span>
                </div>
                
                <h3 className="text-xl font-bold mb-2">{recKey}</h3>
                <p className="text-sm text-muted-foreground mb-6 flex-1">{plan.desc}</p>
                
                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                  <span className="font-bold">{plan.price}</span>
                  <button className="text-sm font-semibold text-primary flex items-center gap-1 hover:gap-2 transition-all">
                    Add to Plan <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
