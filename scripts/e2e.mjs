// End-to-end check of the built Chrome extension (`pnpm e2e`):
// 1. load .output/chrome-mv3 into headless Chrome over a DevTools pipe;
// 2. open an arXiv HTML paper and confirm the content script ran (highlights painted);
// 3. move the real mouse onto d_k and confirm the definition popup opened.
// The popup lives in a closed shadow root, so step 3 reads the accessibility tree.
// Needs Google Chrome; set CHROME_PATH if it isn't at the default location.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULT_CHROME = {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: '/usr/bin/google-chrome',
}[process.platform];
const chromePath = process.env.CHROME_PATH ?? DEFAULT_CHROME;
const extension = resolve('.output/chrome-mv3');
const PAPER = 'https://arxiv.org/html/1706.03762v7';
if (!chromePath || !existsSync(chromePath)) throw new Error(`Chrome not found; set CHROME_PATH (looked at ${chromePath})`);
if (!existsSync(join(extension, 'manifest.json'))) throw new Error('Build first: pnpm build');

const chrome = spawn(chromePath, [
  '--headless=new', '--remote-debugging-pipe', '--enable-unsafe-extension-debugging', '--hide-scrollbars',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'paperpeek-e2e-'))}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const [toChrome, fromChrome] = [chrome.stdio[3], chrome.stdio[4]];

// The pipe protocol is JSON messages separated by NUL bytes.
let buffer = '';
let nextId = 0;
const pending = new Map();
const events = [];
fromChrome.on('data', (chunk) => {
  buffer += chunk;
  for (let end = buffer.indexOf('\0'); end >= 0; end = buffer.indexOf('\0')) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else events.push(message);
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolveSend, reject) => {
    const id = ++nextId;
    pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolveSend(m.result)));
    toChrome.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures.push(label);
};

try {
  await send('Extensions.loadUnpacked', { path: extension });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 760, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: PAPER }, sessionId);
  await sleep(9000);

  const ready = events.find((e) => e.method === 'Runtime.consoleAPICalled' && /\[PaperPeek\].*ready in/.test(e.params.args.map((a) => a.value).join(' ')));
  check(Boolean(ready), `content script ran on ${PAPER}`);
  const { result: highlights } = await send('Runtime.evaluate', { expression: "CSS.highlights.get('paperpeek-term')?.size ?? 0", returnByValue: true }, sessionId);
  check(highlights.value > 50, `term highlights painted (${highlights.value})`);

  const { result: point } = await send('Runtime.evaluate', {
    expression: `(() => {
      const m = [...document.querySelectorAll('math.ltx_Math')].find((x) => x.getAttribute('alttext') === 'd_{k}' && x.closest('.ltx_p'));
      m.scrollIntoView({ block: 'center' });
      const r = m.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`,
    returnByValue: true,
  }, sessionId);
  await sleep(300);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.value.x, y: point.value.y }, sessionId);
  await sleep(800);
  const { nodes } = await send('Accessibility.getFullAXTree', {}, sessionId);
  const dialog = nodes.find((n) => n.role?.value === 'dialog' && /^Definition: /.test(n.name?.value ?? ''));
  check(Boolean(dialog), `hovering d_k opens its popup (${dialog?.name?.value ?? 'none'})`);
} catch (error) {
  failures.push(String(error));
  console.error(error);
} finally {
  chrome.kill();
}
process.exitCode = failures.length ? 1 : 0;
