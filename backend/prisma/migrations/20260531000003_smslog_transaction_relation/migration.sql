-- ===========================================================================
-- Add the FK from SmsLog.transactionId → Transaction.id.
--
-- The column already existed and carried a UNIQUE constraint, but no FK
-- relationship was declared in the Prisma schema. As a result:
--   * Deleting a Transaction left orphaned SmsLog.transactionId values.
--   * Prisma had no `transaction` field on SmsLog, so the obvious
--     `include: { transaction: true }` on `GET /sms` 404'd at the type
--     layer and the SMS history view couldn't show the linked txn.
--
-- Adding the FK with ON DELETE SET NULL preserves the SMS audit trail
-- when the linked transaction is soft- or hard-deleted, which matches
-- the existing semantics (a deleted transaction shouldn't take its
-- raw-SMS evidence with it).
--
-- IF NOT EXISTS guard so this migration is idempotent across hand-patched
-- environments.
-- ===========================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SmsLog_transactionId_fkey'
  ) THEN
    ALTER TABLE "SmsLog"
      ADD CONSTRAINT "SmsLog_transactionId_fkey"
      FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
