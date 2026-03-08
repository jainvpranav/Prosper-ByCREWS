-- Add jsonb columns to store the full ML API responses
ALTER TABLE public.risk_assessments
  ADD COLUMN IF NOT EXISTS cardio_result jsonb NULL,
  ADD COLUMN IF NOT EXISTS cancer_results jsonb NULL;

COMMENT ON COLUMN public.risk_assessments.cardio_result  IS 'Full JSON response from /predict API';
COMMENT ON COLUMN public.risk_assessments.cancer_results IS 'Full JSON response from /cancer/all API';
