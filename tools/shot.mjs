/** Chrome CDP로 figure 갤러리를 실제 렌더해 PNG로 떠서 눈으로 검증한다. */
import fs from 'node:fs';
import path from 'node:path';

const CDP = 'http://127.0.0.1:9222';
const target = `file:///${path.resolve('out/figures/gallery.html').replace(/\\/g, '/')}`;

const res = await fetch(`${CDP}/json/new?${encodeURIComponent(target)}`, { method: 'PUT' });
const tab = await res.json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => {
  const msgId = ++id;
  pending.set(msgId, resolve);
  ws.send(JSON.stringify({ id: msgId, method, params }));
});

await new Promise((r) => { ws.onopen = r; });
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
};

await send('Page.enable');
// 폭을 먼저 고정한 뒤 높이를 측정한다. 순서를 바꾸면 리플로우 이전 높이를 재서
// 아래쪽 컷이 잘린 채로 저장된다.
const WIDTH = 1180;
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 2, mobile: false });
await new Promise((r) => setTimeout(r, 1200));
const metrics = await send('Page.getLayoutMetrics');
const h = Math.ceil(metrics.cssContentSize.height) + 24;
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: h, deviceScaleFactor: 2, mobile: false });
await new Promise((r) => setTimeout(r, 500));
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
fs.writeFileSync('out/figures/gallery.png', Buffer.from(shot.data, 'base64'));
console.log(`out/figures/gallery.png (${(fs.statSync('out/figures/gallery.png').size / 1024).toFixed(0)}KB)`);
await fetch(`${CDP}/json/close/${tab.id}`);
ws.close();
