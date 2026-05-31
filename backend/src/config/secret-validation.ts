import { ConfigService } from '@nestjs/config';

/**
 * Minimum length for any signing/encryption secret. 32 bytes (256 bits) of
 * random data is the OWASP recommendation for HMAC-SHA256-class secrets,
 * which is what Nest's JwtModule uses by default.
 */
export const MIN_SECRET_LENGTH = 32;

/**
 * Known weak/placeholder values that must never reach a running process.
 * These appear in committed example configs and have historically been
 * silently accepted as fallbacks. We hard-fail on them so a misconfigured
 * deploy crashes loudly instead of trusting a publicly known string.
 */
const FORBIDDEN_SECRETS = new Set<string>([
  'default-secret',
  'refresh-secret',
  'change-me',
  'change-this',
  'changeme',
  'secret',
  'your-super-secret-jwt-key-change-in-production',
  'your-super-secret-jwt-key-minimum-32-chars',
  'your-refresh-token-secret-change-in-production',
  'your-refresh-token-secret-minimum-32-chars',
  'development-jwt-secret-change-in-production',
  'development-refresh-secret',
  'change-this-to-a-secure-random-string-minimum-32-characters',
]);

/**
 * Read a secret from config and assert it is long enough and not a known
 * placeholder. Used at module construction time so the app fails fast at
 * boot rather than at first request.
 */
export function requireSecret(config: ConfigService, key: string): string {
  const raw = config.get<string>(key);

  if (!raw || raw.trim().length === 0) {
    throw new Error(
      `[config] ${key} is required but missing. Generate one with: ` +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }

  const value = raw.trim();

  if (FORBIDDEN_SECRETS.has(value.toLowerCase())) {
    throw new Error(
      `[config] ${key} is set to a known placeholder value. Replace it ` +
        `with a real, randomly generated secret before starting the app.`,
    );
  }

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[config] ${key} must be at least ${MIN_SECRET_LENGTH} characters ` +
        `(got ${value.length}). Generate one with: ` +
        `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }

  return value;
}

/**
 * Validate every required secret up front. Called from bootstrap so that
 * misconfiguration crashes the process before it accepts traffic.
 */
export function validateRequiredSecrets(config: ConfigService): void {
  for (const key of ['JWT_SECRET', 'REFRESH_TOKEN_SECRET']) {
    requireSecret(config, key);
  }
}
