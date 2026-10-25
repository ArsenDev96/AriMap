import { getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/core/i18n/locales";
import { appReducer, type AppAction, type AppState } from "@/core/progress/appState";
import { loadAppState, saveAppState, STORAGE_KEY, type KeyValueStorage } from "@/core/progress/storage";
import { nativeStorage } from "../storage/nativeStorage";

interface Game {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const GameContext = createContext<Game | null>(null);

/** The device's first language AriMap speaks, if any (Eastern Armenian or English); English otherwise. */
function deviceLocale(): Locale {
  for (const { languageCode } of getLocales()) if (isLocale(languageCode)) return languageCode;
  return DEFAULT_LOCALE;
}

/**
 * Whether the save could be read as the app started. If not (the database busy or failing), the game is played in
 * memory and never saved: a fresh game written over a save that is only unreadable for a moment would lose every
 * level's progress. The next launch reads it again.
 */
let storeReadable = true;

/**
 * The saved game, read once before the first screen renders. A first launch (no save yet) starts in the device's
 * language; after that the language is the player's choice, kept in the save like everything else.
 */
function initialState(storage: KeyValueStorage): AppState {
  let firstLaunch = false;
  try {
    firstLaunch = storage.getItem(STORAGE_KEY) === null;
  } catch {
    // Unreadable store: loadAppState starts afresh in memory, in the default language, and nothing is saved over
    // the store (see GameProvider).
    storeReadable = false;
  }
  const state = loadAppState(storage);
  return firstLaunch ? appReducer(state, { type: "setLocale", locale: deviceLocale() }) : state;
}

/**
 * The game's state, the website's own (src/core/progress/appState.ts), shared by every screen. Every action goes
 * through the same reducer as on the website, and every new state is saved as it is made, in the same format.
 */
export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, nativeStorage(), initialState);

  useEffect(() => {
    if (storeReadable) saveAppState(nativeStorage(), state);
  }, [state]);

  const game = useMemo(() => ({ state, dispatch }), [state]);
  return <GameContext.Provider value={game}>{children}</GameContext.Provider>;
}

export function useGame(): Game {
  const game = useContext(GameContext);
  if (!game) throw new Error("useGame must be used inside GameProvider");
  return game;
}
