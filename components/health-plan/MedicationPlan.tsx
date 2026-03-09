'use client';

import { Pill, Clock, AlertCircle } from 'lucide-react';

export function MedicationPlan({ bpMedication, diabetes }: { bpMedication: boolean, diabetes: boolean }) {
  if (!bpMedication && !diabetes) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Pill className="w-5 h-5 text-purple-500" />
        </div>
        <h3 className="font-bold">Active Medication Tracking</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-6">
        Based on your profile, strictly adhere to your prescribed medication schedule to maintain your health metrics.
      </p>

      <div className="space-y-4">
        {bpMedication && (
          <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-background">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-rose-500" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm">Blood Pressure Medication</h4>
              <p className="text-xs text-muted-foreground mt-1">Take daily as prescribed by your physician. Do not skip doses even if pressure reads normal.</p>
            </div>
            <button className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors">
              Log Dose
            </button>
          </div>
        )}

        {diabetes && (
          <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-background">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm">Diabetes Management</h4>
              <p className="text-xs text-muted-foreground mt-1">Ensure insulin/medications are taken alongside meals. Monitor glucose shortly after.</p>
            </div>
            <button className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors">
              Log Dose
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
