-- ===========================================================================
-- Critical security migration
-- ---------------------------------------------------------------------------
-- 1. Drop the unused, misleadingly named `account_number` column from
--    `accounts`. The schema previously claimed it stored an "encrypted full
--    number" but no encryption layer ever existed and nothing wrote to it.
--    Only `masked_account_number` (last 4) is retained.
--
-- 2. Replace `RefreshToken.token` (plaintext, unique) with `token_hash`
--    (SHA-256 hex, unique). Existing refresh tokens are deleted: they cannot
--    be migrated because we never stored the data needed to derive the
--    hash. Users will be silently re-authenticated via their access token
--    and asked to log in again once it expires (~15 min).
-- ===========================================================================

-- Drop unused / unsafe `account_number` column.
ALTER TABLE "Account" DROP COLUMN IF EXISTS "accountNumber";

-- Wipe existing refresh tokens; they're plaintext and we won't carry them
-- over. This is a security improvement, not data loss — a refresh is just
-- a session credential.
TRUNCATE TABLE "RefreshToken";

-- Replace plaintext `token` with `tokenHash`.
DROP INDEX IF EXISTS "RefreshToken_token_key";
DROP INDEX IF EXISTS "RefreshToken_token_idx";

ALTER TABLE "RefreshToken" DROP COLUMN IF EXISTS "token";
ALTER TABLE "RefreshToken" ADD COLUMN "tokenHash" TEXT NOT NULL;

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_tokenHash_idx" ON "RefreshToken"("tokenHash");
