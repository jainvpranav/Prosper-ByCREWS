import { Navbar } from "@/components/Navbar";
import { AssessmentCTA } from "@/components/AssessmentCTA";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Bot,
  Activity,
  Calendar,
  Bell,
  Brain,
  Lock,
  Smartphone,
  TrendingUp,
} from "lucide-react";

export default function Home() {
  return (
    <main className="bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            {/* Left Content */}
            <div className="flex-1 flex flex-col">
              <div className="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <span className="text-sm font-medium text-primary">
                  🎯 Advanced Health Intelligence
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
                <span className="text-foreground">Your Health, </span>
                <span className="bg-gradient-to-r from-primary to-rose-400 bg-clip-text text-transparent">
                  Reimagined
                </span>
              </h1>

              <p className="text-lg text-muted-foreground mb-8 max-w-lg leading-relaxed">
                Get personalized health guidance powered by AI. Assess your
                health risks, receive tailored recommendations, and connect with
                healthcare providers seamlessly.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link
                  href="/profile"
                  className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  Start Your Journey <ArrowRight className="w-4 h-4" />
                </Link>
                <button className="px-8 py-3 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors">
                  Learn More
                </button>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4 text-primary" />
                  HIPAA Compliant
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Heart className="w-4 h-4 text-primary" />
                  100% Private
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Bot className="w-4 h-4 text-primary" />
                  AI-Powered
                </div>
              </div>
            </div>

            {/* Right Hero Image */}
            <div className="flex-1 relative">
              <div className="absolute left-50 -top-25 max-w-xs hidden lg:block">
                <Heart className="w-50 h-50 text-rose-500" />
              </div>

              {/* Floating Cards */}
              <div className="absolute top-10 -left-8 bg-card border border-border rounded-2xl p-4 shadow-lg max-w-xs hidden lg:block">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <p className="text-sm font-semibold">Health Trend</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your overall score improved by 12% this month
                </p>
              </div>

              <div className="absolute bottom-10 -right-8 bg-card border border-border rounded-2xl p-4 shadow-lg max-w-xs hidden lg:block">
                <p className="text-sm font-semibold mb-2">Next Appointment</p>
                <p className="text-xs text-muted-foreground">
                  Dr. Sarah Chen • March 15, 2025 at 2:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Powerful Features for Your Health
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to take control of your health journey
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Activity,
                title: "Health Assessment",
                description:
                  "Complete health screening with AI-powered risk analysis",
                color: "from-primary/20 to-primary/5",
              },
              {
                icon: Bot,
                title: "AI Companion",
                description: "Chat with Pip, your personal health AI assistant",
                color: "from-rose-400/20 to-rose-400/5",
              },
              {
                icon: Heart,
                title: "Risk Detection",
                description: "Early identification of potential health risks",
                color: "from-pink-400/20 to-pink-400/5",
              },
              {
                icon: TrendingUp,
                title: "Health Projections",
                description:
                  "See your potential health outcomes with personalized tips",
                color: "from-orange-400/20 to-orange-400/5",
              },
              {
                icon: Calendar,
                title: "Easy Booking",
                description:
                  "Schedule appointments with healthcare providers instantly",
                color: "from-blue-400/20 to-blue-400/5",
              },
              {
                icon: Bell,
                title: "Smart Reminders",
                description: "Stay on track with personalized health reminders",
                color: "from-purple-400/20 to-purple-400/5",
              },
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div
                  key={idx}
                  className={`bg-gradient-to-br ${feature.color} border border-border rounded-2xl p-8 hover:shadow-lg transition-shadow`}
                >
                  <Icon className="w-10 h-10 text-primary mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-muted/30">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How PROSPER Works
            </h2>
            <p className="text-xl text-muted-foreground">
              Your journey to better health in just a few simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                num: "1",
                title: "Complete Your Profile",
                desc: "Tell us about your health and lifestyle",
              },
              {
                num: "2",
                title: "Get Risk Analysis",
                desc: "AI analyzes your health data",
              },
              {
                num: "3",
                title: "Receive Guidelines",
                desc: "Get personalized care recommendations",
              },
              {
                num: "4",
                title: "Take Action",
                desc: "Book appointments and start improving",
              },
            ].map((step, idx) => (
              <div key={idx} className="relative">
                <div className="bg-card border border-border rounded-2xl p-8 text-center h-full flex flex-col justify-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-rose-400 text-white font-bold flex items-center justify-center mx-auto mb-4 text-lg">
                    {step.num}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm">{step.desc}</p>
                </div>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-primary/30 transform -translate-y-1/2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Right: Content */}
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Your Privacy, Our Priority
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                We take your health data seriously. All your information is
                encrypted, HIPAA-compliant, and never shared with third parties.
              </p>

              <div className="space-y-4">
                {[
                  "End-to-end encryption for all communications",
                  "HIPAA compliant data storage",
                  "Regular security audits and compliance checks",
                  "Your data, your control",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section — login-aware */}
      <AssessmentCTA />

      {/* Footer */}
      <footer className="bg-muted border-t border-border px-4 sm:px-6 lg:px-8 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 font-bold text-primary mb-4">
                <Heart className="w-5 h-5" />
                PROSPER
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered preventive healthcare for everyone.
              </p>
            </div>

            {[
              {
                title: "Product",
                links: ["Features", "How It Works", "Pricing"],
              },
              { title: "Company", links: ["About", "Blog", "Contact"] },
              { title: "Legal", links: ["Privacy", "Terms", "HIPAA"] },
            ].map((col, idx) => (
              <div key={idx}>
                <h4 className="font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2025 PROSPER Health. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground mt-4 md:mt-0">
              This is a demonstration. Please consult with healthcare
              professionals for medical advice.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
