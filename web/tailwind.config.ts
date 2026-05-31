import type { Config } from 'tailwindcss';

// Preset is a plain JS module so it can be consumed by Tailwind's
// own loader (which doesn't run our TS compiler). Declare its type
// inline rather than ship a 3-line .d.ts file just for this import.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const preset = require('./tailwind.preset.js') as Partial<Config>;

const config: Config = {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
};

export default config;
