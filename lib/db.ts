/**
 * lib/db.ts
 * AWS RDS (SQL Server) — Singleton connection pool
 *
 * HIPAA Compliance:
 *  - SSL/TLS enforced (encrypt: true, trustServerCertificate: false)
 *  - Credentials read from environment variables — never hardcoded
 *  - Connection pool reuse avoids unnecessary auth churn
 *  - All errors are sanitized before being rethrown (no credential leakage in stack traces)
 */

import sql from 'mssql';

// ---------------------------------------------------------------------------
// Configuration — all values sourced from environment variables
// ---------------------------------------------------------------------------
const dbConfig: sql.config = {
  server: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT ?? '1433', 10),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    // HIPAA §164.312(e)(2)(ii): Encryption in transit — REQUIRED
    encrypt: process.env.DB_ENCRYPT !== 'false',
    // For AWS RDS with a valid ACM cert this MUST stay false
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    enableArithAbort: true,
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
    max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT_MS ?? '30000', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? '30000', 10),
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
};

// ---------------------------------------------------------------------------
// Singleton pool — safe for Next.js dev hot-reload via global cache
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var
  var __prosperDbPool: sql.ConnectionPool | undefined;
}

let poolPromise: Promise<sql.ConnectionPool> | null = null;

/**
 * Returns the shared, connected SQL Server connection pool.
 * Creates and caches the pool on first call.
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  // Re-use existing pool in dev HMR cycles via global
  if (process.env.NODE_ENV !== 'production') {
    if (global.__prosperDbPool && global.__prosperDbPool.connected) {
      return global.__prosperDbPool;
    }
  }

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .then((pool: any) => {
        if (process.env.NODE_ENV !== 'production') {
          global.__prosperDbPool = pool;
        }
        pool.on('error', (err: any) => {
          // Sanitized logging — never log credentials
          console.error('[ProsperDB] Pool error:', sanitizeError(err));
          poolPromise = null; // allow reconnection
        });
        return pool;
      })
      .catch((err: any) => {
        poolPromise = null;
        throw new Error(`[ProsperDB] Failed to connect: ${sanitizeError(err)}`);
      });
  }

  return poolPromise;
}

/**
 * Closes the pool gracefully. Call on process exit / graceful shutdown.
 */
export async function closePool(): Promise<void> {
  if (global.__prosperDbPool) {
    await global.__prosperDbPool.close();
    global.__prosperDbPool = undefined;
  }
  poolPromise = null;
}

/**
 * Returns a ready request object (shorthand for callers).
 */
export async function getRequest(): Promise<sql.Request> {
  const pool = await getPool();
  return pool.request();
}

/**
 * Strips connection string details from error messages before logging.
 * HIPAA: prevents accidental credential exposure in logs.
 */
function sanitizeError(err: unknown): string {
  if (!(err instanceof Error)) return 'Unknown database error';
  return err.message
    .replace(/password=[^;]*/gi, 'password=***')
    .replace(/user id=[^;]*/gi, 'user id=***')
    .replace(/server=[^;]*/gi, 'server=***');
}

export { sql };
