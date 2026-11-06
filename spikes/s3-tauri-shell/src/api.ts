// Typed wrappers around the Rust commands. The UI never touches storage directly:
// no localStorage / IndexedDB for data (D-005, D-018).
import { invoke } from "@tauri-apps/api/core";

export interface Note {
  id: string;
  version: number;
  text: string;
  created_ms: number;
}

export interface Status {
  store_dir: string;
  records: number;
  open_ms: number;
  frames: number;
  torn_tail: string | null;
  process_start_to_ready_ms: number;
  working_set_mb: number;
}

export const status = () => invoke<Status>("status");
export const listNotes = () => invoke<Note[]>("list_notes");
export const addNote = (text: string) => invoke<Note>("add_note", { text });
export const deleteNote = (id: string, version: number) => invoke<void>("delete_note", { id, version });
