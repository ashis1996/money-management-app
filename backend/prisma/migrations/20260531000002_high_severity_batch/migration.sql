-- ===========================================================================
-- High-severity correctness batch
-- ---------------------------------------------------------------------------
-- 1. Add `User.tokenVersion`. Every JWT now embeds this counter so a
--    logout-everywhere can invalidate all outstanding access tokens by
--    incrementing it. Defaults to 0 for existing rows so already-issued
--    tokens (which carry no `tv` claim) keep working until they expire.
--
-- 2. Add a real FK from `BehavioralPattern.userId` to `User.id`. The model
--    previously had only an index, so rows orphaned silently when a user
--    was deleted. Cascade-delete matches the rest of the schema.
-- ===========================================================================

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- The previous schema had no FK constraint on BehavioralPattern.userId.
-- Add it now with cascade-delete so a user's patterns disappear when the
-- user does. IF NOT EXISTS guard keeps the migration idempotent across
-- environments that may have been hand-patched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BehavioralPattern_userId_fkey'
  ) THEN
    ALTER TABLE "BehavioralPattern"
      ADD CONSTRAINT "BehavioralPattern_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
