'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Scale, Moon, Brain, Utensils, Droplets, 
  Cigarette, Wine, Footprints, Activity, Stethoscope, 
  Flame, CheckCircle2, Loader2, PartyPopper, Zap
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

// Stress emoji faces that change with value
const stressEmojis = ['😌', '🙂', '😊', '😐', '😶', '😕', '😣', '😰', '😵', '🤯'];

// Witty encouragement based on field values
function getStepsFeedback(steps: number) {
  if (!steps) return null;
  if (steps >= 10000) return { emoji: '🔥', text: 'Legend status! You crushed it!' };
  if (steps >= 8000)  return { emoji: '💪', text: 'Almost there, keep pushing!' };
  if (steps >= 5000)  return { emoji: '👟', text: 'Solid effort — every step counts!' };
  return { emoji: '🐢', text: 'Slow and steady wins the race!' };
}

function getSleepFeedback(hours: number) {
  if (!hours) return null;
  if (hours >= 8) return { emoji: '🌟', text: 'Sleep champion! Your body thanks you.' };
  if (hours >= 7) return { emoji: '😴', text: 'Sweet dreams came through!' };
  if (hours >= 5) return { emoji: '☕', text: 'Surviving on caffeine? We see you.' };
  return { emoji: '🦉', text: 'Night owl alert — time to fix that!' };
}

function getWaterFeedback(glasses: number) {
  if (!glasses) return null;
  if (glasses >= 8) return { emoji: '🌊', text: 'Hydration level: OCEAN!' };
  if (glasses >= 5) return { emoji: '💧', text: 'Nice flow, keep sipping!' };
  return { emoji: '🏜️', text: 'Your cells are thirsty…' };
}

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
  const [showConfetti, setShowConfetti] = useState(false);

  // Calculate form completion percentage
  const completionPct = useMemo(() => {
    const fields = [
      logState.weight_kg, logState.sleep_hours, logState.meals_eaten,
      logState.water_glasses, logState.steps, logState.exercise_mins
    ];
    const filled = fields.filter(f => f !== '').length;
    return Math.round((filled / fields.length) * 100);
  }, [logState]);

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
        setShowConfetti(true);
        setTimeout(() => {
          setSuccess(true);
          setAlreadyLogged(true);
          setStreak(s => s + 1);
        }, 1200);
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

  // Confetti animation
  if (showConfetti && !success) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center animate-in zoom-in-95 duration-300 relative overflow-hidden">
        <style>{`
          @keyframes confetti-fall {
            0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          .confetti-piece {
            position: absolute;
            width: 10px;
            height: 10px;
            top: -10px;
            animation: confetti-fall 2s ease-in forwards;
          }
        `}</style>
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="confetti-piece rounded-sm"
            style={{
              left: `${Math.random() * 100}%`,
              backgroundColor: ['#e11d48', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#f43f5e'][i % 6],
              animationDelay: `${Math.random() * 0.8}s`,
              animationDuration: `${1.5 + Math.random()}s`,
            }}
          />
        ))}
        <PartyPopper className="w-16 h-16 text-primary mx-auto mb-4 animate-bounce" />
        <h3 className="text-2xl font-bold mb-2">Submitting your log...</h3>
        <p className="text-muted-foreground">Your dedication is inspiring! 🎉</p>
      </div>
    );
  }

  if (alreadyLogged && success) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center animate-in zoom-in-95 duration-300">
        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h3 className="text-2xl font-bold mb-2">You&apos;re on fire! 🔥</h3>
        <p className="text-muted-foreground mb-6">Weekly health data logged like a pro. See you next week, champ!</p>
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20">
          <Flame className="w-5 h-5" />
          {streak} Week Streak! 🏆
        </div>
      </div>
    );
  }

  const stepsFeedback = getStepsFeedback(parseInt(logState.steps) || 0);
  const sleepFeedback = getSleepFeedback(parseFloat(logState.sleep_hours) || 0);
  const waterFeedback = getWaterFeedback(parseInt(logState.water_glasses) || 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Streak Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-2xl p-6 mb-8">
        <div>
          <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Weekly Check-in
          </h3>
          <p className="text-sm text-muted-foreground">Log your metrics to earn your streak and power your health AI. Let&apos;s gooo! 🚀</p>
        </div>
        <div className="text-center">
          <span className="block text-3xl font-black text-orange-500">{streak}</span>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weeks</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Form completion
          </span>
          <span className="text-sm font-bold text-primary">{completionPct}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary to-rose-400 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        {completionPct === 100 && (
          <p className="text-xs text-primary font-medium mt-1 animate-in fade-in duration-300">
            ✨ All fields filled — you&apos;re ready to submit!
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Row 1: Vitals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-5 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-semibold mb-1 text-muted-foreground">
              <Scale className="w-4 h-4 text-primary" /> Weight (kg)
            </label>
            <p className="text-xs text-muted-foreground/70 mb-3">Step on that scale — no judgment here! ⚖️</p>
            <input 
              type="number" step="0.1" placeholder="e.g. 75.5" required
              className="w-full bg-background border border-border rounded-lg px-4 py-2"
              value={logState.weight_kg} onChange={e => setLogState({...logState, weight_kg: e.target.value})}
            />
          </div>
          <div className="bg-card border border-border p-5 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-semibold mb-1 text-muted-foreground">
              <Moon className="w-4 h-4 text-indigo-500" /> Sleep (Hours)
            </label>
            <p className="text-xs text-muted-foreground/70 mb-3">How many Z&apos;s did you catch? 😴</p>
            <input 
              type="number" step="0.5" placeholder="e.g. 7.5" required
              className="w-full bg-background border border-border rounded-lg px-4 py-2"
              value={logState.sleep_hours} onChange={e => setLogState({...logState, sleep_hours: e.target.value})}
            />
            {sleepFeedback && (
              <p className="text-xs mt-2 font-medium animate-in fade-in duration-300">
                {sleepFeedback.emoji} {sleepFeedback.text}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Stress Slider with Emoji Face */}
        <div className="bg-card border border-border p-6 rounded-xl">
          <div className="flex justify-between items-center mb-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Brain className="w-4 h-4 text-purple-500" /> Stress Level — How&apos;s the vibe?
            </label>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{stressEmojis[logState.stress_level - 1]}</span>
              <span className="font-bold text-lg text-purple-500">{logState.stress_level}</span>
            </div>
          </div>
          <input 
            type="range" min="1" max="10" 
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
            value={logState.stress_level} onChange={e => setLogState({...logState, stress_level: parseInt(e.target.value)})}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>😌 Zen Master</span>
            <span>🤯 Send Help</span>
          </div>
        </div>

        {/* Row 3: Nutrition & Habits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-4 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-semibold mb-1 text-muted-foreground">
              <Utensils className="w-3.5 h-3.5" /> 🍽️ Meals Eaten
            </label>
            <p className="text-[10px] text-muted-foreground/60 mb-2">Count &apos;em up!</p>
            <input type="number" min="0" placeholder="0" required className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" value={logState.meals_eaten} onChange={e => setLogState({...logState, meals_eaten: e.target.value})} />
          </div>
          <div className="bg-card border border-border p-4 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-semibold mb-1 text-muted-foreground">
              <Droplets className="w-3.5 h-3.5 text-blue-500" /> 💧 Water Glasses
            </label>
            <p className="text-[10px] text-muted-foreground/60 mb-2">Stay hydrated, champ!</p>
            <input type="number" min="0" placeholder="0" required className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" value={logState.water_glasses} onChange={e => setLogState({...logState, water_glasses: e.target.value})} />
            {waterFeedback && (
              <p className="text-[10px] mt-1.5 font-medium animate-in fade-in duration-300">
                {waterFeedback.emoji} {waterFeedback.text}
              </p>
            )}
          </div>
          <div className="bg-card border border-border p-4 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-semibold mb-1 text-muted-foreground">
              <Cigarette className="w-3.5 h-3.5 text-stone-500" /> 🚬 Cigarettes
            </label>
            <p className="text-[10px] text-muted-foreground/60 mb-2">Less is more here!</p>
            <input type="number" min="0" placeholder="0" required className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" value={logState.cigarettes_smoked} onChange={e => setLogState({...logState, cigarettes_smoked: e.target.value})} />
          </div>
          <div className="bg-card border border-border p-4 rounded-xl">
            <label className="flex items-center gap-2 text-xs font-semibold mb-1 text-muted-foreground">
              <Wine className="w-3.5 h-3.5 text-rose-500" /> 🍷 Alcohol Units
            </label>
            <p className="text-[10px] text-muted-foreground/60 mb-2">Moderation is key 🔑</p>
            <input type="number" min="0" placeholder="0" required className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" value={logState.alcohol_units} onChange={e => setLogState({...logState, alcohol_units: e.target.value})} />
          </div>
        </div>

        {/* Row 4: Movement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-5 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-semibold mb-1 text-muted-foreground">
              <Footprints className="w-4 h-4 text-emerald-500" /> 🏃 Steps Conquered
            </label>
            <p className="text-xs text-muted-foreground/70 mb-3">Every step is a victory lap!</p>
            <input 
              type="number" placeholder="e.g. 8500" required
              className="w-full bg-background border border-border rounded-lg px-4 py-2"
              value={logState.steps} onChange={e => setLogState({...logState, steps: e.target.value})}
            />
            {stepsFeedback && (
              <p className="text-xs mt-2 font-medium animate-in fade-in duration-300">
                {stepsFeedback.emoji} {stepsFeedback.text}
              </p>
            )}
          </div>
          <div className="bg-card border border-border p-5 rounded-xl">
            <label className="flex items-center gap-2 text-sm font-semibold mb-1 text-muted-foreground">
              <Activity className="w-4 h-4 text-rose-500" /> 💪 Exercise (Minutes)
            </label>
            <p className="text-xs text-muted-foreground/70 mb-3">Sweating is just fat crying 😂</p>
            <input 
              type="number" placeholder="e.g. 45" required
              className="w-full bg-background border border-border rounded-lg px-4 py-2"
              value={logState.exercise_mins} onChange={e => setLogState({...logState, exercise_mins: e.target.value})}
            />
          </div>
        </div>

        {/* Row 5: Symptoms */}
        <div className="bg-card border border-border p-5 rounded-xl">
          <label className="flex items-center gap-2 text-sm font-semibold mb-1 text-muted-foreground">
            <Stethoscope className="w-4 h-4 text-primary" /> 🩺 Symptoms or Notes
          </label>
          <p className="text-xs text-muted-foreground/70 mb-3">Anything unusual? Your AI assistant is listening.</p>
          <textarea 
            placeholder="Chest pain, dizziness, headaches, or just 'feeling awesome' 😎"
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
            {alreadyLogged ? 'Logged This Week ✅' : 'Submit & Celebrate 🎉'}
          </button>
        </div>

      </form>
    </div>
  );
}
