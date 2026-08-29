-- Prevent two print-agent processes from printing the same pending bar job.
ALTER TABLE bar_print_jobs
  ADD COLUMN IF NOT EXISTS print_claim_token VARCHAR(100) NULL AFTER terminal_name,
  ADD COLUMN IF NOT EXISTS print_claimed_at DATETIME NULL AFTER print_claim_token;
