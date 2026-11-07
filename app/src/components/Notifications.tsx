// Notification centre (Etapa 4, step 4.4; D-043): a bell with the unread
// count; the panel lists what modules sent, newest first. Text is shown as
// plain text (React escapes it), never as HTML.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, message, type NotificationView } from "../api";

const LEVEL: Record<NotificationView["nivel"], string> = { info: "Info", atentie: "Atenție", urgent: "Urgent" };
const POLL_MS = 5000;
const REMIND_MS = 60000;

/** Today on the user's computer, as YYYY-MM-DD. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function when(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NotificationBell(props: { moduleName: (id: string) => string; onError: (e: string | null) => void }) {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const { onError } = props;

  const load = useCallback(async () => {
    try {
      const r = await api.notifications();
      setItems(r.items);
      setUnread(r.unread);
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);

  // New notifications come from module calls anywhere in the app: refresh
  // often (a cheap local read) and when the window regains focus.
  // Reminders (step 4.5): at start and every minute while the app runs.
  useEffect(() => {
    const tick = async () => {
      try {
        if ((await api.remindersTick(today())) > 0) await load();
      } catch (e) {
        onError(message(e));
      }
    };
    void tick();
    const t = window.setInterval(() => void tick(), REMIND_MS);
    return () => window.clearInterval(t);
  }, [load, onError]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const act = async (f: () => Promise<unknown>) => {
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    }
    await load();
  };

  return (
    <div className="notif" ref={panel}>
      <button
        className="icon bell"
        aria-label={unread ? `Notificări: ${unread} necitite` : "Notificări"}
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) void load();
        }}
      >
        🔔{unread > 0 && <span className="count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Centrul de notificări">
          <div className="row">
            <strong className="grow">Notificări</strong>
            <button className="link" disabled={unread === 0} onClick={() => void act(api.notificationsReadAll)}>
              Marchează toate citite
            </button>
            <button className="link" disabled={!items.some((n) => n.citit_ms)} onClick={() => void act(api.notificationsClearRead)}>
              Șterge cele citite
            </button>
          </div>
          {items.length === 0 && <p className="muted">Nicio notificare.</p>}
          <ul className="notif-list">
            {items.map((n) => (
              <li key={n.id} className={`${n.citit_ms ? "read" : "unread"} lvl-${n.nivel}`}>
                <div className="row">
                  <span className="grow notif-title">{n.titlu}</span>
                  {n.nivel !== "info" && <span className={`badge lvl-${n.nivel}`}>{LEVEL[n.nivel]}</span>}
                </div>
                {n.text && <div className="notif-text">{n.text}</div>}
                <div className="row muted small">
                  <span className="grow">
                    {props.moduleName(n.module)} · {when(n.creat_ms)}
                  </span>
                  {!n.citit_ms && (
                    <button className="link" aria-label={`Marchează citit: ${n.titlu}`} onClick={() => void act(() => api.notificationRead(n.id))}>
                      Marchează citit
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
