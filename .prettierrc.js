/**
 * Prettier baseline.
 *
 * Single source of truth for whitespace / quoting / line length across
 * backend, mobile, and shared. The pre-commit hook runs `prettier
 * --write` over staged files so contributors don't have to think about
 * any of this; lint just enforces what Prettier produced.
 */
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  arrowParens: 'always',
  endOfLine: 'lf',
};
