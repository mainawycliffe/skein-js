// Shared location + atomic writer for the persisted dev-state snapshot, used by both `skein dev`
// (cross-restart persistence) and `skein import-langgraph` (writing an imported snapshot). Keeping
// the path constants and the write strategy in one place means the two commands can never diverge
// on *where* or *how* dev state is persisted.

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

/** Persisted dev-state directory + file, relative to the config directory. */
export const STATE_DIR = ".skein";
export const STATE_FILE = "dev-state.json";
/** LangGraph's own local dev-state directory, which `skein` reads to migrate from `langgraph dev`. */
export const LANGGRAPH_DIR = ".langgraph_api";

/** Absolute path to a project's persisted dev-state file (`<configDir>/.skein/dev-state.json`). */
export function devStateFile(configDir: string): string {
  return path.join(configDir, STATE_DIR, STATE_FILE);
}

/**
 * Atomically write already-serialized dev state: a `.tmp` file then `renameSync`, so a crash
 * mid-write can never leave a truncated/corrupt state file. Takes the serialized string (not the
 * snapshot) so `skein dev`'s autosave can compare against its last write and skip unchanged saves.
 */
export function writeDevStateFile(stateFile: string, serialized: string): void {
  mkdirSync(path.dirname(stateFile), { recursive: true });
  const tmp = `${stateFile}.tmp`;
  writeFileSync(tmp, serialized);
  renameSync(tmp, stateFile);
}
