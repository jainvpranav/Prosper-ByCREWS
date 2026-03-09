'use client';

import { Utensils, Check, X } from 'lucide-react';

type DietPlanProps = {
  cholesterol: number;
  glucose: number;
  bmi: number;
};

export function DietPlan({ cholesterol, glucose, bmi }: DietPlanProps) {
  // Simple heuristic logic based on PRD
  const isHighCholesterol = cholesterol > 200;
  const isHighGlucose = glucose > 100;
  const needsWeightLoss = bmi > 25;

  const toAvoid = [];
  const toEncourage = ['Leafy greens', 'Lean proteins (chicken, fish)', 'High-fiber legumes'];
  
  if (isHighCholesterol) {
    toAvoid.push('Fried foods', 'Red meat', 'Full-fat dairy');
    toEncourage.push('Oats and barley', 'Nuts', 'Olive oil');
  }
  
  if (isHighGlucose) {
    toAvoid.push('Sugary drinks', 'White bread/rice', 'Pastries');
    toEncourage.push('Whole grains', 'Non-starchy vegetables');
  }

  if (needsWeightLoss) {
    toAvoid.push('Processed snacks', 'Excessive calories');
  }

  if (toAvoid.length === 0) {
    toAvoid.push('Excessive processed foods', 'Late night heavy meals');
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-500/10 rounded-lg">
          <Utensils className="w-5 h-5 text-green-500" />
        </div>
        <h3 className="font-bold">Nutrition & Diet Plan</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-6">
        Based on your {isHighCholesterol ? 'cholesterol' : ''} 
        {isHighCholesterol && isHighGlucose ? ' and ' : ''} 
        {isHighGlucose ? 'glucose levels' : (isHighCholesterol ? 'levels' : 'profile')}.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-500" /> Foods to Encourage
          </h4>
          <ul className="space-y-2">
            {toEncourage.map((food, i) => (
              <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                <span className="text-green-500 mt-1">•</span> {food}
              </li>
            ))}
          </ul>
        </div>

        <div>
           <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <X className="w-4 h-4 text-rose-500" /> Foods to Limit
          </h4>
          <ul className="space-y-2">
            {toAvoid.map((food, i) => (
              <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                <span className="text-rose-500 mt-1">•</span> {food}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t border-border flex justify-between text-sm">
        <div>
          <span className="block text-muted-foreground text-xs">Daily Sodium Target</span>
          <span className="font-semibold">{isHighCholesterol ? '< 1,500 mg' : '< 2,300 mg'}</span>
        </div>
        <div className="text-right">
          <span className="block text-muted-foreground text-xs">Daily Calorie Target</span>
          <span className="font-semibold">{needsWeightLoss ? 'Moderate Deficit' : 'Maintenance'}</span>
        </div>
      </div>
    </div>
  );
}
