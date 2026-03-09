'use client';

import { Activity, Dumbbell, Footprints, HeartPulse } from 'lucide-react';

export function ExercisePlan({ restingHr, riskBand, bmi }: { restingHr: number, riskBand: string, bmi: number }) {
  const isHighRisk = riskBand.toLowerCase() === 'high';
  const needsConditioning = restingHr > 85 || bmi > 30;

  const targetIntensity = isHighRisk ? 'Low to Moderate' : (needsConditioning ? 'Moderate' : 'Moderate to High');
  
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Activity className="w-5 h-5 text-blue-500" />
        </div>
        <h3 className="font-bold">Weekly Exercise Schedule</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
         <div className="bg-muted rounded-lg p-4 text-center">
            <Footprints className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <span className="block text-2xl font-bold">150<span className="text-sm font-normal text-muted-foreground">m</span></span>
            <span className="text-xs text-muted-foreground">Weekly Target</span>
         </div>
         <div className="bg-muted rounded-lg p-4 text-center">
            <HeartPulse className="w-6 h-6 text-rose-500 mx-auto mb-2" />
            <span className="block text-sm font-bold mt-2">{targetIntensity}</span>
            <span className="text-xs text-muted-foreground">Target Intensity</span>
         </div>
         <div className="bg-muted rounded-lg p-4 text-center">
            <Dumbbell className="w-6 h-6 text-purple-500 mx-auto mb-2" />
            <span className="block text-2xl font-bold">2<span className="text-sm font-normal text-muted-foreground">x</span></span>
            <span className="text-xs text-muted-foreground">Strength Days/Wk</span>
         </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold mb-2">Recommended Schedule</h4>
        
        <div className="flex items-center justify-between p-3 rounded-lg border border-border text-sm">
          <span className="font-medium w-24">Mon / Wed</span>
          <span className="text-muted-foreground flex-1">30 min brisk walking or light jogging</span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border border-border text-sm">
          <span className="font-medium w-24">Tue / Thu</span>
          <span className="text-muted-foreground flex-1">Light resistance training or yoga</span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border border-border text-sm bg-muted/50">
          <span className="font-medium w-24 text-primary">Fri / Sun</span>
          <span className="text-muted-foreground flex-1">Active Rest (stretching, casual walk)</span>
        </div>
        <div className="flex items-center justify-between p-3 rounded-lg border border-border text-sm">
          <span className="font-medium w-24">Saturday</span>
          <span className="text-muted-foreground flex-1">45 min continuous cardio (cycling/swimming)</span>
        </div>
      </div>

    </div>
  );
}
