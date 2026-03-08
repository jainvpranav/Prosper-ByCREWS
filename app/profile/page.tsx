'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/Navbar';
import { FloatingChat } from '@/components/FloatingChat';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Lock, Trophy, ArrowRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { AnimatePresence, motion } from 'framer-motion';



const steps = [
  { name: 'Basics', xp: 15 },
  { name: 'Family History', xp: 20 },
  { name: 'Lifestyle', xp: 25 },
  { name: 'Diet', xp: 20 },
  { name: 'Medical', xp: 25 },
  { name: 'Location', xp: 10 },
  { name: 'Review', xp: 35 },
];

const totalXP = steps.reduce((sum, step) => sum + step.xp, 0);

interface FormData {
  age: string;
  gender: string;
  activityLevel: string;
  familyHistory: string[];
  smoking: string;
  alcohol: string;
  sleep: string;
  foodPreference: string;
  dietQuality: string;
  medications: string;
  lastCheckup: string;
  allergies: string;
  conditions: string;
  city: string;
}

const mascotMessages = [
  { emoji: '👋', message: 'Let\'s get to know your health profile!' },
  { emoji: '👨‍⚕️', message: 'Family history matters for your health.' },
  { emoji: '🏃', message: 'Your lifestyle impacts your health significantly.' },
  { emoji: '🍎', message: 'Diet is one of the most important factors.' },
  { emoji: '💊', message: 'Tell us about your medical background.' },
  { emoji: '📍', message: 'Help us find providers near you.' },
  { emoji: '🎉', message: 'You\'re all set! Let\'s generate your care plan.' },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);
  const [formData, setFormData] = useState<FormData>({
    age: '',
    gender: '',
    activityLevel: '',
    familyHistory: [],
    smoking: '',
    alcohol: '',
    sleep: '',
    foodPreference: '',
    dietQuality: '',
    medications: '',
    lastCheckup: '',
    allergies: '',
    conditions: '',
    city: '',
  });

  const completedXP = steps.slice(0, currentStep).reduce((sum, s) => sum + s.xp, 0);
  const currentXP = steps[currentStep]?.xp || 0;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      toast.success(`+${currentXP} XP earned!`);
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user!.userId, ...formData }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to save profile');
      }
      toast.success('Profile saved! +35 XP earned! 🎉');
      setTimeout(() => router.push('/dashboard'), 600);
    } catch (err) {
      console.error(err);
      toast.error('Could not save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMultiSelect = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field as keyof FormData] as string[]).includes(value)
        ? (prev[field as keyof FormData] as string[]).filter((v) => v !== value)
        : [...(prev[field as keyof FormData] as string[]), value],
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Basics
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Age</label>
              <input
                type="number"
                min="18"
                max="120"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Enter your age"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Gender</label>
              <div className="grid grid-cols-3 gap-3">
                {['Male', 'Female', 'Other'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setFormData({ ...formData, gender: option })}
                    className={`py-2 px-4 rounded-xl border-2 font-medium transition-all ${
                      formData.gender === option
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Activity Level</label>
              <div className="space-y-2">
                {['Sedentary', 'Light', 'Moderate', 'Very Active'].map((level) => (
                  <label key={level} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="activity"
                      value={level}
                      checked={formData.activityLevel === level}
                      onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
                      className="w-4 h-4"
                    />
                    <span>{level}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 1: // Family History
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Family History of Health Conditions</label>
              <div className="grid grid-cols-2 gap-3">
                {['Heart Disease', 'Diabetes', 'Hypertension', 'Cancer', 'Stroke', 'None'].map((condition) => (
                  <button
                    key={condition}
                    onClick={() => handleMultiSelect('familyHistory', condition)}
                    className={`py-2 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                      (formData.familyHistory as string[]).includes(condition)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {condition}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 2: // Lifestyle
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Smoking Status</label>
              <div className="grid grid-cols-3 gap-3">
                {['Never', 'Former', 'Current'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setFormData({ ...formData, smoking: option })}
                    className={`py-2 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                      formData.smoking === option
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Alcohol Consumption</label>
              <div className="grid grid-cols-3 gap-3">
                {['None', 'Moderate', 'Heavy'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setFormData({ ...formData, alcohol: option })}
                    className={`py-2 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                      formData.alcohol === option
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Sleep per Night</label>
              <div className="grid grid-cols-4 gap-3">
                {['<5h', '5-7h', '7-9h', '>9h'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setFormData({ ...formData, sleep: option })}
                    className={`py-2 px-3 rounded-xl border-2 font-medium text-sm transition-all ${
                      formData.sleep === option
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 3: // Diet
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">Food Preferences</label>
              <div className="grid grid-cols-2 gap-3">
                {['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Keto', 'Other'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setFormData({ ...formData, foodPreference: option })}
                    className={`py-2 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                      formData.foodPreference === option
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Diet Quality</label>
              <div className="space-y-2">
                {['Excellent', 'Good', 'Fair'].map((option) => (
                  <label key={option} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="diet"
                      value={option}
                      checked={formData.dietQuality === option}
                      onChange={(e) => setFormData({ ...formData, dietQuality: e.target.value })}
                      className="w-4 h-4"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 4: // Medical
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Current Medications</label>
              <textarea
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="List any medications you take"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">Last Checkup</label>
              <div className="grid grid-cols-3 gap-3">
                {['Within 6 months', '6-12 months', 'Over 1 year'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setFormData({ ...formData, lastCheckup: option })}
                    className={`py-2 px-4 rounded-xl border-2 font-medium text-sm transition-all ${
                      formData.lastCheckup === option
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Allergies</label>
              <input
                type="text"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="List any allergies"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Medical Conditions</label>
              <textarea
                value={formData.conditions}
                onChange={(e) => setFormData({ ...formData, conditions: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="List any chronic conditions or past medical issues"
                rows={3}
              />
            </div>
          </div>
        );

      case 5: // Location
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">City / Region</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-border bg-input focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Enter your city"
              />
            </div>
          </div>
        );

      case 6: // Review
        return (
          <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-950 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-8 text-center">
              <Trophy className="w-16 h-16 text-amber-600 dark:text-amber-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-2">All Set!</h3>
              <p className="text-amber-800 dark:text-amber-200">You've completed your health profile. Ready to generate your personalized care plan?</p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6">
              <h4 className="font-bold mb-4">Profile Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Age</span>
                  <span className="font-medium">{formData.age} years</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Gender</span>
                  <span className="font-medium">{formData.gender}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Activity Level</span>
                  <span className="font-medium">{formData.activityLevel}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{formData.city}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <main className="bg-background min-h-screen">
      <Navbar />
      <FloatingChat />

      <div className="px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-3">
              <h1 className="text-2xl md:text-3xl font-bold">Build Your Health Profile</h1>
              <div className="text-right">
                <p className="text-sm font-medium text-primary">{completedXP + (currentStep === steps.length - 1 ? currentXP : 0)}/{totalXP} XP</p>
              </div>
            </div>

            <div className="w-full bg-border rounded-full h-2">
              <div
                className="bg-gradient-to-r from-primary to-rose-400 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${((currentStep + 1) / steps.length) * 100}%`,
                }}
              />
            </div>

            {/* Step Indicators */}
            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`flex-shrink-0 h-10 px-3 rounded-lg flex items-center gap-2 text-xs font-medium transition-all ${
                    idx < currentStep
                      ? 'bg-primary text-primary-foreground'
                      : idx === currentStep
                      ? 'bg-primary/20 text-primary border border-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx < currentStep && '✓'}
                  {step.name}
                </div>
              ))}
            </div>
          </div>

          {/* Mascot Tip */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-8 flex items-start gap-4">
            <span className="text-4xl flex-shrink-0">{mascotMessages[currentStep].emoji}</span>
            <div>
              <p className="text-sm text-foreground">{mascotMessages[currentStep].message}</p>
            </div>
          </div>

          {/* Form Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.3 }}
              className="bg-card border border-border rounded-2xl p-8 mb-8"
            >
              <h2 className="text-2xl font-bold mb-2">{steps[currentStep].name}</h2>
              <p className="text-muted-foreground mb-8">+{steps[currentStep].xp} XP</p>

              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-6 py-2 rounded-xl border border-border text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            {currentStep === steps.length - 1 ? (
              <button
                onClick={handleComplete}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <>Generate Care Plan <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Privacy Badge */}
          <div className="flex items-center gap-2 justify-center mt-8 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            Your data is encrypted and HIPAA compliant
          </div>
        </div>
      </div>
    </main>
  );
}
