import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { ArrowRight, User, Lock, Activity, BookOpen, Stethoscope, Calendar, MessageSquare, Bell } from 'lucide-react';

const steps = [
  {
    num: '1',
    title: 'Build Your Profile',
    description: 'Start by completing a comprehensive health profile including your medical history, lifestyle, and family background.',
    icon: User,
    badge: '15 XP',
  },
  {
    num: '2',
    title: 'Secure Your Data',
    description: 'Your information is encrypted and stored securely according to HIPAA standards.',
    icon: Lock,
    badge: '20 XP',
  },
  {
    num: '3',
    title: 'Get Risk Analysis',
    description: 'Our AI analyzes your health data against medical research to identify potential risks.',
    icon: Activity,
    badge: '25 XP',
  },
  {
    num: '4',
    title: 'Receive Guidelines',
    description: 'Get personalized care guidelines based on established medical protocols for your specific situation.',
    icon: BookOpen,
    badge: '20 XP',
  },
  {
    num: '5',
    title: 'Care Plan',
    description: 'Receive a tailored care plan with specific recommendations and action items.',
    icon: Stethoscope,
    badge: '25 XP',
  },
  {
    num: '6',
    title: 'Book Appointments',
    description: 'Connect with healthcare providers and schedule appointments at your convenience.',
    icon: Calendar,
    badge: '10 XP',
  },
  {
    num: '7',
    title: 'Chat with Pip',
    description: 'Get answers to health questions anytime from your AI companion Pip.',
    icon: MessageSquare,
    badge: '15 XP',
  },
  {
    num: '8',
    title: 'Stay on Track',
    description: 'Receive reminders and track your progress toward your health goals.',
    icon: Bell,
    badge: '20 XP',
  },
];

export default function HowItWorks() {
  return (
    <main className="bg-background">
      <Navbar />

      {/* Header */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-7xl">
          <div className="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <span className="text-sm font-medium text-primary">📋 Step-by-Step Guide</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">How It Works</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Your journey to better health in 8 simple steps, gamified with rewards
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="space-y-12">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="relative">
                  {/* Connector Line */}
                  {idx < steps.length - 1 && (
                    <div className="hidden md:block absolute top-24 left-8 w-1 h-20 bg-gradient-to-b from-primary to-transparent" />
                  )}

                  <div className="flex gap-8">
                    {/* Number Circle */}
                    <div className="relative flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-rose-400 text-white font-bold flex items-center justify-center text-xl flex-shrink-0 shadow-lg">
                        {step.num}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-2 pb-8">
                      <div className="bg-card border border-border rounded-2xl p-8">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-2xl font-bold mb-2">{step.title}</h3>
                            <p className="text-muted-foreground">{step.description}</p>
                          </div>
                          <div className="bg-primary/10 rounded-lg p-3 flex-shrink-0">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                        </div>

                        <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                          <span className="text-xs font-semibold text-primary">+{step.badge}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-muted/30">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Why Choose PROSPER?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Personalized',
                description: 'Every recommendation is tailored to your specific health profile and needs.',
              },
              {
                title: 'Evidence-Based',
                description: 'Recommendations are based on current medical research and guidelines.',
              },
              {
                title: 'Privacy-First',
                description: 'Your health data is encrypted, private, and under your complete control.',
              },
              {
                title: 'AI-Powered',
                description: 'Advanced algorithms analyze your data for accurate risk assessment.',
              },
              {
                title: 'Easy to Use',
                description: 'Simple, intuitive interface that guides you through every step.',
              },
              {
                title: 'Continuous Support',
                description: 'Chat with Pip anytime for answers and guidance on your health journey.',
              },
            ].map((benefit, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-8">
                <h3 className="text-lg font-bold mb-3">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-gradient-to-r from-primary to-rose-400 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start Your Health Journey?</h2>
          <p className="text-lg mb-8 opacity-90">
            Complete your profile in minutes and unlock your personalized health roadmap
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-primary font-semibold hover:opacity-90 transition-opacity"
          >
            Start Now <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
