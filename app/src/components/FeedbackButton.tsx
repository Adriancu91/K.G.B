// "Trimite o observație" in the whole app (7.4l-0e), with COS's window (Feedback.tsx, unchanged): the person writes
// what does not work; a picture of the window, the page and the version are kept with it, only on this computer
// (Documents\K.G.B\Observații, src-tauri/src/feedback.rs). Nothing goes to the internet: the person sends the files.
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api as cosApi } from "../../cos/src/api";
import Feedback from "../../cos/src/Feedback";
import "../../cos/src/pdf/digisign.css";
import "../../cos/src/feedback.css";

const b64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const p2 = (n: number) => String(n).padStart(2, "0");

// What Electron gave COS: the picture of the window and the saving, through the core.
Object.assign(cosApi, {
  feedbackCapture: async () => {
    const png = await invoke<string | null>("feedback_capture");
    return png ? Uint8Array.from(atob(png), (c) => c.charCodeAt(0)) : null;
  },
  feedbackSave: ({ text, module, file, png }: { text: string; module: string; file: string; png: Uint8Array | null }) => {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}-${p2(d.getMinutes())}-${p2(d.getSeconds())}`;
    return invoke<{ dir: string; txt: string; png: string | null }>("feedback_save", {
      text,
      module,
      file,
      png: png ? b64(png) : null,
      stamp,
      date: d.toLocaleString("ro-RO"),
    });
  },
  feedbackOpenDir: async () => {
    await invoke("feedback_open_dir");
    return "";
  },
});

/** The button under the navigation and COS's window, with the picture taken before the window opens. */
export function FeedbackButton({ where }: { where: string }) {
  const [open, setOpen] = useState<{ png: Uint8Array | null; where: string } | null>(null);
  const start = async () => {
    // The picture first, so the window itself is not in it.
    const png = await cosApi.feedbackCapture().catch(() => null);
    setOpen({ png, where });
  };
  return (
    <>
      <button className="link feedback-btn" onClick={() => void start()} title="Scrii ce nu merge; se salvează pe calculator, cu o poză a ferestrei, ca să le trimiți tu">
        💬 Trimite o observație
      </button>
      {open && <Feedback where={open.where} file="" png={open.png} onClose={() => setOpen(null)} />}
    </>
  );
}
