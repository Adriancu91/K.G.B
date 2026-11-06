// Minimal Chrome DevTools Protocol client for driving the K.G.B. window in
// tests. Uses only Node's built-in WebSocket (Node >= 22): no extra tools.
//
// The app must be started with
//   WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>
// so WebView2 exposes the page on 127.0.0.1 only.
import { writeFileSync } from "node:fs";

export async function connect(port = 9333, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let target;
  while (!target) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      target = list.find((t) => t.type === "page" && t.url.startsWith("http://tauri.localhost"));
    } catch {
      /* not up yet */
    }
    if (!target) {
      if (Date.now() > deadline) throw new Error(`no K.G.B. page on port ${port}`);
      await sleep(250);
    }
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = fail;
  });
  let next = 1;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      msg.error ? p.fail(new Error(msg.error.message)) : p.ok(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const id = next++;
      pending.set(id, { ok, fail });
      ws.send(JSON.stringify({ id, method, params }));
    });

  const page = {
    /** Evaluates an expression (may be async) in the page and returns its value. */
    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    async screenshot(path) {
      const r = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(path, Buffer.from(r.data, "base64"));
    },
    /** Waits until `expression` is truthy. */
    async until(expression, timeout = 5000) {
      const end = Date.now() + timeout;
      for (;;) {
        const v = await page.eval(expression).catch(() => false);
        if (v) return v;
        if (Date.now() > end) throw new Error(`timeout waiting for: ${expression}`);
        await sleep(100);
      }
    },
    /** Clicks the first button whose text contains `text`. */
    async click(text, selector = "button") {
      const ok = await page.eval(`(() => {
        const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.textContent.includes(${JSON.stringify(text)}));
        if (!b) return false; b.click(); return true; })()`);
      if (!ok) throw new Error(`no ${selector} with text "${text}"`);
      await sleep(150);
    },
    /** Sets a React-controlled input/select value. */
    async fill(selector, value) {
      const ok = await page.eval(`(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
        return true; })()`);
      if (!ok) throw new Error(`no element ${selector}`);
      await sleep(150);
    },
    text: () => page.eval("document.body.innerText"),
    close: () => ws.close(),
  };
  await send("Runtime.enable");
  return page;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
