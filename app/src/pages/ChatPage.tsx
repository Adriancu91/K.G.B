// Team messages (Etapa 7, step 7.4f): a small chat of the organization with
// voice messages. Messages reach the other PCs through the organization's
// synchronisation and show up there as notifications. Recording uses the
// microphone; Windows (and the window) ask for permission the first time.
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "../api";

interface Msg {
  id: string;
  autor: string;
  dispozitiv: string;
  text: string;
  voce: string | null;
  durata_ms: number;
  tip_audio: string;
  creat_ms: number;
}
interface Reply {
  mesaje: Msg[];
  eu: string;
  nume: string;
  organizatie: boolean;
}

const MAX_MS = 120_000;
const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  const today = new Date();
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return d.toDateString() === today.toDateString() ? time : `${p(d.getDate())}.${p(d.getMonth() + 1)} ${time}`;
};
const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Plays a voice message; its bytes are loaded on the first click. */
function Voice({ m }: { m: Msg }) {
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  if (url) return <audio controls autoPlay src={url} aria-label={`Mesaj vocal de ${secs(m.durata_ms)}`} />;
  return (
    <span className="row">
      <button
        onClick={() =>
          void invoke<{ mime: string; data: string } | null>("chat_voice", { id: m.id }).then(
            (r) => {
              if (!r) return setNote("Înregistrarea e încă pe drum de la celălalt PC.");
              const bin = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
              setUrl(URL.createObjectURL(new Blob([bin], { type: r.mime })));
            },
            (e) => setNote(message(e)),
          )
        }
      >
        ▶ Ascultă ({secs(m.durata_ms)})
      </button>
      {note && <span className="muted small">{note}</span>}
    </span>
  );
}

export function ChatPage({ onError }: { onError: (e: string | null) => void }) {
  const [r, setR] = useState<Reply | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<{ since: number } | null>(null);
  const [recErr, setRecErr] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      setR(await invoke<Reply>("chat_list"));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [load]);
  const count = r?.mesaje.length ?? 0;
  // Braces: newer WebView2 returns a promise from scrollIntoView, which React would take for a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rec]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await invoke("chat_send", { text });
      setText("");
      onError(null);
      await load();
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const startRec = async () => {
    setRecErr(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setRecErr("Microfonul nu e disponibil sau nu ai dat permisiunea. În Windows: Setări → Confidențialitate → Microfon → permite aplicațiilor desktop.");
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const since = Date.now();
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRec(null);
      const durata = Math.min(MAX_MS, Date.now() - since);
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      if (recorder.current === null) return; // cancelled
      recorder.current = null;
      void blob.arrayBuffer().then(async (buf) => {
        try {
          await invoke("chat_send_voice", { data: toBase64(buf), mime: blob.type, durataMs: durata });
          await load();
        } catch (e) {
          setRecErr(message(e));
        }
      });
    };
    recorder.current = mr;
    mr.start();
    setRec({ since });
    setTimeout(() => mr.state === "recording" && mr.stop(), MAX_MS);
  };
  const stopRec = (cancel: boolean) => {
    const mr = recorder.current;
    if (!mr) return;
    if (cancel) recorder.current = null;
    mr.stop();
  };

  if (!r) return <p className="muted">Se încarcă…</p>;
  return (
    <section className="chat">
      {!r.organizatie && (
        <p className="warn">
          Acest PC nu e într-o organizație: mesajele rămân doar aici. Colegii le primesc după ce le adaugi din „Organizație” și „Dispozitive și
          sincronizare”.
        </p>
      )}
      <div className="chat-list" role="log" aria-label="Mesajele echipei">
        {r.mesaje.length === 0 && <p className="muted">Niciun mesaj încă. Scrie primul mesaj sau înregistrează unul vocal.</p>}
        {r.mesaje.map((m) => {
          const mine = m.dispozitiv === r.eu;
          return (
            <div key={m.id} className={mine ? "msg mine" : "msg"}>
              <div className="msg-head">
                <strong>{mine ? "Eu" : m.autor}</strong>
                <span className="muted small">{when(m.creat_ms)}</span>
                {mine && (
                  <button className="link small" onClick={() => void invoke("chat_delete", { id: m.id }).then(load, (e) => onError(message(e)))}>
                    șterge
                  </button>
                )}
              </div>
              {m.voce ? <Voice m={m} /> : <p className="msg-text">{m.text}</p>}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Mesaj nou"
          placeholder={`Scrie un mesaj ca ${r.nume}… (Enter trimite, Shift+Enter rând nou)`}
          value={text}
          maxLength={2000}
          rows={2}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <div className="row">
          <button type="submit" className="primary" disabled={busy || !text.trim()}>
            Trimite
          </button>
          {rec ? (
            <>
              <button type="button" className="primary rec" onClick={() => stopRec(false)}>
                ■ Oprește și trimite ({secs(now - rec.since)})
              </button>
              <button type="button" onClick={() => stopRec(true)}>
                Renunță
              </button>
            </>
          ) : (
            <button type="button" onClick={() => void startRec()} title="Înregistrează un mesaj vocal (cel mult 2 minute)">
              🎙 Mesaj vocal
            </button>
          )}
        </div>
        {recErr && (
          <p className="error" role="alert">
            {recErr}
          </p>
        )}
      </form>
    </section>
  );
}
