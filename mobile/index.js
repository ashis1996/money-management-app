/**
 * Mobile entry point.
 *
 * Why this file exists:
 *   `package.json` previously declared `main: "expo-router/entry"`, but
 *   the app wires navigation manually with `@react-navigation/stack +
 *   bottom-tabs` in `App.tsx`. The expo-router entry would have tried
 *   to claim routing too, leading to a runtime split-brain — a fresh
 *   developer could spend an afternoon debugging why their stack
 *   doesn't render before noticing the entry mismatch.
 *
 *   Reverting to the standard `registerRootComponent` flow so the app
 *   uses one router (the one in App.tsx) and one only. If we ever want
 *   to migrate to expo-router file-based routing, that becomes an
 *   intentional, scoped change rather than dead config.
 */
import { registerRootComponent } from 'expo';

import App from './src/App';

registerRootComponent(App);
