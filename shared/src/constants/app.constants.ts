// Application constants

export const DEFAULT_CATEGORIES = [
  { name: 'FOOD_DINING', icon: 'restaurant', color: '#FF6B6B' },
  { name: 'SHOPPING', icon: 'shopping-bag', color: '#4ECDC4' },
  { name: 'TRANSPORT', icon: 'car', color: '#45B7D1' },
  { name: 'TRAVEL', icon: 'plane', color: '#96CEB4' },
  { name: 'ENTERTAINMENT', icon: 'film', color: '#FFEAA7' },
  { name: 'UTILITIES', icon: 'zap', color: '#DDA0DD' },
  { name: 'HEALTHCARE', icon: 'heart', color: '#FF7675' },
  { name: 'EDUCATION', icon: 'book', color: '#74B9FF' },
  { name: 'FUEL', icon: 'droplet', color: '#FD79A8' },
  { name: 'GROCERY', icon: 'shopping-cart', color: '#00B894' },
  { name: 'SUBSCRIPTION', icon: 'repeat', color: '#6C5CE7' },
  { name: 'INCOME', icon: 'trending-up', color: '#00CEC9' },
  { name: 'TRANSFER', icon: 'arrow-right', color: '#636E72' },
  { name: 'OTHER', icon: 'more-horizontal', color: '#B2BEC3' },
];

export const SUBSCRIPTION_DEFAULTS = {
  DETECTION_THRESHOLD: 3,
  MIN_OCCURRENCES: 2,
  CYCLE_VARIANCE_TOLERANCE: 0.1,
  AMOUNT_VARIANCE_TOLERANCE: 0.05,
  COMMON_CYCLES: ['MONTHLY', 'YEARLY', 'WEEKLY', 'QUARTERLY'],
};
