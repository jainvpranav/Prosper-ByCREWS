'use client';

import { Cigarette } from 'lucide-react';

export function SmokingPlan({ cigsperday }: { cigsperday: number }) {
  if (cigsperday <= 0) return null;

  const week1Target = Math.max(0, cigsperday - 2);
  const week2Target = Math.max(0, week1Target - 2);
  const week4Target = Math.max(0, week2Target - 3);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-stone-500/10 rounded-lg">
          <Cigarette className="w-5 h-5 text-stone-500" />
        </div>
        <h3 className="font-bold">Smoking Cessation Plan</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-6">
        You indicated smoking {cigsperday} cigarettes per day. Phasing down gradually improves your heart health within weeks.
      </p>

      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-stone-500 before:to-transparent">
        
        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-background bg-stone-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] pb-4 md:pb-6 p-4 rounded-xl border border-border bg-background">
            <h4 className="font-bold text-sm">Week 1 Goal</h4>
            <p className="text-xs text-muted-foreground mt-1">Reduce down to {week1Target} per day. Consider nicotine patches (7mg/day).</p>
          </div>
        </div>

        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-background bg-stone-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] pb-4 md:pb-6 p-4 rounded-xl border border-border bg-background">
            <h4 className="font-bold text-sm">Week 2 Goal</h4>
            <p className="text-xs text-muted-foreground mt-1">Reduce down to {week2Target} per day. Use sugar-free gum to manage oral fixation cravings.</p>
          </div>
        </div>

        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-background bg-green-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" />
          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] pb-4 md:pb-6 p-4 rounded-xl border border-border bg-background">
            <h4 className="font-bold text-sm">Week 4+ Goal</h4>
            <p className="text-xs text-muted-foreground mt-1">Reduce to {week4Target} per day. Blood pressure drops significantly at this stage.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
