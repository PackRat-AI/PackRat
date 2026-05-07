-- Reset ETL jobs stuck in 'running' state for more than 3 hours.
-- 3h accounts for large first-time imports (~500K rows + embedding generation).
-- Run manually when zombie jobs are detected.
UPDATE etl_jobs
SET status = 'failed', completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '3 hours';
