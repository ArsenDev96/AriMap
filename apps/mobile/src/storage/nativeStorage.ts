import { SQLiteStorage } from "expo-sqlite/kv-store";
import type { KeyValueStorage } from "@/core/progress/storage";

/** The SQLite file the app's saved progress lives in (in the app's own data, removed with the app). */
const DATABASE_NAME = "arimap-progress.db";

let store: SQLiteStorage | null = null;

/**
 * The native store for saved progress, for src/core/progress/storage.ts: the same keys ("arimap:state", and its
 * backup) and the same version 2 save as the website's localStorage, read and validated by the same code.
 *
 * SQLite's synchronous calls are used, as localStorage's are on the web: the save is read before the first screen
 * renders, so no other screen shows first, and each state is written as it is made. A store that fails to open,
 * read or write is handled there as on the web: the game keeps working in memory.
 */
export function nativeStorage(): KeyValueStorage {
  store ??= new SQLiteStorage(DATABASE_NAME);
  const kv = store;
  return {
    getItem: (key) => kv.getItemSync(key),
    setItem: (key, value) => kv.setItemSync(key, value),
  };
}
