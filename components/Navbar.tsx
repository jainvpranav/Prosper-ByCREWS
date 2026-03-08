'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Heart, LogOut } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();

  // Determine if we're on app routes or public routes
  const isAppRoute = pathname.startsWith('/dashboard') || 
                     pathname.startsWith('/appointments') || 
                     pathname.startsWith('/risk-assessment') ||
                     pathname.startsWith('/profile');

  const publicLinks = [
    { href: '/', label: 'Home' },
    { href: '/features', label: 'Features' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/about', label: 'About' },
  ];

  const appLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/appointments', label: 'Appointments' },
    { href: '/profile', label: 'My Profile' },
  ];

  const links = isAppRoute ? appLinks : publicLinks;

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-primary hover:opacity-80 transition-opacity">
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-rose-400 flex items-center justify-center">
              <Heart className="w-4 h-4 text-white" fill="white" />
            </div>
            <span className="hidden sm:inline text-lg">PROSPER</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === link.href
                    ? 'text-primary'
                    : 'text-foreground/70 hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />

            {!loading && !user && !isAppRoute && (
              <div className="hidden md:flex gap-3">
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Start Your Journey
                </Link>
              </div>
            )}

            {user && (
              <div className="hidden md:flex items-center gap-3">
                <span className="text-xs text-muted-foreground max-w-[140px] truncate">
                  {user.email}
                </span>
                <button
                  onClick={logout}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border py-4 space-y-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/70 hover:bg-muted'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            {!loading && !user && (
              <div className="border-t border-border pt-3 space-y-2">
                <Link
                  href="/login"
                  className="block px-4 py-2 rounded-lg text-sm font-medium border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="block px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Start Your Journey
                </Link>
              </div>
            )}

            {user && (
              <div className="border-t border-border pt-3 space-y-2">
                <p className="px-4 text-xs text-muted-foreground truncate">{user.email}</p>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="w-full px-4 py-2 rounded-lg text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
