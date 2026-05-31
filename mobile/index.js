import { registerRootComponent } from 'expo';
import App from './src/App';

// `registerRootComponent` calls `AppRegistry.registerComponent('main', () => App)`
// and ensures the environment is set up appropriately whether the app is loaded
// in Expo Go or in a native build.
registerRootComponent(App);
