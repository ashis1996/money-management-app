import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `cn` — concatenate Tailwind class names safely. `clsx` handles
 * conditionals; `twMerge` deduplicates conflicting Tailwind utilities
 * (e.g. `px-4` + `px-6` -> `px-6`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
