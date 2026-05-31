import { HealthScoreColors } from '../styles/theme';

export function getHealthColor(score: number): string {
  if (score >= 85) return HealthScoreColors.excellent;
  if (score >= 70) return HealthScoreColors.good;
  if (score >= 55) return HealthScoreColors.fair;
  return HealthScoreColors.poor;
}

export function getHealthRating(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  return 'Needs Work';
}
