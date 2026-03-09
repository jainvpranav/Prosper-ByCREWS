'use client';

import { Activity, Dumbbell, Footprints, HeartPulse, Target } from 'lucide-react';

export function ExercisePlan({ restingHr, riskBand, bmi, aiData }: { restingHr: number, riskBand: string, bmi: number, aiData?: any }) {
  const isHighRisk = riskBand.toLowerCase() === 'high';
  const isMediumRisk = riskBand.toLowerCase() === 'medium' || riskBand.toLowerCase() === 'moderate';
  const needsConditioning = restingHr > 85 || bmi > 30;

  // Dynamic target minutes based on risk & conditioning
  let targetIntensity = isHighRisk ? 'Low to Moderate' : (needsConditioning ? 'Moderate' : 'Moderate to High');
  let targetMinutes = isHighRisk ? 90 : (needsConditioning ? 120 : 150);
  let strengthDays = isHighRisk ? 1 : (needsConditioning ? 1 : 2);

  // Dynamic daily steps target
  let dailySteps = isHighRisk ? 5000 : (needsConditioning ? 6500 : (isMediumRisk ? 8000 : 10000));
  
  let schedule = isHighRisk
    ? [
        { days: "Mon / Wed", activity: "20 min light walking" },
        { days: "Tue / Thu", activity: "15 min mobility & stretching" },
        { days: "Fri / Sun", activity: "Rest & recovery" },
        { days: "Saturday", activity: "20 min continuous light cardio" },
      ]
    : needsConditioning
    ? [
        { days: "Mon / Wed", activity: "25 min brisk walking" },
        { days: "Tue / Thu", activity: "20 min light resistance training" },
        { days: "Fri / Sun", activity: "Active rest (stretching, casual walk)" },
        { days: "Saturday", activity: "30 min moderate cardio (cycling/swimming)" },
      ]
    : [
        { days: "Mon / Wed", activity: "30 min brisk walking or light jogging" },
        { days: "Tue / Thu", activity: "Light resistance training or yoga" },
        { days: "Fri / Sun", activity: "Active Rest (stretching, casual walk)" },
        { days: "Saturday", activity: "45 min continuous cardio (cycling/swimming)" },
      ];

  if (aiData) {
    targetMinutes = aiData.targetMinutes || targetMinutes;
    targetIntensity = aiData.targetIntensity || targetIntensity;
    strengthDays = aiData.strengthDays !== undefined ? aiData.strengthDays : strengthDays;
    dailySteps = aiData.dailySteps || dailySteps;
    schedule = aiData.schedule || schedule;
  }
  
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Activity className="w-5 h-5 text-blue-500" />
        </div>
        <h3 className="font-bold">Weekly Exercise Schedule</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
         <div className="bg-muted rounded-lg p-4 text-center">
            <Footprints className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <span className="block text-2xl font-bold">{targetMinutes}<span className="text-sm font-normal text-muted-foreground">m</span></span>
            <span className="text-xs text-muted-foreground">Weekly Target</span>
         </div>
         <div className="bg-muted rounded-lg p-4 text-center">
            <Target className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <span className="block text-2xl font-bold">{dailySteps.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">Daily Steps Goal</span>
         </div>
         <div className="bg-muted rounded-lg p-4 text-center">
            <HeartPulse className="w-6 h-6 text-rose-500 mx-auto mb-2" />
            <span className="block text-sm font-bold mt-2">{targetIntensity}</span>
            <span className="text-xs text-muted-foreground">Target Intensity</span>
         </div>
         <div className="bg-muted rounded-lg p-4 text-center">
            <Dumbbell className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <span className="block text-2xl font-bold">{strengthDays}<span className="text-sm font-normal text-muted-foreground">x</span></span>
            <span className="text-xs text-muted-foreground">Strength Days/Wk</span>
         </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold mb-2">Recommended Schedule</h4>
        
        {schedule.map((item: any, i: number) => (
          <div key={i} className={`flex items-center justify-between p-3 rounded-lg border border-border text-sm ${item.activity.toLowerCase().includes('rest') ? 'bg-muted/50' : ''}`}>
            <span className={`font-medium w-24 ${item.activity.toLowerCase().includes('rest') ? 'text-primary' : ''}`}>{item.days}</span>
            <span className="text-muted-foreground flex-1">{item.activity}</span>
          </div>
        ))}
      </div>

    </div>
  );
}
