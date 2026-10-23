import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GameProvider } from "../game/GameProvider";
import { useReducedMotion } from "../theme/motion";
import { colors } from "../theme/tokens";

/**
 * The app's navigation: one stack (Home → a continent's levels → a level), with the system's Back going back a
 * screen. Each screen draws its own header (the app's name or a back action, and the language switch).
 */
export default function RootLayout() {
  const reducedMotion = useReducedMotion();
  return (
    <SafeAreaProvider>
      <GameProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: reducedMotion ? "none" : "default",
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </GameProvider>
    </SafeAreaProvider>
  );
}
