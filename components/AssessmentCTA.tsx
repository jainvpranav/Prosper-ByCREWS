'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export function AssessmentCTA() {
  const { user, loading } = useAuth();

  const href = loading
    ? '#'
    : user
      ? (user.profileComplete ? '/risk-assessment' : '/profile')
      : '/login';

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-20 md:py-32 bg-gradient-to-r from-primary to-rose-400 text-white">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          Ready to Transform Your Health?
        </h2>
        <p className="text-lg mb-8 opacity-90">
          Join thousands of people taking control of their health with PROSPER
        </p>
        <Link
          href={href}
          className="inline-block px-8 py-4 rounded-xl bg-white text-primary font-semibold hover:opacity-90 transition-opacity"
        >
          Start Your Free Assessment
        </Link>
      </div>
    </section>
  );
}
