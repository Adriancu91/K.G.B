// Typed calls to the Rust command layer (app/src-tauri/src/main.rs).
// The UI keeps no data of its own: no localStorage, no IndexedDB.
import { invoke } from "@tauri-apps/api/core";

export type Theme = "system" | "light" | "dark";
export type Density = "compact" | "normal" | "comfortable";
export type ModuleStatus = "stable" | "beta" | "experimental" | "disabled";

export interface Layout {
  sidebar_width: number;
  sidebar_collapsed: boolean;
}

export interface HomePanel {
  id: string;
  w: number;
  h: number;
}

export interface Settings {
  theme: Theme;
  density: Density;
  language: "ro";
  profile: string;
  layout: Layout;
  /** Start page panels (Etapa 4, D-047). */
  home: { panels: HomePanel[] };
}

export interface Profile {
  id: string;
  name: string;
}

export interface SettingsReply {
  settings: Settings;
  version: number;
  profiles: Profile[];
}

export interface Owner {
  display_name: string;
  created_ms: number;
  version: number;
}

export interface AppInfo {
  app_version: string;
  core_version: string;
  pre_release: boolean;
  startup_error: string | null;
  workspace: { id: string; name: string; dir: string } | null;
  owner: Owner | null;
  device_fingerprint: string | null;
  recovery: { records: number; open_ms: number; note: string | null } | null;
  ready_ms: number;
  log_dir: string;
}

export interface PermissionView {
  id: string;
  description: string;
  granted: boolean;
}

export interface ModuleView {
  id: string;
  name: string;
  description: string;
  version: string;
  status: ModuleStatus;
  permissions: PermissionView[];
  on_disable: string;
  compatible: boolean;
  enabled: boolean;
  records: number;
}

export interface Planned {
  id: string;
  name: string;
  stage: string;
}

export interface ModulesReply {
  modules: ModuleView[];
  planned: Planned[];
  hidden: string[];
}

export interface Diagnostics {
  report: string;
  audit: Array<Record<string, unknown>>;
  memory_mb: number;
}

export type BackupReason = "manual" | "before_migration" | "before_format_upgrade";

export interface BackupView {
  id: string;
  meta: {
    workspace_name: string;
    reason: BackupReason;
    detail: string;
    created_ms: number;
    core_version: string;
    records: number;
  };
}

export interface DataInfo {
  format: number;
  disk_bytes: number;
  leftover_bytes: number;
  backups: BackupView[];
  workspaces: Array<{ id: string; name: string; dir: string }>;
  current: string;
}

export interface NotificationView {
  id: string;
  version: number;
  module: string;
  titlu: string;
  text: string;
  nivel: "info" | "atentie" | "urgent";
  creat_ms: number;
  citit_ms: number | null;
}

export const api = {
  appInfo: () => invoke<AppInfo>("app_info"),
  getSettings: () => invoke<SettingsReply>("get_settings"),
  saveSettings: (settings: Settings, version: number) => invoke<number>("save_settings", { settings, version }),
  renameOwner: (name: string, version: number) => invoke<number>("rename_owner", { name, version }),
  renameWorkspace: (name: string) => invoke<void>("rename_workspace", { name }),
  listModules: () => invoke<ModulesReply>("list_modules"),
  enableModule: (id: string, grant: string[]) => invoke<void>("enable_module", { id, grant }),
  disableModule: (id: string) => invoke<void>("disable_module", { id }),
  setModuleVisible: (id: string, visible: boolean) => invoke<void>("set_module_visible", { id, visible }),
  moduleCall: <T>(id: string, command: string, args: Record<string, unknown> = {}) =>
    invoke<T>("module_call", { id, command, args }),
  /** Hands a file the user picked to a module's `import` command. */
  importFile: <T>(id: string, path: string) => invoke<T>("module_import_file", { id, path }),
  /** Same, for another module command with extra arguments (e.g. the bank account). */
  importFileWith: <T>(id: string, path: string, command: string, args: Record<string, unknown>) =>
    invoke<T>("module_import_file_with", { id, path, command, args }),
  notifications: () => invoke<{ items: NotificationView[]; unread: number }>("notifications_list"),
  /** Reminders round; `azi` is the local date (YYYY-MM-DD). Returns how many are new. */
  remindersTick: (azi: string) => invoke<number>("reminders_tick", { azi }),
  notificationRead: (id: string) => invoke<void>("notification_read", { id }),
  notificationsReadAll: () => invoke<number>("notifications_read_all"),
  notificationsClearRead: () => invoke<number>("notifications_clear_read"),
  diagnostics: () => invoke<Diagnostics>("diagnostics"),
  exportDiagnostics: () => invoke<string>("export_diagnostics"),
  dataInfo: () => invoke<DataInfo>("data_info"),
  createBackup: () => invoke<string>("create_backup"),
  verifyBackup: (id: string) => invoke<number>("verify_backup", { id }),
  restoreBackup: (id: string) => invoke<void>("restore_backup", { id }),
  openWorkspace: (id: string) => invoke<void>("open_workspace", { id }),
  compactNow: () => invoke<{ steps: number; bytes_freed: number; ms: number }>("compact_now"),
  collectFiles: () => invoke<{ blobs_retired: number; bytes_retired: number }>("collect_files"),
  purgeLeftovers: () => invoke<{ files: number; bytes: number }>("purge_leftovers"),
};

/// Errors from Rust arrive as plain strings (already in Romanian).
export function message(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
}
