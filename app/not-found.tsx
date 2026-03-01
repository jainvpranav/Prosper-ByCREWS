import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="bg-background min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-9xl font-black text-primary" style={{ fontWeight: 800 }}>
          404
        </p>
        <h1 className="text-3xl font-bold mt-6 mb-4">Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </main>
  );
}
