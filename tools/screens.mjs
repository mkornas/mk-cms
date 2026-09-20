// Screenshots of the admin for the README and the product page, taken from a
// running instance with the demo site (SEED_DEMO=true). Headless Chrome over
// the DevTools protocol, no extra dependencies: sign in over GraphQL, hand the
// session to the SPA through localStorage, open each screen at 1440×900 and
// 2× device pixels, write docs/screenshots/<name>.jpg — and, with --webp <dir>,
// <dir>/cms-<name>.webp for the site. Read-only: nothing is created or saved.
//   node tools/screens.mjs [--webp ../mk-apps/public/screens] [name...]
//   MKCMS_URL / MKCMS_EMAIL / MKCMS_PASSWORD override the quick-start defaults.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require('../apps/api/node_modules/sharp');

const BASE = process.env.MKCMS_URL ?? 'http://localhost:4000';
const EMAIL = process.env.MKCMS_EMAIL ?? 'owner@mk-cms.local';
const PASSWORD = process.env.MKCMS_PASSWORD ?? 'changeme123';
const OUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const VIEW = { width: 1440, height: 900 };
const SCALE = 2;

const args = process.argv.slice(2);
const webpAt = args.indexOf('--webp');
const WEBP = webpAt >= 0 ? args.splice(webpAt, 2)[1] : null;
const only = args;

const gql = async (query, variables = {}, token) => {
  const r = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-site': 'default', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const json = await r.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
};

const { login } = await gql(
  'mutation ($email: String!, $password: String!) { login(email: $email, password: $password) { accessToken refreshToken } }',
  { email: EMAIL, password: PASSWORD },
);
const { entries } = await gql('query { entries(type: "post", limit: 50) { id slug } }', {}, login.accessToken);
const lighthouse = entries.find((e) => e.slug === 'the-lighthouse') ?? entries[0];
if (!lighthouse) throw new Error('no posts on the default site — start with SEED_DEMO=true');

/** One entry per picture: where to go, which theme, what to do there, and the part to keep (CSS px). */
const SCREENS = [
  { name: 'dashboard', theme: 'dark', path: '/dashboard' },
  { name: 'posts', theme: 'light', path: '/content/post', clip: { x: 260, y: 60, width: 1180, height: 640 } },
  { name: 'editor', theme: 'light', path: `/content/post/${lighthouse.id}`, clip: { x: 260, y: 60, width: 1180, height: 680 } },
  {
    name: 'content-types',
    theme: 'light',
    path: '/content-types',
    clip: { x: 260, y: 60, width: 1180, height: 790 },
    // Open the Post type so its fields show instead of the empty state.
    act: async (evaluate, wait) => {
      await evaluate("[...document.querySelectorAll('.type-table tr.mk-table__row')].find((r) => /\\bPost\\b/.test(r.textContent))?.click()");
      await wait(1500);
    },
  },
];

// ── headless Chrome over CDP ────────────────────────
const port = 9333 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'mk-cms-screens-'));
const chrome = spawn(
  process.env.CHROME ?? 'google-chrome',
  ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--lang=en-GB', `--window-size=${VIEW.width},${VIEW.height}`, 'about:blank'],
  { stdio: 'ignore' },
);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50 && !ws; i++) {
  try {
    ws = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl;
  } catch {
    await wait(200);
  }
}
if (!ws) throw new Error('chrome did not come up');
const sock = new WebSocket(ws);
await new Promise((r) => (sock.onopen = r));
let id = 0;
const pending = new Map();
sock.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    sock.send(JSON.stringify({ id: n, method, params, sessionId }));
  });

mkdirSync(OUT, { recursive: true });
if (WEBP) mkdirSync(WEBP, { recursive: true });
try {
  for (const s of SCREENS.filter((s) => !only.length || only.includes(s.name))) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { ...VIEW, deviceScaleFactor: SCALE, mobile: false }, sessionId);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: s.theme }] }, sessionId);
    await send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Warsaw' }, sessionId);
    const session = JSON.stringify({ accessToken: login.accessToken, refreshToken: login.refreshToken, user: null, sites: [], activeSiteSlug: null });
    await send(
      'Page.addScriptToEvaluateOnNewDocument',
      { source: `try{localStorage.setItem('mk-cms.session',${JSON.stringify(session)});localStorage.setItem('mk-kit-theme','${s.theme}');}catch{}` },
      sessionId,
    );
    await send('Page.navigate', { url: BASE + s.path }, sessionId);
    await wait(3000);
    if (s.act) await s.act((expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId), wait);
    await send('Runtime.evaluate', { expression: 'document.activeElement instanceof HTMLElement && document.activeElement.blur()' }, sessionId);
    await wait(500);
    const { data } = await send(
      'Page.captureScreenshot',
      { format: 'png', ...(s.clip ? { clip: { ...s.clip, scale: 1 } } : {}) },
      sessionId,
    );
    const png = Buffer.from(data, 'base64');
    const { width, height } = await sharp(png).metadata();
    await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(join(OUT, `${s.name}.jpg`));
    if (WEBP) await sharp(png).webp({ quality: 82 }).toFile(join(WEBP, `cms-${s.name}.webp`));
    console.log(`${s.name} ${width}x${height}`);
    await send('Target.closeTarget', { targetId });
  }
} finally {
  sock.close();
  const gone = new Promise((r) => chrome.once('exit', r));
  chrome.kill();
  await gone;
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
