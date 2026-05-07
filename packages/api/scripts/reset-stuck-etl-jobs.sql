-- Reset ETL jobs stuck in 'running' state for more than 30 minutes.
-- Run manually when zombie jobs are detected.
UPDATE etl_jobs
SET status = 'failed', completed_at = NOW()
WHERE status = 'running'
  AND started_at < NOW() - INTERVAL '30 minutes';
