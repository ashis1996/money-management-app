/**
 * Server-only env access.
 *
 * Centralising it here gives us:
 *   - one place to fail fast if a required server var is missing
 *     (better than discovering at first request)
 *   - a single allowlist of public vars (NEXT_PUBLIC_*) so we don't
 *     accidentally leak server-only state into the browser bundle.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    // Throwing here causes the route handler / server component
    // to render its error boundary; the resulting log line points
    // at the missing variable explicitly.
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'See web/.env.example for the full list.',
    );
  }
  return v;
}

export const ServerEnv = {
  /** Backend base URL the Next.js server uses to reach NestJS. */
  get internalApiUrl(): string {
    return required('INTERNAL_API_URL');
  },

  get isProd(): boolean {
    return process.env.NODE_ENV === 'production';
  },
};

export const PublicEnv = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'MoneyMind',
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
};
