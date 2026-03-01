import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { ArrowRight, Activity, Bot, Heart, TrendingUp, Calendar, Bell, Brain, Lock, Zap, BarChart3, MessageSquare, Shield } from 'lucide-react';

const features = [
  {
    icon: Activity,
    title: 'Comprehensive Health Screening',
    description: 'Complete health assessment covering medical history, lifestyle factors, and genetic predisposition.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: Bot,
    title: 'AI Health Buddy',
    description: 'Chat with Pip, your personal AI companion, for instant health insights and recommendations.',
    color: 'from-purple-500 to-purple-600',
  },
  {
    icon: Heart,
    title: 'Risk Assessment Engine',
    description: 'Advanced algorithms analyze your data to identify potential health risks early.',
    color: 'from-red-500 to-red-600',
  },
  {
    icon: TrendingUp,
    title: 'Health Projections',
    description: '6-month health outcome predictions based on your current trajectory and interventions.',
    color: 'from-green-500 to-green-600',
  },
  {
    icon: Calendar,
    title: 'Smart Appointment Booking',
    description: 'Find and book appointments with healthcare providers in your area instantly.',
    color: 'from-orange-500 to-orange-600',
  },
  {
    icon: Bell,
    title: 'Personalized Reminders',
    description: 'Get timely reminders for medications, check-ups, and health goals.',
    color: 'from-pink-500 to-pink-600',
  },
  {
    icon: Brain,
    title: 'Guideline Recommendations',
    description: 'Receive care guidelines tailored to your specific health profile.',
    color: 'from-indigo-500 to-indigo-600',
  },
  {
    icon: Lock,
    title: 'Medical Privacy',
    description: 'HIPAA-compliant, encrypted storage of your most sensitive health information.',
    color: 'from-slate-500 to-slate-600',
  },
];

export default function Features() {
  return (
    <main className="bg-background">
      <Navbar />

      {/* Header */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-7xl">
          <div className="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <span className="text-sm font-medium text-primary">🚀 Feature Showcase</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">Powerful Features</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Everything you need to understand and improve your health
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className="bg-card border border-border rounded-2xl p-8 hover:shadow-lg hover:border-primary/50 transition-all"
                >
                  <div className={`bg-gradient-to-br ${feature.color} w-14 h-14 rounded-xl flex items-center justify-center mb-6`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground mb-4">{feature.description}</p>
                  <button className="text-primary font-semibold text-sm hover:gap-2 flex items-center gap-1 transition-all">
                    Learn more <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-gradient-to-r from-primary/10 to-rose-400/10 border-y border-border">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Experience These Features Today</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Start your health journey with PROSPER's comprehensive features
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
