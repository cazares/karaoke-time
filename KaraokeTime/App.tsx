/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar, useColorScheme } from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import KaraokeTimeMainScreen from './src/KaraokeTimeMainScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>  
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <KaraokeTimeMainScreen />
    </SafeAreaProvider>
  );
}

export default App;
