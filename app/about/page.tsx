import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { Heart, Target, Users, Globe, ArrowRight } from 'lucide-react';

export default function About() {
  return (
    <main className="bg-background">
      <Navbar />

      {/* Header */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-gradient-to-b from-background to-muted/30">
        <div className="mx-auto max-w-7xl">
          <div className="inline-flex items-center gap-2 w-fit px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <span className="text-sm font-medium text-primary">ℹ️ About Us</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">Our Mission</h1>
          <p className="text-xl text-muted-foreground max-w-2xl">
            Empowering people to take control of their health with AI-powered insights and personalized guidance
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16">
            {[
              { label: 'Active Users', value: '50K+' },
              { label: 'Health Risks Detected', value: '10K+' },
              { label: 'Appointments Booked', value: '25K+' },
              { label: 'Countries', value: '15+' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl p-8 text-center">
                <p className="text-4xl font-bold text-primary mb-2">{stat.value}</p>
                <p className="text-muted-foreground font-semibold">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Story */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Our Story</h2>
              <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
                PROSPER was founded by a team of healthcare professionals, data scientists, and patient advocates who believed that everyone deserves access to personalized health guidance.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We combined decades of medical knowledge with cutting-edge AI to create a platform that empowers individuals to understand their health risks and take preventive action before problems develop.
              </p>
            </div>
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1576091160550-2173fe9e0f0d?auto=format&fit=crop&w=800&q=80"
                alt="Our team"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-muted/30">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Our Values</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: Heart,
                title: 'Patient-Centered',
                description: 'Everything we do is guided by what\'s best for patients\' health and wellbeing.',
              },
              {
                icon: Target,
                title: 'Evidence-Based',
                description: 'Our recommendations are based on current medical research and proven protocols.',
              },
              {
                icon: Users,
                title: 'Accessible',
                description: 'We believe everyone deserves quality health guidance regardless of background.',
              },
              {
                icon: Globe,
                title: 'Transparent',
                description: 'We\'re open about how our AI works and how your data is protected.',
              },
            ].map((value, idx) => {
              const Icon = value.icon;
              return (
                <div key={idx} className="bg-card border border-border rounded-2xl p-8">
                  <Icon className="w-10 h-10 text-primary mb-4" />
                  <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Meet Our Team</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Dr. Sarah Chen',
                role: 'Chief Medical Officer',
                image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
              },
              {
                name: 'Michael Rodriguez',
                role: 'AI Research Director',
                image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
              },
              {
                name: 'Emily Watson',
                role: 'Patient Advocacy Lead',
                image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
              },
            ].map((member, idx) => (
              <div key={idx} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-64 object-cover"
                />
                <div className="p-6">
                  <h3 className="font-bold text-lg mb-1">{member.name}</h3>
                  <p className="text-primary font-semibold text-sm">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-gradient-to-r from-primary to-rose-400 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Join Our Mission</h2>
          <p className="text-lg mb-8 opacity-90">
            Be part of the movement to make preventive healthcare accessible to everyone
          </p>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white text-primary font-semibold hover:opacity-90 transition-opacity"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
