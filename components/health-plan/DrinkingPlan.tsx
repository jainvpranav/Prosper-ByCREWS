'use client';

import { Wine, AlertTriangle } from 'lucide-react';

export function DrinkingPlan({ riskBand }: { riskBand: string }) {
  if (riskBand.toLowerCase() === 'low') return null;

  const lowRiskLimits = '14 units/week (max 3/day)';
  const medRiskLimits = '10 units/week (max 2/day)';
  const highRiskLimits = '0-5 units/week (highly recommended to stop)';

  const limitDesc = riskBand.toLowerCase() === 'high' ? highRiskLimits : medRiskLimits;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-rose-500/10 rounded-lg">
          <Wine className="w-5 h-5 text-rose-500" />
        </div>
        <h3 className="font-bold">Alcohol Moderation Plan</h3>
      </div>
      
      <div className="bg-muted px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold">Recommended Limit for {riskBand} Risk</p>
          <p className="text-xs text-muted-foreground">{limitDesc}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span>Target Progress</span>
          <span className="font-semibold text-rose-500">Active</span>
        </div>
        <div className="w-full bg-border rounded-full h-2">
          <div className="bg-gradient-to-r from-rose-500 to-rose-400 h-2 rounded-full" style={{ width: '40%' }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center italic">Log your drinks daily to track adherence to this plan.</p>
      </div>
    </div>
  );
}
