'use client';

import { useState, useEffect } from 'react';
import { 
  Scale, Moon, Brain, Utensils, Droplets, 
  Cigarette, Wine, Footprints, Activity, Stethoscope, 
  Flame, CheckCircle2, Loader2 
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type DailyLogState = {
  weight_kg: string;
  sleep_hours: string;
  stress_level: number;
  meals_eaten: string;
  water_glasses: string;
  cigarettes_smoked: string;
  alcohol_units: string;
  steps: string;
  exercise_mins: string;
  symptoms: string;
};

export function DailyLogForm() {
  const { user } = useAuth();
  const [logState, setLogState] = useState<DailyLogState>({
    weight_kg: '',
    sleep_hours: '',
    stress_level: 5,
    meals_eaten: '',
    water_glasses: '',
    cigarettes_smoked: '',
    alcohol_units: '',
    steps: '',
    exercise_mins: '',
    symptoms: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [streak, setStreak] = useState(0);
  const [alreadyLogged, setAlreadyLogged] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function checkToday() {
      try {
        const res = await fetch(`/api/daily-logs?userId=${user?.userId}`);
        if (res.ok) {
          const data = await res.json();
          setAlreadyLogged(data.loggedToday);
          setStreak(data.streak);
        }
      } catch (err) {
        console.error('Failed to fetch streak', err);
      }
    }
    checkToday();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      // Map strings back to numbers for the API
      const payload = {
        userId: user.userId,
        weight_kg: logState.weight_kg ? parseFloat(logState.weight_kg) : null,
        sleep_hours: logState.sleep_hours ? parseFloat(logState.sleep_hours) : null,
        stress_level: logState.stress_level,
        meals_eaten: logState.meals_eaten ? parseInt(logState.meals_eaten) : null,
        water_glasses: logState.water_glasses ? parseInt(logState.water_glasses) : null,
        cigarettes_smoked: logState.cigarettes_smoked ? parseInt(logState.cigarettes_smoked) : null,
        alcohol_units: logState.alcohol_units ? parseInt(logState.alcohol_units) : null,
        steps: logState.steps ? parseInt(logState.steps) : null,
        exercise_mins: logState.exercise_mins ? parseInt(logState.exercise_mins) : null,
        symptoms: logState.symptoms,
      };

      const res = await fetch('/api/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess(true);
        setAlreadyLogged(true);
        setStreak(s => s + 1); // Optimistic UI update
      } else {
        throw new Error('Failed to save log');
      }
    } catch (err) {
      console.error(err);
      alert('Could not save your daily log. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (alreadyLogged && success) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center animate-in zoom-in-95 duration-300">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">Great job!</h3>
        <p className="text-muted-foreground mb-6">You've successfully logged your health data for this week.</p>
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20">
          <Flame className="w-5 h-5" />
          {streak} Week Streak!
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Streak Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-6 mb-8">
        <div>
          <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Weekly Check-in
          </h3>
          <p className="text-sm text-muted-foreground">Log your weekly metrics to earn your streak and power your health AI.</p>
        </div>
        <div className="text-center">
          <span className="block text-3xl font-black text-orange-500">{streak}</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weeks</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Row 1: Vitals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-5 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground">
              <Scale className="w-4 h-4 text-primary" /> Weight (kg)
            </label>
            <input 
              type="number" step="0.1" placeholder="e.g. 75.5" required
              className="w-full bg-background border border-border rounded-lg px-4 py-2"
              value={logState.weight_kg} onChange={e => setLogState({...logState, weight_kg: e.target.value})}
            />
          </div>
          <div className="bg-card border border-border p-5 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground">
              <Moon className="w-4 h-4 text-indigo-500" /> Sleep (Hours)
            </label>
            <input 
              type="number" step="0.5" placeholder="e.g. 7.5" required
              className="w-full bg-background border border-border rounded-lg px-4 py-2"
              value={logState.sleep_hours} onChange={e => setLogState({...logState, sleep_hours: e.target.value})}
            />
          </div>
        </div>

        {/* Row 2: Stress Slider */}
        <div className="bg-card border border-border p-6 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Brain className="w-4 h-4 text-purple-500" /> Stress Level (1-10)
            </label>
            <span className="font-bold text-lg text-purple-500">{logState.stress_level}</span>
          </div>
          <input 
            type="range" min="1" max="10" 
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
            value={logState.stress_level} onChange={e => setLogState({...logState, stress_level: parseInt(e.target.value)})}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Very Calm</span>
            <span>Extremely Stressed</span>
          </div>
        </div>

        {/* Row 3: Nutrition & Habits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-4 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-semibold mb-2 text-muted-foreground">
              <Utensils className="w-3.5 h-3.5" /> Meals Eaten
            </label>
            <input type="number" min="0" placeholder="0" required className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" value={logState.meals_eaten} onChange={e => setLogState({...logState, meals_eaten: e.target.value})} />
          </div>
          <div className="bg-card border border-border p-4 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-semibold mb-2 text-muted-foreground">
              <Droplets className="w-3.5 h-3.5 text-blue-500" /> Water Glasses
            </label>
            <input type="number" min="0" placeholder="0" required className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" value={logState.water_glasses} onChange={e => setLogState({...logState, water_glasses: e.target.value})} />
          </div>
          <div className="bg-card border border-border p-4 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-semibold mb-2 text-muted-foreground">
              <Cigarette className="w-3.5 h-3.5 text-stone-500" /> Cigarettes
            </label>
            <input type="number" min="0" placeholder="0" required className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" value={logState.cigarettes_smoked} onChange={e => setLogState({...logState, cigarettes_smoked: e.target.value})} />
          </div>
          <div className="bg-card border border-border p-4 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-semibold mb-2 text-muted-foreground">
              <Wine className="w-3.5 h-3.5 text-rose-500" /> Alcohol Units
            </label>
            <input type="number" min="0" placeholder="0" required className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" value={logState.alcohol_units} onChange={e => setLogState({...logState, alcohol_units: e.target.value})} />
          </div>
        </div>

        {/* Row 4: Movement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-5 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground">
              <Footprints className="w-4 h-4 text-emerald-500" /> Steps
            </label>
            <input 
              type="number" placeholder="e.g. 8500" required
              className="w-full bg-background border border-border rounded-lg px-4 py-2"
              value={logState.steps} onChange={e => setLogState({...logState, steps: e.target.value})}
            />
          </div>
          <div className="bg-card border border-border p-5 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground">
              <Activity className="w-4 h-4 text-rose-500" /> Exercise (Minutes)
            </label>
            <input 
              type="number" placeholder="e.g. 45" required
              className="w-full bg-background border border-border rounded-lg px-4 py-2"
              value={logState.exercise_mins} onChange={e => setLogState({...logState, exercise_mins: e.target.value})}
            />
          </div>
        </div>

        {/* Row 5: Symptoms */}
        <div className="bg-card border border-border p-5 rounded-xl">
          <label className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground">
            <Stethoscope className="w-4 h-4 text-primary" /> Symptoms or Notes
          </label>
          <textarea 
            placeholder="Any chest pain, shortness of breath, dizziness today?"
            className="w-full bg-background border border-border rounded-lg px-4 py-3 min-h-[100px] resize-y"
            value={logState.symptoms} onChange={e => setLogState({...logState, symptoms: e.target.value})}
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4 border-t border-border">
          <button 
            type="submit" 
            disabled={loading || alreadyLogged}
            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {alreadyLogged ? 'Logged This Week' : 'Save Weekly Log'}
          </button>
        </div>

      </form>
    </div>
  );
}
