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

/** A start-page panel placed freely (7.4d): `x`, `w` in thousandths of the page width; `y`, `h` in pixels. */
export interface HomePanel {
  id: string;
  x: number;
  y: number;
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
  home: { panels: HomePanel[]; amanate: Record<string, string> };
}

export interface Profile {
  id: string;
  name: string;
}

export interface SettingsReply {
  settings: Settings;
  version: number;
  profiles: Profile[];
  /** The start page for this person's role (what „Revino la implicit” brings back). */
  home_implicit: Settings["home"];
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
  /** What the person on this PC may do per module (Etapa 6, D-056). */
  access: Record<string, Access>;
  /** Whether the person on this PC manages modules and the organization. */
  admin: boolean;
}

export type Access = "niciunul" | "citire" | "scriere";
export const ACCESS_LABEL: Record<Access, string> = { niciunul: "fără acces", citire: "doar citire", scriere: "scriere" };

export interface Role {
  id: string;
  name: string;
  builtin: boolean;
  admin: boolean;
  default: Access;
  modules: Record<string, Access>;
  version: number;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  devices: string[];
  active: boolean;
  created_ms: number;
  version: number;
}

export interface OrgReply {
  organization: { name: string; created_ms: number; version: number } | null;
  current: { member: Member; role: Role } | null;
  roles: Role[];
  members: Member[];
  modules: Array<[string, string]>;
  fingerprint: string;
  owner_name: string | null;
  invites: InviteView[];
  pending: PendingDevice[];
  registry_problems: string[];
}

export interface ConflictView {
  id: string;
  modul: string | null;
  colectie: string;
  inregistrare: string;
  camp: string | null;
  aici: string;
  venit: string;
  provizoriu: "aici" | "venit";
  poate_decide: boolean;
}

export interface PeerView {
  key: string;
  fingerprint: string;
  label: string;
  member: string;
  addr: string | null;
  ok_ms: number | null;
  path: "direct" | "relay" | null;
  tried_ms: number | null;
  error: string | null;
}

export interface NetStatus {
  pornita: boolean;
  motiv: string | null;
  relay: string;
  port: number;
  amprenta: string;
  peers: PeerView[];
  ultima_runda_ms: number | null;
  fisiere_lipsa: number;
  dispozitive: DeviceRow[];
  conflicte: number;
}

export interface DeviceRow {
  fingerprint: string;
  label: string;
  member: string;
  acesta: boolean;
  revocat: boolean;
  persoana_scoasa: boolean;
  ok_ms: number | null;
  path: string | null;
}

export interface SyncOutcome {
  key: string;
  label: string;
  member: string;
  path: "direct" | "relay" | "unknown" | null;
  summary: { create: number; actualizate: number; refuzate: number; conflicte: number; ascunse: number; completate: number } | null;
  error: string | null;
  files: { primite: number; lipsa: number; erori: string[] } | null;
}

export interface Source {
  id: string;
  nume: string;
  url: string;
  tip: string;
  termeni: string;
  termeni_url: string;
  licenta: string;
  verificat: string;
  activa: boolean;
  aprobata_de: string;
  note: string;
  version: number;
}

export interface SourceInput {
  id?: string;
  nume: string;
  url: string;
  tip: string;
  termeni: string;
  termeni_url: string;
  licenta: string;
  verificat: string;
  note: string;
  version: number;
}

export interface InviteView {
  id: string;
  member: string;
  expires_ms: number;
  stare: "activă" | "folosită" | "expirată";
}

export interface PendingDevice {
  id: string;
  member_id: string;
  member: string;
  label: string;
  fingerprint: string;
  received_ms: number;
  version: number;
}

export interface JoinRequest {
  code: string;
  info: { org_name: string; member: string; expires_ms: number; admin_fingerprint: string };
  fingerprint: string;
}

export interface RoleInput {
  id?: string;
  name: string;
  default: Access;
  modules: Record<string, Access>;
  version: number;
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
  org: () => invoke<OrgReply>("org_info"),
  orgCreate: (name: string, admin: string) => invoke<void>("org_create", { name, admin }),
  orgRename: (name: string, version: number) => invoke<number>("org_rename", { name, version }),
  memberAdd: (name: string, role: string) => invoke<string>("org_member_add", { name, role }),
  memberUpdate: (id: string, name: string, role: string, version: number) =>
    invoke<number>("org_member_update", { id, name, role, version }),
  memberRemove: (id: string, version: number) => invoke<void>("org_member_remove", { id, version }),
  roleSave: (role: RoleInput) => invoke<string>("org_role_save", { role }),
  roleDelete: (id: string) => invoke<void>("org_role_delete", { id }),
  inviteCreate: (member: string, hours: number) =>
    invoke<{ id: string; code: string; member: string; expires_ms: number }>("invite_create", { member, hours }),
  conflicts: () => invoke<{ items: ConflictView[]; modules: Array<[string, string]> }>("conflicts_list"),
  conflictDecide: (id: string, keepHere: boolean) => invoke<void>("conflict_decide", { id, keepHere }),
  deviceRevoke: (fingerprint: string) => invoke<void>("org_device_revoke", { fingerprint }),
  sources: () => invoke<{ items: Source[]; kinds: Array<[string, string]>; poate_modifica: boolean }>("sources_list"),
  sourceSave: (source: SourceInput) => invoke<string>("source_save", { source }),
  sourceSetActive: (id: string, active: boolean) => invoke<void>("source_set_active", { id, active }),
  sourceDelete: (id: string) => invoke<void>("source_delete", { id }),
  netStatus: () => invoke<NetStatus>("net_status"),
  netSetRelay: (relay: string) => invoke<void>("net_set_relay", { relay }),
  syncNow: () => invoke<SyncOutcome[]>("sync_now"),
  inviteCancel: (id: string) => invoke<void>("invite_cancel", { id }),
  inviteAnswer: (code: string) => invoke<JoinRequest>("invite_answer", { code }),
  requestReceive: (code: string) => invoke<PendingDevice>("request_receive", { code }),
  requestApprove: (id: string) => invoke<void>("request_approve", { id }),
  requestRefuse: (id: string) => invoke<void>("request_refuse", { id }),
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
