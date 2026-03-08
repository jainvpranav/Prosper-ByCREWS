/**
 * lib/supabase.ts
 * Supabase client singleton — replaces the old lib/db.ts (SQL Server / RDS)
 *
 * HIPAA Compliance:
 *  - Credentials read from environment variables — never hardcoded
 *  - Client reuse avoids unnecessary auth churn in dev HMR cycles
 *  - All errors are sanitized before logging (no credential leakage)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Configuration — all values sourced from environment variables
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

// ---------------------------------------------------------------------------
// Singleton client — safe for Next.js dev hot-reload via global cache
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __prosperSupabase: SupabaseClient | undefined;
}

let clientInstance: SupabaseClient | null = null;

/**
 * Returns the shared Supabase client.
 * Creates and caches the client on first call.
 */
export function getSupabase(): SupabaseClient {
  // Re-use existing client in dev HMR cycles via global
  if (process.env.NODE_ENV !== 'production') {
    if (global.__prosperSupabase) {
      return global.__prosperSupabase;
    }
  }

  if (!clientInstance) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
      );
    }

    clientInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Server-side: no session persistence needed
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      global.__prosperSupabase = clientInstance;
    }
  }

  return clientInstance;
}

export { type SupabaseClient };
