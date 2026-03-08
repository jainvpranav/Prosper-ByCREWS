/**
 * lib/cardiac-api.ts
 * Typed client wrapper for calling the /api/predict endpoint.
 *
 * Usage (from any React component or hook):
 *   import { predictCardiacRisk } from '@/lib/cardiac-api';
 *   const result = await predictCardiacRisk({ age: 45, bmi: 28.5, ... });
 */

import type {
  CardiacPredictRequest,
  CardiacPredictResponse,
} from '@/lib/types/cardiac';

/**
 * Calls the cardiac risk prediction API and returns a typed response.
 *
 * @throws Error with a user-friendly message on failure
 */
export async function predictCardiacRisk(
  input: CardiacPredictRequest,
): Promise<CardiacPredictResponse> {
  const response = await fetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `Prediction failed (HTTP ${response.status})`,
    );
  }

  const data: CardiacPredictResponse = await response.json();
  return data;
}
