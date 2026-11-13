/* Scrolli Studio — runs fully in the browser: files are read locally and never sent anywhere. */
(() => {
'use strict';
// ---------- format (mm)
const PAPER_W = 121, BLEED = 3, SCENE = 150, LEAD = 125, WIN_W = 120, WIN_H = 150, WIN_R = 8, SAFE = 8;
const BOX_W = 160, BOX_H = 252, ROLL_Y = 95, ROLL_R = 14, KNOB_D = 36, KNOB_T = 10.5, HANDLE_R = 11.5;
const CLICK_MM = 2 * Math.PI * ROLL_R * 15 / 360, PT = 0.3528;
const total = n => LEAD * 2 + SCENE * n, sceneTop = i => LEAD + (i - 1) * SCENE;
const COLORS = ['#151515', '#ffffff', '#fffaf0', '#e8423c', '#f6b52a', '#2f72c0', '#1d2450', '#2c6a4c', '#f4a6c4'];

// ---------- state
let N = 16, upMode = 'strip', segs = [], fileLabel = 'Demo scroll', urls = [];
let view = 'roll', s = LEAD, target = null, k = 1, cx = 0, cy = 0;            // roll view
let es = LEAD, ek = 1, eox = 0, eoy = 60, etarget = null;                     // words view
let texts = [], sel = null, nextId = 1, editing = null, drag = null;
const fontList = [{ name: 'Nunito', label: 'Nunito (default)' }, { name: 'Inter', label: 'Inter' }];
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), strip = $('strip'), sctx = strip.getContext('2d');
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function radio(q, on) { document.querySelectorAll(q).forEach(b => b.setAttribute('aria-checked', b === on)); }

// ================= LOADING (local only) =================
function freeUrls() { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; }
function readImg(file) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(file); urls.push(u); const im = new Image();
    im.onload = () => res(im); im.onerror = () => rej(new Error(file.name)); im.src = u; });
}
async function load(files) {
  files = files.filter(f => /^image\//.test(f.type)); if (!files.length) return;
  freeUrls();
  try {
    if (upMode === 'strip') useStrip(await readImg(files[0]), files[0].name);
    else { files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); useScenes(await Promise.all(files.map(readImg)), `${files.length} scene images`); }
  } catch (err) { report([['bad', `Could not open ${err.message}. Very tall images can be too big for phones; try "Scene by scene".`]]); return; }
  s = es = LEAD; afterChange();
}
function useStrip(im, name) {
  fileLabel = name; const w = im.naturalWidth, h = im.naturalHeight, r = h / w;
  const rB = (total(N) + 2 * BLEED) / (PAPER_W + 2 * BLEED), rN = total(N) / PAPER_W, bleed = Math.abs(r / rB - 1) <= Math.abs(r / rN - 1);
  const mmPerPx = (bleed ? PAPER_W + 2 * BLEED : PAPER_W) / w, b = bleed ? BLEED / mmPerPx : 0, len = h * mmPerPx - (bleed ? 2 * BLEED : 0);
  segs = [{ img: im, top: 0, h: len, sx: b, sy: b, sw: w - 2 * b, sh: h - 2 * b }];
  const dpi = w / ((bleed ? PAPER_W + 2 * BLEED : PAPER_W) / 25.4), scenesFit = ((bleed ? r * (PAPER_W + 2 * BLEED) - 2 * BLEED : r * PAPER_W) - 2 * LEAD) / SCENE;
  const c = [['info', `${w} × ${h} px`], [bleed ? 'ok' : 'warn', bleed ? '3 mm bleed included' : 'No bleed (add 3 mm each side for print)']];
  c.push(Math.abs(len / total(N) - 1) < 0.015 ? ['ok', `Length matches ${N} scenes`] : ['bad', `Length fits about ${scenesFit.toFixed(1)} scenes, not ${N}`]);
  c.push(dpi >= 290 ? ['ok', `${Math.round(dpi)} dpi · print-ready`] : dpi >= 140 ? ['ok', `${Math.round(dpi)} dpi · fine for testing`] : ['warn', `${Math.round(dpi)} dpi · low, will look soft`]);
  if (w * h > 16.7e6) c.push(['warn', 'Very large: some phones cannot open it']);
  report(c);
}
function useScenes(ims, label) {
  fileLabel = label; segs = []; const c = [];
  c.push(ims.length === N ? ['ok', `${N} scenes, in file-name order`] : ['bad', `${ims.length} images for ${N} scenes`]);
  let bad = 0, minDpi = 1e9;
  ims.forEach((im, i) => { const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; if (Math.abs((h / w) / (SCENE / PAPER_W) - 1) > 0.02) bad++;
    minDpi = Math.min(minDpi, w / (PAPER_W / 25.4)); if (i < N) segs.push({ img: im, top: sceneTop(i + 1), h: SCENE, sx: 0, sy: 0, sw: w, sh: h }); });
  c.push(bad ? ['warn', `${bad} image(s) not 121 × 150 mm in shape (stretched)`] : ['ok', 'Every scene is the right shape']);
  c.push(minDpi >= 290 ? ['ok', `${Math.round(minDpi)}+ dpi · print-ready`] : ['ok', `${Math.round(minDpi)} dpi · fine for testing`]);
  report(c);
}
function report(items) { $('checkList').replaceChildren(...items.map(([t, m]) => { const li = document.createElement('li'); li.className = t; li.textContent = m; return li; })); }
function demo() {
  const ims = [], cols = ['#e8423c', '#f6b52a', '#2f72c0', '#f4a6c4', '#2c6a4c', '#f27c2a', '#b9a7dc', '#82d0e3', '#b9d66a'];
  for (let i = 0; i < N; i++) {
    const c = document.createElement('canvas'); c.width = 726; c.height = 900; const g = c.getContext('2d');
    g.fillStyle = '#f7f3ec'; g.fillRect(0, 0, 726, 900);
    const a = cols[i % cols.length], b = cols[(i + 3) % cols.length];
    g.fillStyle = a; g.beginPath(); g.roundRect(90, 260, 546, 380, 40); g.fill(); g.fillStyle = b; g.beginPath(); g.arc(363, 450, 130, 0, 7); g.fill();
    for (let j = 0; j < 6; j++) { g.fillStyle = cols[(i + j) % cols.length]; g.beginPath(); g.arc(110 + j * 100, 830, 16, 0, 7); g.fill(); }
    g.fillStyle = '#151515'; g.textAlign = 'center'; g.font = '700 110px Inter, system-ui, sans-serif';
    g.fillText(i === 0 ? 'Hello' : i === N - 1 ? 'The end' : String(i + 1).padStart(2, '0'), 363, 490);
    ims.push(c);
  }
  segs = ims.map((im, i) => ({ img: im, top: sceneTop(i + 1), h: SCENE, sx: 0, sy: 0, sw: im.width, sh: im.height }));
  fileLabel = 'Demo scroll'; report([['info', 'Demo scroll · upload your own to test it']]); afterChange();
}
function removeScroll() { freeUrls(); segs = []; fileLabel = 'No scroll (blank paper)'; report([]); afterChange(); }
function afterChange() { $('fileName').textContent = fileLabel; clampS(); buildStrip(); draw(); }

// ================= DRAWING HELPERS =================
const X = x => cx + x * k, Y = y => cy + y * k;
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function paperTo(g, x0, y0, w, mmTop, mmBot, scale, skipId) {
  g.fillStyle = '#ffffff'; g.fillRect(x0, y0, w, (mmBot - mmTop) * scale);
  for (const sg of segs) {
    const a = Math.max(mmTop, sg.top), b = Math.min(mmBot, sg.top + sg.h); if (b <= a) continue;
    const syA = sg.sy + (a - sg.top) / sg.h * sg.sh, syB = sg.sy + (b - sg.top) / sg.h * sg.sh;
    g.drawImage(sg.img, sg.sx, syA, sg.sw, syB - syA, x0, y0 + (a - mmTop) * scale, w, (b - a) * scale);
  }
  drawTexts(g, x0, y0, mmTop, mmBot, w / PAPER_W, skipId);
}
const fontStr = (t, px) => `${t.bold ? 800 : 400} ${px}px "${t.font}", system-ui, sans-serif`;
const mctx = document.createElement('canvas').getContext('2d');
function layout(g, t, scale) {
  const px = t.size * PT * scale; g.font = fontStr(t, px); const maxW = t.w * scale, lines = [];
  for (const para of t.text.split('\n')) { let cur = '';
    for (const word of para.split(' ')) { const tr = cur ? cur + ' ' + word : word; if (g.measureText(tr).width <= maxW || !cur) cur = tr; else { lines.push(cur); cur = word; } }
    lines.push(cur); }
  return { lines, lh: px * t.lh, px };
}
function textBox(t) { const L = layout(mctx, t, 10); return { x: t.x, y: t.y, w: t.w, h: Math.max(L.lines.length * L.lh / 10, t.size * PT) }; }
function drawTexts(g, x0, y0, mmTop, mmBot, pxPerMm, skipId) {
  for (const t of texts) {
    if (t.scene > N || t.id === skipId) continue;
    const top = sceneTop(t.scene) + t.y, bb = textBox(t); if (top > mmBot || top + bb.h < mmTop) continue;
    const L = layout(g, t, pxPerMm); g.save(); g.fillStyle = t.color; g.textBaseline = 'alphabetic'; g.textAlign = t.align;
    const ax = t.align === 'center' ? t.x + t.w / 2 : t.align === 'right' ? t.x + t.w : t.x;
    L.lines.forEach((ln, i) => g.fillText(ln, x0 + ax * pxPerMm, y0 + (top - mmTop) * pxPerMm + L.px * 0.92 + i * L.lh));
    g.restore();
  }
}

// ================= ROLL VIEW =================
const minS = () => LEAD - 40, maxS = () => total(N) - LEAD - WIN_H + 40;
function clampS() { s = clamp(s, minS(), maxS()); es = clamp(es, 0, total(N) - SCENE); }
const sceneAt = y => clamp(Math.floor((y - LEAD) / SCENE) + 1, 1, N);
function animateTo(t) {
  if (view === 'roll') target = clamp(t, minS(), maxS()); else etarget = clamp(t, 0, total(N) - SCENE);
  const step = () => {
    const isRoll = view === 'roll', tg = isRoll ? target : etarget; if (tg === null) return;
    const cur = isRoll ? s : es, d = tg - cur, nv = Math.abs(d) < 0.2 ? tg : cur + d * 0.22;
    if (isRoll) { s = nv; if (nv === tg) target = null; } else { es = nv; if (nv === tg) etarget = null; }
    draw(); if ((isRoll ? target : etarget) !== null) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function go(d) {
  if (view === 'roll') { const cur = Math.round((s - LEAD) / SCENE); animateTo(LEAD + clamp(cur + d, 0, N - 1) * SCENE); }
  else { const cur = sceneAt(es + 1); animateTo(sceneTop(clamp(cur + d, 1, N))); }
}
const nudge = mm => animateTo((target ?? s) + mm);
function snap() { if ($('clicks').checked) animateTo(LEAD + Math.round((s - LEAD) / CLICK_MM) * CLICK_MM); }

function resize() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  k = Math.min(r.width / (BOX_W + 2 * (KNOB_T + 14)), (r.height - 100) / (BOX_H + 16)); cx = r.width / 2; cy = 58 + (r.height - 100) / 2;
  buildStrip(); draw();
}
function draw() {
  if (view === 'words') drawWords(); else drawRoll();
  const sc = sceneAt(view === 'roll' ? s + WIN_H / 2 : es + 1);
  $('counter').textContent = `Scene ${sc} / ${N}${sc === 1 ? ' · title' : sc === N ? ' · end' : ''}`;
  drawStripMarker();
}
function drawRoll() {
  const r = cv.getBoundingClientRect(), wire = css('--wire') || '#222', acc = css('--accent') || '#e0761e', muted = css('--muted') || '#888';
  ctx.clearRect(0, 0, r.width, r.height); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1, k * 0.42);
  ctx.save(); rrect(ctx, X(-WIN_W / 2), Y(-WIN_H / 2), WIN_W * k, WIN_H * k, WIN_R * k); ctx.clip();
  paperTo(ctx, X(-PAPER_W / 2), Y(-WIN_H / 2), PAPER_W * k, s, s + WIN_H, k);
  if ($('guides').checked) guidesIn(ctx, X(-PAPER_W / 2), Y(-WIN_H / 2), s, s + WIN_H, k);
  ctx.restore();
  ctx.strokeStyle = wire; ctx.lineWidth = lw;
  rrect(ctx, X(-BOX_W / 2), Y(-BOX_H / 2), BOX_W * k, BOX_H * k, 6 * k); ctx.stroke();
  ctx.globalAlpha = .3; rrect(ctx, X(-BOX_W / 2 + 3), Y(-BOX_H / 2 + 3), (BOX_W - 6) * k, (BOX_H - 6) * k, 4 * k); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.lineWidth = lw * 1.6; rrect(ctx, X(-WIN_W / 2), Y(-WIN_H / 2), WIN_W * k, WIN_H * k, WIN_R * k); ctx.stroke(); ctx.lineWidth = lw;
  ctx.setLineDash([4, 4]); ctx.globalAlpha = .5;
  const prog = clamp((s - LEAD) / (total(N) - 2 * LEAD - WIN_H), 0, 1);
  for (const [sgn, fill] of [[-1, 1 - prog], [1, prog]]) { const rr = 12.5 + 4 * fill;
    ctx.strokeRect(X(-PAPER_W / 2), Y(sgn * ROLL_Y - rr), PAPER_W * k, 2 * rr * k);
    ctx.beginPath(); ctx.moveTo(X(-PAPER_W / 2 - 3), Y(sgn * ROLL_Y)); ctx.lineTo(X(PAPER_W / 2 + 3), Y(sgn * ROLL_Y)); ctx.stroke(); }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  for (const xx of [-55, 55]) ctx.strokeRect(X(xx - 5), Y(-BOX_H / 2 - 2.5), 10 * k, 2.5 * k);
  ctx.beginPath(); ctx.ellipse(X(0), Y(BOX_H / 2), 25 * k, 3 * k, 0, Math.PI, 0); ctx.stroke();
  const ang = (s - LEAD) / ROLL_R;
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const yc = sy * ROLL_Y, x0 = sx > 0 ? BOX_W / 2 + 1.5 : -BOX_W / 2 - 1.5 - KNOB_T, edge = sx > 0 ? BOX_W / 2 : -BOX_W / 2, e2 = sx > 0 ? BOX_W / 2 + 1.5 : -BOX_W / 2 - 1.5;
    ctx.strokeStyle = wire; ctx.lineWidth = lw; rrect(ctx, X(x0), Y(yc - KNOB_D / 2), KNOB_T * k, KNOB_D * k, 2.5 * k); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(edge), Y(yc - 7)); ctx.lineTo(X(e2), Y(yc - 7)); ctx.moveTo(X(edge), Y(yc + 7)); ctx.lineTo(X(e2), Y(yc + 7)); ctx.stroke();
    ctx.lineWidth = Math.max(.6, lw * .55); ctx.globalAlpha = .7;
    for (let i = 0; i < 24; i++) { const t = ang + i * Math.PI / 12; if (Math.cos(t) <= 0) continue; const yy = yc + KNOB_D / 2 * Math.sin(t) * .96;
      ctx.beginPath(); ctx.moveTo(X(x0 + 1.2), Y(yy)); ctx.lineTo(X(x0 + KNOB_T - 1.2), Y(yy)); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.lineWidth = lw;
    const front = Math.cos(ang) > 0, yh = yc + HANDLE_R * Math.sin(ang), hx0 = sx > 0 ? x0 + KNOB_T : x0 - 8.5;
    ctx.setLineDash(front ? [] : [3, 3]); ctx.globalAlpha = front ? 1 : .45; rrect(ctx, X(hx0), Y(yh - 4.2), 8.5 * k, 8.4 * k, 4 * k); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const td = ang - Math.PI / 2; if (Math.cos(td) > 0) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(X(sx > 0 ? x0 + KNOB_T + .4 : x0 - .4), Y(yc + 13 * Math.sin(td)), 1.6 * k, 0, 7); ctx.fill(); }
  }
}
function guidesIn(g, x0, y0, mmTop, mmBot, sc) {
  for (let i = 1; i <= N; i++) { const t = sceneTop(i); if (t + SCENE < mmTop || t > mmBot) continue;
    g.strokeStyle = '#2f7fd1'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x0, y0 + (t - mmTop) * sc); g.lineTo(x0 + PAPER_W * sc, y0 + (t - mmTop) * sc); g.stroke();
    g.fillStyle = '#2f7fd1'; g.font = `600 ${Math.max(10, 3.2 * sc)}px Inter, system-ui`; g.textAlign = 'left'; g.fillText(`SCENE ${i}`, x0 + 4 * sc, y0 + (t - mmTop + 5) * sc);
    g.strokeStyle = '#2fae6b'; g.setLineDash([6, 4]); g.strokeRect(x0 + (0.5 + SAFE) * sc, y0 + (t + SAFE - mmTop) * sc, (WIN_W - 2 * SAFE) * sc, (SCENE - 2 * SAFE) * sc); g.setLineDash([]); }
}

// ================= WORDS VIEW (continuous paper) =================
function drawWords() {
  const r = cv.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height);
  eoy = 60; ek = Math.min((r.width - 120) / PAPER_W, (r.height - eoy - 44) / SCENE); eox = (r.width - PAPER_W * ek) / 2;
  const mmTop = es - eoy / ek, mmBot = es + (r.height - eoy) / ek, pTop = Math.max(0, mmTop), pBot = Math.min(total(N), mmBot);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.12)'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff';
  ctx.fillRect(eox, eoy + (pTop - es) * ek, PAPER_W * ek, (pBot - pTop) * ek); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(eox, eoy + (pTop - es) * ek, PAPER_W * ek, (pBot - pTop) * ek); ctx.clip();
  paperTo(ctx, eox, eoy + (pTop - es) * ek, PAPER_W * ek, pTop, pBot, ek, editing && editing.id);
  ctx.restore();
  for (let i = 1; i <= N; i++) { const t = sceneTop(i); if (t + SCENE < mmTop || t > mmBot) continue; const y = eoy + (t - es) * ek;
    ctx.strokeStyle = 'rgba(47,127,209,.55)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]); rrect(ctx, eox + 0.5 * ek, y, WIN_W * ek, SCENE * ek, WIN_R * ek); ctx.stroke();
    if ($('guides').checked) { ctx.strokeStyle = 'rgba(47,174,107,.8)'; ctx.strokeRect(eox + (0.5 + SAFE) * ek, y + SAFE * ek, (WIN_W - 2 * SAFE) * ek, (SCENE - 2 * SAFE) * ek); }
    ctx.setLineDash([]); ctx.fillStyle = css('--muted') || '#888'; ctx.font = '600 12px Inter, system-ui'; ctx.textAlign = 'right'; ctx.fillText(`Scene ${i}`, eox - 10, y + 16); }
  for (const t of texts) { if (t.scene > N) continue; const b = textBox(t), y = eoy + (sceneTop(t.scene) + b.y - es) * ek; if (y > r.height || y + b.h * ek < 0) continue;
    const on = t === sel, out = b.x < 0.5 + SAFE || b.y < SAFE || b.x + b.w > WIN_W + 0.5 - SAFE || b.y + b.h > SCENE - SAFE;
    if (!on && !out) { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; }
    else { ctx.strokeStyle = out ? '#c8322b' : (css('--accent') || '#e0761e'); ctx.setLineDash([]); ctx.lineWidth = on ? 2 : 1.4; }
    ctx.strokeRect(eox + b.x * ek - 2, y - 2, b.w * ek + 4, b.h * ek + 4); ctx.setLineDash([]);
    if (on && editing !== t) { ctx.fillStyle = css('--accent') || '#e0761e'; ctx.beginPath(); ctx.roundRect(eox + (b.x + b.w) * ek - 3, y + b.h * ek / 2 - 10, 7, 20, 3); ctx.fill(); }
  }
  if (editing) placeInline();
}
function toPaper(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - eox) / ek, ym: es + (e.clientY - r.top - eoy) / ek }; }
function hit(p) {
  for (const t of [...texts].reverse()) { if (t.scene > N) continue; const b = textBox(t), top = sceneTop(t.scene) + b.y;
    if (t === sel && Math.abs(p.x - (b.x + b.w)) < 8 / ek && p.ym > top && p.ym < top + b.h) return { t, part: 'w' };
    if (p.x >= b.x - 1 && p.x <= b.x + b.w + 1 && p.ym >= top - 1 && p.ym <= top + b.h + 1) return { t, part: 'm' }; }
  return null;
}
function moveTo(t, x, ym) { const sc = clamp(Math.floor((ym - LEAD) / SCENE) + 1, 1, N); t.scene = sc; t.x = Math.round(x * 2) / 2; t.y = Math.round((ym - sceneTop(sc)) * 2) / 2; }

// ================= POINTER / WHEEL / KEYS =================
let lpTimer = null;
cv.addEventListener('pointerdown', e => {
  hideMenu(); if (e.button === 2) return;
  cv.setPointerCapture(e.pointerId); target = etarget = null;
  if (view === 'roll') { drag = { kind: 'roll', y: e.clientY, s0: s }; cv.classList.add('grabbing'); return; }
  const p = toPaper(e), h = hit(p);
  if (editing && (!h || h.t !== editing)) commitInline();
  if (h) { sel = h.t; syncPanel(); const top = sceneTop(h.t.scene) + h.t.y;
    drag = h.part === 'w' ? { kind: 'w', t: h.t, x0: p.x, w0: h.t.w } : { kind: 'm', t: h.t, dx: p.x - h.t.x, dy: p.ym - top }; }
  else { sel = null; syncPanel(); drag = { kind: 'pan', y: e.clientY, es0: es }; cv.classList.add('grabbing'); }
  const sx = e.clientX, sy = e.clientY, ht = h && h.t;
  lpTimer = setTimeout(() => { if (drag && !drag.moved && e.pointerType !== 'mouse') openMenu(sx, sy, ht, p); }, 550);
  draw();
});
cv.addEventListener('pointermove', e => {
  if (!drag) { if (view === 'words') { const h = hit(toPaper(e)); cv.style.cursor = !h ? 'grab' : h.part === 'w' ? 'ew-resize' : 'move'; } else cv.style.cursor = ''; return; }
  if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) { drag.moved = true; clearTimeout(lpTimer); }
  if (drag.kind === 'roll') { s = drag.s0 - (e.clientY - drag.y) / k; clampS(); }
  else if (drag.kind === 'pan') { es = drag.es0 - (e.clientY - drag.y) / ek; clampS(); }
  else { const p = toPaper(e); if (drag.kind === 'm') moveTo(drag.t, p.x - drag.dx, p.ym - drag.dy); else drag.t.w = Math.max(15, Math.round((drag.w0 + p.x - drag.x0) * 2) / 2); }
  draw();
});
const endDrag = () => { clearTimeout(lpTimer); if (!drag) return; const kd = drag.kind; drag = null; cv.classList.remove('grabbing'); if (kd === 'roll') snap(); if (kd === 'm' || kd === 'w') buildStrip(); };
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('dblclick', e => { if (view !== 'words') return; const p = toPaper(e), h = hit(p); if (h) startInline(h.t); else addText(p); });
cv.addEventListener('contextmenu', e => { e.preventDefault(); if (view !== 'words') return; const p = toPaper(e), h = hit(p); if (h) { sel = h.t; syncPanel(); draw(); } openMenu(e.clientX, e.clientY, h && h.t, p); });
cv.addEventListener('wheel', e => { e.preventDefault(); hideMenu();
  if (view === 'roll') nudge(Math.sign(e.deltaY) * CLICK_MM * Math.max(1, Math.round(Math.abs(e.deltaY) / 60)));
  else { etarget = null; es += e.deltaY / ek * 0.9; clampS(); draw(); } }, { passive: false });
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { hideMenu(); if (editing) commitInline(); }
  if (e.target.closest('input,textarea,select')) return;
  if (view === 'words' && sel && (e.key === 'Delete' || e.key === 'Backspace')) { delSel(); e.preventDefault(); return; }
  if (view === 'words' && sel && e.key === 'Enter') { startInline(sel); e.preventDefault(); return; }
  if (e.key === 'ArrowDown') { if (view === 'roll') nudge(CLICK_MM); else { es += 10; clampS(); draw(); } e.preventDefault(); }
  if (e.key === 'ArrowUp') { if (view === 'roll') nudge(-CLICK_MM); else { es -= 10; clampS(); draw(); } e.preventDefault(); }
  if (e.key === 'PageDown') { go(1); e.preventDefault(); }
  if (e.key === 'PageUp') { go(-1); e.preventDefault(); }
});

// ================= INLINE EDITING =================
const inl = $('inline');
function startInline(t) { editing = t; sel = t; syncPanel(); inl.hidden = false; inl.value = t.text; draw(); inl.focus(); inl.setSelectionRange(inl.value.length, inl.value.length); }
const isLight = c => { const n = parseInt(c.slice(1), 16); return ((n >> 16) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) > 170; };
function placeInline() {
  const t = editing, b = textBox(t), L = layout(mctx, t, ek);
  Object.assign(inl.style, { left: (eox + b.x * ek - 3) + 'px', top: (eoy + (sceneTop(t.scene) + b.y - es) * ek - 3) + 'px', width: (b.w * ek + 6) + 'px',
    height: (Math.max(b.h * ek, L.lh) + L.lh + 6) + 'px', font: fontStr(t, L.px), lineHeight: L.lh + 'px', color: t.color, textAlign: t.align,
    background: isLight(t.color) ? 'rgba(20,20,26,.55)' : 'rgba(255,255,255,.82)' });
}
inl.addEventListener('input', () => { if (editing) { editing.text = inl.value; $('wText').value = inl.value; draw(); } });
inl.addEventListener('blur', () => commitInline());
inl.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); commitInline(); } });
function commitInline() { if (!editing) return; editing = null; inl.hidden = true; buildStrip(); draw(); }

// ================= RIGHT-CLICK MENU =================
const menu = $('menu');
function mi(label, fn, cls = '') { const b = document.createElement('button'); b.type = 'button'; b.className = 'mi ' + cls; b.textContent = label; b.addEventListener('click', () => { hideMenu(); fn(); }); return b; }
function mbtn(label, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label; b.addEventListener('click', fn); return b; }
function openMenu(x, y, t, p) {
  menu.replaceChildren();
  if (t) {
    const sz = document.createElement('div'); sz.className = 'mrow';
    sz.append(mbtn('A−', () => upd(tt => tt.size = clamp(tt.size - 2, 6, 200), true)), mbtn('A+', () => upd(tt => tt.size = clamp(tt.size + 2, 6, 200), true)),
      mbtn('⟸', () => upd(tt => tt.align = 'left', true)), mbtn('≡', () => upd(tt => tt.align = 'center', true)), mbtn('⟹', () => upd(tt => tt.align = 'right', true)), mbtn('B', () => upd(tt => tt.bold = !tt.bold, true)));
    const cl = document.createElement('div'); cl.className = 'mrow';
    COLORS.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = c; b.title = c; b.addEventListener('click', () => upd(tt => tt.color = c, true)); cl.append(b); });
    menu.append(mi('✎  Edit text', () => startInline(t)), mi('⧉  Duplicate', () => { const c = { ...t, id: nextId++, y: t.y + t.size * PT * 1.6 }; texts.push(c); sel = c; syncPanel(); buildStrip(); draw(); }),
      sz, cl, document.createElement('hr'), mi('Use this style for all words', styleAll), mi('🗑  Delete', delSel, 'danger'));
  } else menu.append(mi('+  Add words here', () => addText(p)), mi('↥  Load script (.md)…', () => $('wScript').click()));
  menu.hidden = false; const mw = menu.offsetWidth || 220, mh = menu.offsetHeight || 220;
  menu.style.left = Math.min(x, innerWidth - mw - 8) + 'px'; menu.style.top = Math.min(y, innerHeight - mh - 8) + 'px';
}
function hideMenu() { menu.hidden = true; }
document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && e.target !== cv) hideMenu(); });

// ================= WORDS PANEL =================
function defaults() { const last = sel || texts[texts.length - 1]; return last ? { font: last.font, size: last.size, color: last.color, align: last.align, lh: last.lh, bold: last.bold } : { font: 'Nunito', size: 16, color: '#151515', align: 'left', lh: 1.25, bold: true }; }
function addText(p) {
  const sc = p ? clamp(Math.floor((p.ym - LEAD) / SCENE) + 1, 1, N) : sceneAt(es + SCENE / 2);
  const y = p ? clamp(p.ym - sceneTop(sc), SAFE, SCENE - SAFE - 10) : SAFE + 6, x = p ? clamp(p.x - 20, 0.5 + SAFE, WIN_W - SAFE - 30) : 0.5 + SAFE + 4;
  const t = { id: nextId++, scene: sc, x, y, w: Math.min(WIN_W - 2 * SAFE - 8, WIN_W + 0.5 - SAFE - x), text: 'Type your words', ...defaults() };
  texts.push(t); sel = t; if (view !== 'words') setView('words'); syncPanel(); buildStrip(); draw(); startInline(t); inl.select();
}
function delSel() { if (!sel) return; if (editing === sel) { editing = null; inl.hidden = true; } texts = texts.filter(t => t !== sel); sel = null; syncPanel(); buildStrip(); draw(); }
function styleAll() { if (!sel) return; texts.forEach(t => { if (!sel.role || t.role === sel.role) Object.assign(t, { font: sel.font, size: sel.size, color: sel.color, lh: sel.lh, bold: sel.bold, align: sel.align }); }); buildStrip(); draw(); }
function syncPanel() {
  const on = !!sel; document.querySelectorAll('#wControls [data-need]').forEach(el => el.disabled = !on);
  document.querySelectorAll('#swatches .sw').forEach(b => { b.disabled = !on; b.setAttribute('aria-pressed', !!(on && sel.color.toLowerCase() === b.dataset.c)); });
  if (!on) { $('wText').value = ''; return; }
  $('wText').value = sel.text; $('wFont').value = sel.font; $('wSize').value = Math.min(120, sel.size); $('wSizeN').value = sel.size;
  $('wColor').value = sel.color; $('wLh').value = sel.lh; $('wBold').checked = sel.bold;
  document.querySelectorAll('[data-align]').forEach(b => b.setAttribute('aria-pressed', b.dataset.align === sel.align));
}
function upd(f, sync) { if (!sel) return; f(sel); if (sync) syncPanel(); draw(); clearTimeout(upd.t); upd.t = setTimeout(buildStrip, 250); }
function refreshFonts() { const f = $('wFont'), v = f.value; f.replaceChildren(...fontList.map(x => { const o = document.createElement('option'); o.value = x.name; o.textContent = x.label; return o; })); if (v) f.value = v; }
COLORS.forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sw'; b.style.background = c; b.dataset.c = c; b.title = c; b.addEventListener('click', () => upd(t => t.color = c, true)); $('swatches').insertBefore(b, $('wColor')); });
$('wAdd').addEventListener('click', () => addText());
$('wDel').addEventListener('click', delSel);
$('wAll').addEventListener('click', styleAll);
$('wText').addEventListener('input', e => upd(t => t.text = e.target.value));
$('wFont').addEventListener('change', e => upd(t => t.font = e.target.value));
$('wSize').addEventListener('input', e => { $('wSizeN').value = e.target.value; upd(t => t.size = +e.target.value); });
$('wSizeN').addEventListener('input', e => { const v = clamp(+e.target.value || 6, 6, 200); $('wSize').value = Math.min(120, v); upd(t => t.size = v); });
$('wColor').addEventListener('input', e => upd(t => t.color = e.target.value, true));
$('wLh').addEventListener('input', e => upd(t => t.lh = +e.target.value));
$('wBold').addEventListener('change', e => upd(t => t.bold = e.target.checked));
document.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => upd(t => t.align = b.dataset.align, true)));
$('wFontFile').addEventListener('change', async e => {
  for (const f of e.target.files) {
    try { const name = f.name.replace(/\.(ttf|otf|woff2?)$/i, ''); const ff = new FontFace(name, await f.arrayBuffer()); await ff.load(); document.fonts.add(ff);
      if (!fontList.some(x => x.name === name)) fontList.push({ name, label: name }); refreshFonts(); if (sel) { $('wFont').value = name; upd(t => t.font = name); } }
    catch { alert(`Could not read the font ${f.name}`); }
  }
  e.target.value = '';
});

// ---- script (.md) import: places every scene's words automatically
function parseScript(txt) {
  const out = {}, clean = v => v.replace(/\*\*|__|`/g, '').trim();
  for (const line of txt.split(/\r?\n/)) {   // table rows: | 3 | story words | label |
    const m = line.match(/^\s*\|\s*(\d{1,2})\s*\|(.*)$/); if (!m) continue;
    const cells = m[2].split('|').map(clean); out[+m[1]] = { story: cells[0] || '', label: cells[1] || '' };
  }
  if (Object.keys(out).length) return out;
  let cur = null;   // or headings: "## Scene 3", then lines; "label: …" for the small label
  for (const line of txt.split(/\r?\n/)) {
    const h = line.match(/^\s*#{1,6}\s*(?:scene\s*)?(\d{1,2})\b/i); if (h) { cur = +h[1]; out[cur] = { story: '', label: '' }; continue; }
    if (cur == null || !line.trim()) continue;
    const l = line.match(/^\s*(label|small|note)\s*:\s*(.*)$/i);
    if (l) out[cur].label = clean(l[2]); else out[cur].story = (out[cur].story ? out[cur].story + ' ' : '') + clean(line);
  }
  return out;
}
function calmBand(sc) {   // is the top or the bottom of this scene calmer, and is it light or dark?
  const c = document.createElement('canvas'); c.width = 40; c.height = 50; const g = c.getContext('2d');
  const keep = texts; texts = []; paperTo(g, 0, 0, 40, sceneTop(sc), sceneTop(sc) + SCENE, 40 / PAPER_W); texts = keep;
  const d = g.getImageData(0, 0, 40, 50).data, band = (y0, y1) => { const v = []; for (let y = y0; y < y1; y++) for (let x = 3; x < 37; x++) { const i = (y * 40 + x) * 4; v.push(d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114); }
    const m = v.reduce((a, b) => a + b, 0) / v.length; return { m, sd: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) }; };
  const top = band(3, 18), bot = band(32, 47); return top.sd <= bot.sd ? { where: 'top', ...top } : { where: 'bottom', ...bot };
}
$('wScript').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const sc = parseScript(await f.text()), keys = Object.keys(sc).map(Number).filter(n => n >= 1 && n <= N);
  if (!keys.length) { alert('No scenes found. Use a table (| 1 | words | label |) or headings (## Scene 1).'); return; }
  if (texts.length && !confirm(`Replace the current words with the script (${keys.length} scenes)?`)) return;
  const base = defaults(); texts = [];
  for (const n of keys) {
    const band = calmBand(n), color = band.m > 150 ? '#151515' : '#fffaf0', x = 0.5 + SAFE + 2, w = WIN_W - 2 * SAFE - 4, isTitle = n === 1;
    const story = { id: nextId++, role: 'story', scene: n, x, y: 0, w, text: sc[n].story, ...base, color, size: isTitle ? 30 : 16, align: isTitle ? 'center' : 'left', bold: true, lh: 1.25 };
    const sh = sc[n].story ? textBox(story).h : 0;
    if (sc[n].story) { story.y = band.where === 'top' ? SAFE + 4 : SCENE - SAFE - 4 - sh; texts.push(story); }
    if (sc[n].label) { const lab = { id: nextId++, role: 'label', scene: n, x, y: 0, w, text: sc[n].label, ...base, color, size: 9, bold: false, lh: 1.2, align: isTitle ? 'center' : 'left' };
      const lh = textBox(lab).h; lab.y = band.where === 'top' ? SAFE + 4 + sh + 3 : (sc[n].story ? story.y - lh - 2 : SCENE - SAFE - 4 - lh); texts.push(lab); }
  }
  sel = null; setView('words'); es = LEAD; syncPanel(); buildStrip(); draw();
});
// ---- save / open words, export PNG (saved on the user's own device)
function saveFile(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
$('wSave').addEventListener('click', () => saveFile('scrolli_words.json', new Blob([JSON.stringify({ format: 'scrolli-words-1', scenes: N, units: 'mm, pt', fonts: fontList.map(f => f.name), texts }, null, 1)], { type: 'application/json' })));
$('wLoad').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const d = JSON.parse(await f.text()); texts = d.texts || []; nextId = 1 + Math.max(0, ...texts.map(t => t.id || 0));
    const missing = [...new Set(texts.map(t => t.font))].filter(n => !fontList.some(x => x.name === n)); if (missing.length) alert('Add these font files again: ' + missing.join(', '));
    sel = null; syncPanel(); buildStrip(); draw(); } catch { alert('That is not a Scrolli words file.'); } });
$('wPng').addEventListener('click', () => { const sc = 750 / (PAPER_W + 2 * BLEED), c = document.createElement('canvas'); c.width = Math.round(PAPER_W * sc); c.height = Math.round(total(N) * sc);
  const g = c.getContext('2d'); paperTo(g, 0, 0, c.width, 0, total(N), sc); c.toBlob(b => saveFile('scrolli_preview.png', b), 'image/png'); });

// ================= WHOLE-SCROLL STRIP =================
let stripBase = null, sk = 1;
function buildStrip() {
  const box = $('stripBox'), w = Math.max(60, box.clientWidth), dpr = Math.min(2, devicePixelRatio || 1);
  sk = w / PAPER_W; const h = total(N) * sk;
  strip.style.width = w + 'px'; strip.style.height = h + 'px'; strip.width = Math.round(w * dpr); strip.height = Math.round(h * dpr);
  stripBase = document.createElement('canvas'); stripBase.width = strip.width; stripBase.height = strip.height;
  const g = stripBase.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  paperTo(g, 0, 0, w, 0, total(N), sk); g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, 0, w, LEAD * sk); g.fillRect(0, h - LEAD * sk, w, LEAD * sk);
  g.strokeStyle = 'rgba(47,127,209,.8)'; g.lineWidth = 1; g.font = '600 9px Inter, system-ui';
  for (let i = 0; i <= N; i++) { const y = sceneTop(i + 1) * sk; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); if (i < N) { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(2, y + 2, 16, 11); g.fillStyle = '#2f7fd1'; g.fillText(String(i + 1), 4, y + 11); } }
  drawStripMarker();
}
function drawStripMarker() {
  if (!stripBase) return; const w = parseFloat(strip.style.width), dpr = strip.width / w;
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, strip.width, strip.height); sctx.drawImage(stripBase, 0, 0);
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.strokeStyle = css('--accent') || '#e0761e'; sctx.lineWidth = 2.5;
  const top = view === 'roll' ? s : es, hh = view === 'roll' ? WIN_H : SCENE; sctx.strokeRect(1.5, top * sk, w - 3, hh * sk);
  const box = $('stripBox'), yT = top * sk, yB = yT + hh * sk; if (yT < box.scrollTop || yB > box.scrollTop + box.clientHeight) box.scrollTop = yT - box.clientHeight / 2 + hh * sk / 2;
}
strip.addEventListener('click', e => { const r = strip.getBoundingClientRect(), mm = (e.clientY - r.top) / sk; animateTo(view === 'roll' ? mm - WIN_H / 2 : mm - SCENE / 2); });

// ================= UI WIRING =================
function setView(v) {
  if (v === view) return; if (editing) commitInline(); hideMenu();
  if (v === 'words') es = clamp(sceneTop(sceneAt(s + WIN_H / 2)), 0, total(N) - SCENE); else s = clamp(es, minS(), maxS());
  view = v; $('viewRoll').setAttribute('aria-selected', v === 'roll'); $('viewWords').setAttribute('aria-selected', v === 'words');
  document.body.classList.toggle('wordsmode', v === 'words');
  $('hint').textContent = v === 'roll' ? 'Drag or scroll to roll · ↑ ↓ keys' : 'Drag to scroll · double-click to add or edit words · right-click for menu';
  draw();
}
$('viewRoll').addEventListener('click', () => setView('roll'));
$('viewWords').addEventListener('click', () => setView('words'));
document.querySelectorAll('[data-scenes]').forEach(b => b.addEventListener('click', () => {
  N = +b.dataset.scenes; radio('[data-scenes]', b);
  if (fileLabel === 'Demo scroll') { demo(); return; }
  if (segs.length) { if (segs.length === 1 && segs[0].top === 0) useStrip(segs[0].img, fileLabel); else useScenes(segs.map(x => x.img), fileLabel); }
  afterChange();
}));
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  upMode = b.dataset.mode; radio('[data-mode]', b); $('file').multiple = upMode === 'scenes';
  $('dropText').textContent = upMode === 'scenes' ? `⤒ Upload ${N} scene images` : '⤒ Upload scroll image';
}));
$('file').addEventListener('change', e => { load([...e.target.files]); e.target.value = ''; });
$('remove').addEventListener('click', removeScroll);
const dropT = $('drop');
['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); dropT.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); dropT.classList.remove('over'); }));
document.addEventListener('drop', e => { const fs = [...(e.dataTransfer?.files || [])]; if (fs.length) load(fs); });
$('prev').addEventListener('click', () => go(-1));
$('next').addEventListener('click', () => go(1));
$('guides').addEventListener('change', () => { $('tbGuides').classList.toggle('on', $('guides').checked); draw(); });
$('tbGuides').addEventListener('click', () => { $('guides').checked = !$('guides').checked; $('guides').dispatchEvent(new Event('change')); });

refreshFonts(); syncPanel(); demo();
new ResizeObserver(resize).observe($('viewer'));
new ResizeObserver(() => buildStrip()).observe($('stripBox'));
document.fonts.ready.then(() => Promise.all(['800 20px Nunito', '400 20px Nunito', '600 20px Inter'].map(f => document.fonts.load(f)))).then(() => { if (fileLabel === 'Demo scroll') demo(); else draw(); });
})();
