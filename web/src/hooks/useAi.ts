'use client';

import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/lib/api';

/**
 * One-shot AI Q&A mutation. Each call sends a prompt and resolves
 * with the assistant's answer. The Coach screen owns the conversation
 * state itself — we don't cache across messages because the answer
 * is intentionally non-deterministic.
 */
export function useAskAi() {
  return useMutation({
    mutationFn: (vars: { query: string; context?: Record<string, unknown> }) =>
      aiApi.ask(vars.query, vars.context),
  });
}
