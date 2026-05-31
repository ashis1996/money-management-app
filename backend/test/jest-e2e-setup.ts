/**
 * Global setup for end-to-end tests.
 *
 * The application now refuses to construct the JwtModule, JwtStrategy or
 * AuthService without a real JWT_SECRET / REFRESH_TOKEN_SECRET (length >=
 * 32 and not on the placeholder denylist). Production behaviour is great;
 * test ergonomics need a deterministic default. This file injects test-only
 * secrets that satisfy the validators before AppModule is imported.
 *
 * The values are obviously test-only ("dev_test_..." prefix) and are not
 * shared with any deployed environment.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  'dev_test_jwt_secret_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET ||
  'dev_test_refresh_secret_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://test:test@localhost:5432/test?schema=public';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
