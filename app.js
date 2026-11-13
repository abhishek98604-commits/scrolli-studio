/* Scrolli Studio — scroll tester. Runs fully in the browser: files are read locally and never sent anywhere. */
(() => {
'use strict';
// ---- format (mm)
const PAPER_W = 121, BLEED = 3, SCENE = 150, LEAD = 125, WIN_W = 120, WIN_H = 150, WIN_R = 8, SAFE = 8;
const BOX_W = 160, BOX_H = 252, ROLL_Y = 95, ROLL_R = 14, KNOB_D = 36, KNOB_T = 10.5, HANDLE_R = 11.5;
const CLICK_MM = 2 * Math.PI * ROLL_R * 15 / 360;   // paper per 15° click, about 3.7 mm
const total = n => LEAD * 2 + SCENE * n;

// ---- state
let N = 16, mode = 'strip', segs = [], s = LEAD, target = null, k = 1, cx = 0, cy = 0, fileLabel = '';
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d'), strip = $('strip'), sctx = strip.getContext('2d');
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let urls = [];
// ---- words layer (all local)
let view = 'roll', editScene = 1, texts = [], sel = null, nextId = 1, edrag = null, ek = 1, eox = 0, eoy = 0;
const fontList = [{ name: 'Nunito', label: 'Nunito (default)' }];
const PT = 0.3528;   // mm per point

// ---- UI wiring
document.querySelectorAll('[data-scenes]').forEach(b => b.addEventListener('click', () => {
  N = +b.dataset.scenes; radio('[data-scenes]', b); $('counter').textContent = `Scene – / ${N}`;
  if (segs.length) { if (mode === 'strip') useStrip(segs[0].img, fileLabel); else useScenes(segs.map(x => x.img), fileLabel); }
  clampS(); buildStrip(); draw();
}));
document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.mode; radio('[data-mode]', b);
  const f = $('file'); f.multiple = mode === 'scenes';
  $('dropText').textContent = mode === 'scenes' ? `Drop all ${N} scene images here (named 01, 02, 03 …), or tap to choose` : 'Drop your vertical scroll image here, or tap to choose';
}));
function radio(sel, on) { document.querySelectorAll(sel).forEach(b => b.setAttribute('aria-checked', b === on)); }
$('file').addEventListener('change', e => load([...e.target.files]));
const drop = $('drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => load([...e.dataTransfer.files]));
$('demo').addEventListener('click', demo);
$('guides').addEventListener('change', draw);
$('prev').addEventListener('click', () => view === 'words' ? setScene(editScene - 1) : go(-1));
$('next').addEventListener('click', () => view === 'words' ? setScene(editScene + 1) : go(1));
window.addEventListener('keydown', e => {
  if (e.target.closest('input,button,textarea,select')) return;
  if (view === 'words') { if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { delSel(); e.preventDefault(); } return; }
  if (e.key === 'ArrowDown') { nudge(CLICK_MM); e.preventDefault(); }
  if (e.key === 'ArrowUp') { nudge(-CLICK_MM); e.preventDefault(); }
  if (e.key === 'PageDown' || e.key === ' ') { go(1); e.preventDefault(); }
  if (e.key === 'PageUp') { go(-1); e.preventDefault(); }
});

// ---- loading (local only)
function freeUrls() { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; }
function readImg(file) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(file); urls.push(u); const im = new Image();
    im.onload = () => res(im); im.onerror = () => rej(new Error(file.name)); im.src = u; });
}
async function load(files) {
  files = files.filter(f => /^image\//.test(f.type));
  if (!files.length) return;
  freeUrls();
  try {
    if (mode === 'strip') { const im = await readImg(files[0]); useStrip(im, files[0].name); }
    else {
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      const ims = await Promise.all(files.map(readImg)); useScenes(ims, `${files.length} files`);
    }
  } catch (err) { report([['bad', `Could not open ${err.message}. On phones, very tall images can be too big; try "Scene by scene".`]]); return; }
  s = LEAD; clampS(); buildStrip(); draw();
}
function useStrip(im, name) {
  fileLabel = name; const w = im.naturalWidth, h = im.naturalHeight, r = h / w;
  const rB = (total(N) + 2 * BLEED) / (PAPER_W + 2 * BLEED), rN = total(N) / PAPER_W;
  const bleed = Math.abs(r / rB - 1) <= Math.abs(r / rN - 1);
  const mmPerPx = (bleed ? PAPER_W + 2 * BLEED : PAPER_W) / w, b = bleed ? BLEED / mmPerPx : 0;
  const len = h * mmPerPx - (bleed ? 2 * BLEED : 0);
  segs = [{ img: im, top: 0, h: len, sx: b, sy: b, sw: w - 2 * b, sh: h - 2 * b }];
  const dpi = w / ((bleed ? PAPER_W + 2 * BLEED : PAPER_W) / 25.4), off = len / total(N) - 1;
  const fits = n => bleed ? (r * (PAPER_W + 2 * BLEED) - 2 * BLEED - 2 * LEAD) / SCENE : (r * PAPER_W - 2 * LEAD) / SCENE;
  const c = [['info', `${name}: ${w} × ${h} px`], ['ok', bleed ? 'Includes 3 mm bleed (127 mm wide)' : 'No bleed found (121 mm wide). Add 3 mm each side before printing.']];
  c[1][0] = bleed ? 'ok' : 'warn';
  if (Math.abs(off) < 0.015) c.push(['ok', `Length matches ${N} scenes (${(total(N) / 1000).toFixed(2)} m)`]);
  else c.push(['bad', `Length is ${(len / 1000).toFixed(2)} m, but ${N} scenes needs ${(total(N) / 1000).toFixed(2)} m. This file looks like about ${fits().toFixed(1)} scenes.`]);
  c.push(dpi >= 290 ? ['ok', `${Math.round(dpi)} dpi: print-ready`] : dpi >= 140 ? ['ok', `${Math.round(dpi)} dpi: fine for testing (print needs 300 dpi)`] : ['warn', `${Math.round(dpi)} dpi: low, will look soft. Test at 150 dpi, print at 300 dpi.`]);
  if (w * h > 16.7e6) c.push(['warn', 'Very large image: some phones cannot open it. Use "Scene by scene" for phones.']);
  report(c);
}
function useScenes(ims, label) {
  fileLabel = label; segs = []; const c = [['info', `${ims.length} scene images`]];
  if (ims.length !== N) c.push(['bad', `You chose ${N} scenes but gave ${ims.length} images.`]); else c.push(['ok', `${N} scenes, in file-name order`]);
  let badRatio = 0, minDpi = 1e9;
  ims.forEach((im, i) => {
    const w = im.naturalWidth, h = im.naturalHeight, r = h / w, want = SCENE / PAPER_W;
    if (Math.abs(r / want - 1) > 0.02) badRatio++;
    minDpi = Math.min(minDpi, w / (PAPER_W / 25.4));
    if (i < N) segs.push({ img: im, top: LEAD + i * SCENE, h: SCENE, sx: 0, sy: 0, sw: w, sh: h });
  });
  c.push(badRatio ? ['warn', `${badRatio} image(s) are not 121 × 150 mm in shape; they are stretched to fit.`] : ['ok', 'Every scene is 121 × 150 mm in shape']);
  c.push(minDpi >= 290 ? ['ok', `${Math.round(minDpi)} dpi or more: print-ready`] : minDpi >= 140 ? ['ok', `${Math.round(minDpi)} dpi: fine for testing`] : ['warn', `${Math.round(minDpi)} dpi: low, will look soft`]);
  report(c);
}
function report(items) {
  $('checks').hidden = false;
  $('checkList').replaceChildren(...items.map(([t, m]) => { const li = document.createElement('li'); li.className = t; li.textContent = m; return li; }));
}

// ---- demo scroll (made on the fly, nothing downloaded)
function demo() {
  freeUrls(); const ims = [], cols = ['#e8423c', '#f6b52a', '#2f72c0', '#f4a6c4', '#2c6a4c', '#f27c2a', '#b9a7dc', '#82d0e3', '#b9d66a'];
  for (let i = 0; i < N; i++) {
    const c = document.createElement('canvas'); c.width = 726; c.height = 900; const g = c.getContext('2d');
    g.fillStyle = '#f2ebdf'; g.fillRect(0, 0, 726, 900);
    const a = cols[i % cols.length], b = cols[(i + 3) % cols.length];
    for (let j = 0; j < 7; j++) { g.fillStyle = cols[(i + j) % cols.length]; g.beginPath(); g.arc(80 + j * 95, 60 + (j % 2) * 20, 22, 0, 7); g.fill(); g.beginPath(); g.arc(80 + j * 95, 840 - (j % 2) * 20, 22, 0, 7); g.fill(); }
    g.fillStyle = a; g.fillRect(70, 260, 586, 380); g.fillStyle = b; g.beginPath(); g.arc(363, 450, 140, 0, 7); g.fill();
    g.fillStyle = '#151515'; g.textAlign = 'center'; g.font = '900 120px system-ui,sans-serif';
    g.fillText(i === 0 ? 'HELLO' : i === N - 1 ? 'THE END' : String(i + 1).padStart(2, '0'), 363, 495);
    g.font = '600 44px system-ui,sans-serif'; g.fillText(i === 0 ? 'demo scroll' : i === N - 1 ? 'credits go here' : `scene ${i + 1}`, 363, 720);
    ims.push(c);
  }
  segs = ims.map((im, i) => ({ img: im, top: LEAD + i * SCENE, h: SCENE, sx: 0, sy: 0, sw: im.width, sh: im.height }));
  fileLabel = 'demo'; report([['info', `Demo scroll, ${N} scenes. Load your own file to test it.`]]);
  s = LEAD; buildStrip(); draw();
}

// ---- motion
const minS = () => LEAD - 40, maxS = () => total(N) - LEAD - WIN_H + 40;
function clampS() { s = Math.max(minS(), Math.min(maxS(), s)); }
function sceneAt() { return Math.max(1, Math.min(N, Math.floor((s + WIN_H / 2 - LEAD) / SCENE) + 1)); }
function go(d) { const cur = Math.round((s - LEAD) / SCENE); animateTo(LEAD + Math.max(0, Math.min(N - 1, cur + d)) * SCENE); }
function nudge(mm) { animateTo((target ?? s) + mm); }
function snap() { if (!$('clicks').checked) return; animateTo(LEAD + Math.round((s - LEAD) / CLICK_MM) * CLICK_MM); }
function animateTo(t) {
  target = Math.max(minS(), Math.min(maxS(), t));
  const step = () => { if (target === null) return; const d = target - s; s += Math.abs(d) < 0.2 ? d : d * 0.22; if (Math.abs(d) < 0.2) target = null; draw(); if (target !== null) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
let drag = null;
cv.addEventListener('pointerdown', e => { if (view === 'words') return edDown(e); target = null; drag = { y: e.clientY, s }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (view === 'words') return edMove(e); if (!drag) return; s = drag.s - (e.clientY - drag.y) / k; clampS(); draw(); });
cv.addEventListener('pointerup', () => { if (view === 'words') { edrag = null; buildStrip(); return; } drag = null; snap(); });
cv.addEventListener('pointercancel', () => { drag = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); if (view === 'words') return; nudge(Math.sign(e.deltaY) * CLICK_MM * Math.max(1, Math.round(Math.abs(e.deltaY) / 60))); }, { passive: false });

// ---- drawing helpers (box coordinates in mm, origin = box centre, y down)
const X = x => cx + x * k, Y = y => cy + y * k;
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function paperTo(g, x0, y0, w, mmTop, mmBot, scale) {
  // draws paper between mmTop..mmBot at screen (x0, y0) with px-per-mm = scale
  g.fillStyle = '#ffffff'; g.fillRect(x0, y0, w, (mmBot - mmTop) * scale);
  for (const sg of segs) {
    const a = Math.max(mmTop, sg.top), b = Math.min(mmBot, sg.top + sg.h); if (b <= a) continue;
    const syA = sg.sy + (a - sg.top) / sg.h * sg.sh, syB = sg.sy + (b - sg.top) / sg.h * sg.sh;
    g.drawImage(sg.img, sg.sx, syA, sg.sw, syB - syA, x0, y0 + (a - mmTop) * scale, w, (b - a) * scale);
  }
  drawTexts(g, x0, y0, mmTop, mmBot, scale, w);
}
function fontStr(t, px) { return `${t.bold ? 800 : 400} ${px}px "${t.font}", system-ui, sans-serif`; }
function layout(g, t, scale) {   // wraps lines to the box width; returns lines + line height in px
  const px = t.size * PT * scale; g.font = fontStr(t, px); const maxW = t.w * scale, lines = [];
  for (const para of t.text.split('\n')) { let cur = '';
    for (const word of para.split(' ')) { const tr = cur ? cur + ' ' + word : word; if (g.measureText(tr).width <= maxW || !cur) cur = tr; else { lines.push(cur); cur = word; } }
    lines.push(cur); }
  return { lines, lh: px * t.lh, px };
}
function textBox(t) { const g = document.createElement('canvas').getContext('2d'); const L = layout(g, t, 10); return { x: t.x, y: t.y, w: t.w, h: L.lines.length * L.lh / 10 }; }
function drawTexts(g, x0, y0, mmTop, mmBot, scale, w) {
  if (!texts.length) return;
  const pxPerMm = w / PAPER_W;
  for (const t of texts) {
    const top = LEAD + (t.scene - 1) * SCENE + t.y; const bb = textBox(t);
    if (top > mmBot || top + bb.h < mmTop || t.scene > N) continue;
    const L = layout(g, t, pxPerMm); g.save(); g.fillStyle = t.color; g.textBaseline = 'alphabetic';
    g.textAlign = t.align; const ax = t.align === 'center' ? t.x + t.w / 2 : t.align === 'right' ? t.x + t.w : t.x;
    L.lines.forEach((ln, i) => g.fillText(ln, x0 + ax * pxPerMm, y0 + (top - mmTop) * pxPerMm + L.px * 0.9 + i * L.lh));
    g.restore();
  }
}

// ---- main view
function resize() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fullW = BOX_W + 2 * (KNOB_T + 14), fullH = BOX_H + 30;
  k = Math.min(r.width / fullW, r.height / fullH); cx = r.width / 2; cy = r.height / 2;
  buildStrip(); draw();
}
function draw() {
  if (view === 'words') { drawEdit(); drawStripMarker(); return; }
  const r = cv.getBoundingClientRect(), wire = css('--wire') || '#222', acc = css('--accent') || '#e0761e', muted = css('--muted') || '#888';
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lw = Math.max(1, k * 0.45);
  // paper in the window
  ctx.save(); rrect(ctx, X(-WIN_W / 2), Y(-WIN_H / 2), WIN_W * k, WIN_H * k, WIN_R * k); ctx.clip();
  if (segs.length) paperTo(ctx, X(-PAPER_W / 2), Y(-WIN_H / 2), PAPER_W * k, s, s + WIN_H, k);
  else { ctx.fillStyle = '#fff'; ctx.fillRect(X(-WIN_W / 2), Y(-WIN_H / 2), WIN_W * k, WIN_H * k);
    ctx.fillStyle = muted; ctx.font = `600 ${Math.max(12, 5 * k)}px system-ui`; ctx.textAlign = 'center';
    ctx.fillText('Your scroll shows here', X(0), Y(-4)); ctx.font = `${Math.max(11, 3.6 * k)}px system-ui`; ctx.fillText('choose a file or try the demo', X(0), Y(6));
    drawTexts(ctx, X(-PAPER_W / 2), Y(-WIN_H / 2), s, s + WIN_H, k, PAPER_W * k); }
  if ($('guides').checked) {
    for (let i = 0; i <= N; i++) {
      const yy = LEAD + i * SCENE - s - WIN_H / 2; if (yy < -WIN_H / 2 - 1 || yy > WIN_H / 2 + 1) continue;
      ctx.strokeStyle = '#2f7fd1'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(X(-WIN_W / 2), Y(yy)); ctx.lineTo(X(WIN_W / 2), Y(yy)); ctx.stroke();
      if (i < N) { ctx.fillStyle = '#2f7fd1'; ctx.font = `700 ${Math.max(11, 3.4 * k)}px system-ui`; ctx.textAlign = 'left'; ctx.fillText(`SCENE ${i + 1}`, X(-WIN_W / 2 + 3), Y(yy + 5)); }
    }
    ctx.strokeStyle = '#2fae6b'; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
    for (let i = 0; i < N; i++) { const t = LEAD + i * SCENE - s - WIN_H / 2; if (t > WIN_H / 2 || t + SCENE < -WIN_H / 2) continue;
      ctx.strokeRect(X(-WIN_W / 2 + SAFE), Y(t + SAFE), (WIN_W - 2 * SAFE) * k, (SCENE - 2 * SAFE) * k); }
    ctx.setLineDash([]);
  }
  ctx.restore();
  // ---- wireframe box
  ctx.strokeStyle = wire; ctx.lineWidth = lw; ctx.setLineDash([]);
  rrect(ctx, X(-BOX_W / 2), Y(-BOX_H / 2), BOX_W * k, BOX_H * k, 6 * k); ctx.stroke();               // body / lid outline
  rrect(ctx, X(-BOX_W / 2 + 3), Y(-BOX_H / 2 + 3), (BOX_W - 6) * k, (BOX_H - 6) * k, 4 * k); ctx.globalAlpha = .35; ctx.stroke(); ctx.globalAlpha = 1;
  rrect(ctx, X(-WIN_W / 2), Y(-WIN_H / 2), WIN_W * k, WIN_H * k, WIN_R * k); ctx.lineWidth = lw * 1.6; ctx.stroke(); ctx.lineWidth = lw;   // window
  rrect(ctx, X(-WIN_W / 2 - 2.5), Y(-WIN_H / 2 - 2.5), (WIN_W + 5) * k, (WIN_H + 5) * k, (WIN_R + 2.5) * k); ctx.globalAlpha = .35; ctx.stroke(); ctx.globalAlpha = 1;
  // hidden rolls + paper path (dashed)
  ctx.setLineDash([4, 4]); ctx.globalAlpha = .55;
  const prog = (s - LEAD) / (total(N) - 2 * LEAD - WIN_H);   // 0 at start, 1 at end
  for (const [sgn, fill] of [[-1, 1 - prog], [1, prog]]) {
    const rr = 12.5 + 4 * Math.max(0, Math.min(1, fill));
    ctx.strokeRect(X(-PAPER_W / 2), Y(sgn * ROLL_Y - rr), PAPER_W * k, 2 * rr * k);
    ctx.beginPath(); ctx.moveTo(X(-PAPER_W / 2 - 3), Y(sgn * ROLL_Y)); ctx.lineTo(X(PAPER_W / 2 + 3), Y(sgn * ROLL_Y)); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  // hinge marks (far end, top) and finger groove (near end, bottom)
  for (const xx of [-55, 55]) { ctx.strokeRect(X(xx - 5), Y(-BOX_H / 2 - 2.5), 10 * k, 2.5 * k); }
  ctx.beginPath(); ctx.ellipse(X(0), Y(BOX_H / 2), 25 * k, 3 * k, 0, Math.PI, 0); ctx.stroke();
  // dials (4): knob seen from above, knurl lines move as it turns
  const ang = (s - LEAD) / ROLL_R;
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const yc = sy * ROLL_Y, x0 = sx > 0 ? BOX_W / 2 + 1.5 : -BOX_W / 2 - 1.5 - KNOB_T;
    ctx.strokeStyle = wire; ctx.lineWidth = lw;
    rrect(ctx, X(x0), Y(yc - KNOB_D / 2), KNOB_T * k, KNOB_D * k, 2.5 * k); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(sx > 0 ? BOX_W / 2 : -BOX_W / 2), Y(yc - 7)); ctx.lineTo(X(sx > 0 ? BOX_W / 2 + 1.5 : -BOX_W / 2 - 1.5), Y(yc - 7));
    ctx.moveTo(X(sx > 0 ? BOX_W / 2 : -BOX_W / 2), Y(yc + 7)); ctx.lineTo(X(sx > 0 ? BOX_W / 2 + 1.5 : -BOX_W / 2 - 1.5), Y(yc + 7)); ctx.stroke();
    ctx.lineWidth = Math.max(.6, lw * .55); ctx.globalAlpha = .7;
    for (let i = 0; i < 24; i++) { const t = ang + i * Math.PI / 12; if (Math.cos(t) <= 0) continue;
      const yy = yc + KNOB_D / 2 * Math.sin(t) * .96; ctx.beginPath(); ctx.moveTo(X(x0 + 1.2), Y(yy)); ctx.lineTo(X(x0 + KNOB_T - 1.2), Y(yy)); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.lineWidth = lw;
    // handle peg + dot
    const th = ang, front = Math.cos(th) > 0, yh = yc + HANDLE_R * Math.sin(th), hx0 = sx > 0 ? x0 + KNOB_T : x0 - 8.5;
    ctx.setLineDash(front ? [] : [3, 3]); ctx.globalAlpha = front ? 1 : .45;
    rrect(ctx, X(hx0), Y(yh - 4.2), 8.5 * k, 8.4 * k, 4 * k); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const td = th - Math.PI / 2; if (Math.cos(td) > 0) { ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(X(sx > 0 ? x0 + KNOB_T + .4 : x0 - .4), Y(yc + 13 * Math.sin(td)), 1.6 * k, 0, 7); ctx.fill(); }
  }
  // labels
  ctx.fillStyle = muted; ctx.font = `${Math.max(10, 3 * k)}px system-ui`; ctx.textAlign = 'center';
  ctx.fillText('start', X(0), Y(-BOX_H / 2 - 6)); ctx.fillText('end', X(0), Y(BOX_H / 2 + 9));
  const sc = sceneAt(); $('counter').textContent = segs.length ? `Scene ${sc} / ${N}${sc === 1 ? ' · title' : sc === N ? ' · end' : ''}` : `Scene – / ${N}`;
  drawStripMarker();
}

// ---- whole-strip panel
let stripBase = null, sk = 1;
function buildStrip() {
  const box = $('stripBox'), w = Math.max(80, box.clientWidth - 2), dpr = Math.min(2, devicePixelRatio || 1);
  sk = w / PAPER_W; const h = total(N) * sk;
  strip.style.width = w + 'px'; strip.style.height = h + 'px'; strip.width = Math.round(w * dpr); strip.height = Math.round(h * dpr);
  stripBase = document.createElement('canvas'); stripBase.width = strip.width; stripBase.height = strip.height;
  const g = stripBase.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#efefef'; g.fillRect(0, 0, w, LEAD * sk); g.fillRect(0, h - LEAD * sk, w, LEAD * sk);
  if (segs.length) paperTo(g, 0, 0, w, 0, total(N), sk); else drawTexts(g, 0, 0, 0, total(N), sk, w);
  g.strokeStyle = 'rgba(47,127,209,.9)'; g.lineWidth = 1; g.font = '600 10px system-ui'; g.fillStyle = '#2f7fd1';
  for (let i = 0; i <= N; i++) { const y = (LEAD + i * SCENE) * sk; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); if (i < N) { g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(2, y + 2, 20, 12); g.fillStyle = '#2f7fd1'; g.fillText(String(i + 1), 4, y + 12); } }
  drawStripMarker();
}
function drawStripMarker() {
  if (!stripBase) return; const dpr = strip.width / parseFloat(strip.style.width);
  sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, strip.width, strip.height); sctx.drawImage(stripBase, 0, 0);
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0); sctx.strokeStyle = css('--accent') || '#e0761e'; sctx.lineWidth = 2.5;
  const w = parseFloat(strip.style.width); sctx.strokeRect(1.5, s * sk, w - 3, WIN_H * sk);
  const box = $('stripBox'); if (!drag && target === null) return;
  const yTop = s * sk, yb = yTop + WIN_H * sk; if (yTop < box.scrollTop || yb > box.scrollTop + box.clientHeight) box.scrollTop = yTop - box.clientHeight / 2 + WIN_H * sk / 2;
}
strip.addEventListener('click', e => { const r = strip.getBoundingClientRect(); animateTo((e.clientY - r.top) / sk - WIN_H / 2); });

// ================= WORDS EDITOR =================
const sceneTop = i => LEAD + (i - 1) * SCENE;
function setScene(i) { editScene = Math.max(1, Math.min(N, i)); sel = null; syncPanel(); s = sceneTop(editScene); clampS(); draw(); }
function drawEdit() {
  const r = cv.getBoundingClientRect(); ctx.clearRect(0, 0, r.width, r.height);
  ek = Math.min((r.width - 40) / (PAPER_W + 30), (r.height - 50) / (SCENE + 12)); eox = (r.width - PAPER_W * ek) / 2; eoy = 30;
  const top = sceneTop(editScene);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 12; ctx.fillStyle = '#fff'; ctx.fillRect(eox, eoy, PAPER_W * ek, SCENE * ek); ctx.restore();
  if (segs.length) paperTo(ctx, eox, eoy, PAPER_W * ek, top, top + SCENE, ek); else { drawTexts(ctx, eox, eoy, top, top + SCENE, ek, PAPER_W * ek); }
  // window + safe zone
  ctx.strokeStyle = '#2f7fd1'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
  rrect(ctx, eox + 0.5 * ek, eoy, WIN_W * ek, SCENE * ek, WIN_R * ek); ctx.stroke();
  ctx.strokeStyle = '#2fae6b'; ctx.strokeRect(eox + (0.5 + SAFE) * ek, eoy + SAFE * ek, (WIN_W - 2 * SAFE) * ek, (SCENE - 2 * SAFE) * ek); ctx.setLineDash([]);
  // boxes
  for (const t of texts) { if (t.scene !== editScene) continue; const b = textBox(t), on = t === sel;
    const out = b.x < 0.5 + SAFE || b.y < SAFE || b.x + b.w > WIN_W + 0.5 - SAFE || b.y + b.h > SCENE - SAFE;
    ctx.strokeStyle = out ? '#c8322b' : (on ? (css('--accent') || '#e0761e') : 'rgba(0,0,0,.25)'); ctx.lineWidth = on ? 2 : 1; ctx.setLineDash(on ? [] : [3, 3]);
    ctx.strokeRect(eox + b.x * ek, eoy + b.y * ek, b.w * ek, Math.max(b.h, 4) * ek); ctx.setLineDash([]);
    if (on) { ctx.fillStyle = css('--accent') || '#e0761e'; ctx.fillRect(eox + (b.x + b.w) * ek - 5, eoy + (b.y + b.h / 2) * ek - 9, 10, 18); }
  }
  ctx.fillStyle = css('--muted') || '#888'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'left';
  ctx.fillText(`Scene ${editScene} · drag words to place · orange handle = width · red box = outside safe zone`, 16, 18);
  $('counter').textContent = `Scene ${editScene} / ${N}`;
}
function toMm(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - eox) / ek, y: (e.clientY - r.top - eoy) / ek }; }
function edDown(e) {
  const p = toMm(e); cv.setPointerCapture(e.pointerId);
  const mine = texts.filter(t => t.scene === editScene).reverse();
  for (const t of mine) { const b = textBox(t);
    if (Math.abs(p.x - (b.x + b.w)) < 8 / ek && p.y > b.y - 2 && p.y < b.y + b.h + 2 && t === sel) { edrag = { t, mode: 'w', x0: p.x, w0: t.w }; return; }
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + Math.max(b.h, 4)) { sel = t; edrag = { t, mode: 'm', dx: p.x - t.x, dy: p.y - t.y }; syncPanel(); draw(); return; } }
  sel = null; syncPanel(); draw();
}
function edMove(e) {
  if (!edrag) return; const p = toMm(e), t = edrag.t;
  if (edrag.mode === 'm') { t.x = Math.round((p.x - edrag.dx) * 2) / 2; t.y = Math.round((p.y - edrag.dy) * 2) / 2; }
  else t.w = Math.max(15, Math.round((edrag.w0 + p.x - edrag.x0) * 2) / 2);
  draw();
}
function addText() {
  const last = sel || texts[texts.length - 1];
  const t = { id: nextId++, scene: editScene, x: 0.5 + SAFE + 4, y: SAFE + 6, w: WIN_W - 2 * SAFE - 8, text: 'Type your words here',
    font: last ? last.font : 'Nunito', size: last ? last.size : 16, color: last ? last.color : '#151515', align: last ? last.align : 'left', lh: last ? last.lh : 1.25, bold: last ? last.bold : true };
  texts.push(t); sel = t; syncPanel(); buildStrip(); draw(); $('wText').focus(); $('wText').select();
}
function delSel() { texts = texts.filter(t => t !== sel); sel = null; syncPanel(); buildStrip(); draw(); }
function syncPanel() {
  const on = !!sel; document.querySelectorAll('#wControls [data-need]').forEach(el => el.disabled = !on);
  if (!on) { $('wText').value = ''; return; }
  $('wText').value = sel.text; $('wFont').value = sel.font; $('wSize').value = sel.size; $('wSizeN').value = sel.size;
  $('wColor').value = sel.color; $('wLh').value = sel.lh; $('wBold').checked = sel.bold;
  document.querySelectorAll('[data-align]').forEach(b => b.setAttribute('aria-pressed', b.dataset.align === sel.align));
}
function upd(f) { if (!sel) return; f(sel); draw(); clearTimeout(upd.t); upd.t = setTimeout(buildStrip, 250); }
function refreshFonts() { const f = $('wFont'), v = f.value; f.replaceChildren(...fontList.map(x => { const o = document.createElement('option'); o.value = x.name; o.textContent = x.label; return o; })); if (v) f.value = v; }
$('viewRoll').addEventListener('click', () => { view = 'roll'; radio('[data-view]', $('viewRoll')); $('wordsPanel').hidden = true; $('hintRoll').hidden = false; document.body.classList.remove('wordsmode'); s = sceneTop(editScene); clampS(); draw(); });
$('viewWords').addEventListener('click', () => { view = 'words'; radio('[data-view]', $('viewWords')); $('wordsPanel').hidden = false; $('hintRoll').hidden = true; document.body.classList.add('wordsmode'); editScene = Math.max(1, Math.min(N, sceneAt())); syncPanel(); draw(); });
$('wAdd').addEventListener('click', addText);
$('wDel').addEventListener('click', delSel);
$('wText').addEventListener('input', e => upd(t => t.text = e.target.value));
$('wFont').addEventListener('change', e => upd(t => t.font = e.target.value));
$('wSize').addEventListener('input', e => { $('wSizeN').value = e.target.value; upd(t => t.size = +e.target.value); });
$('wSizeN').addEventListener('input', e => { const v = Math.max(6, Math.min(200, +e.target.value || 6)); $('wSize').value = v; upd(t => t.size = v); });
$('wColor').addEventListener('input', e => upd(t => t.color = e.target.value));
$('wLh').addEventListener('input', e => upd(t => t.lh = +e.target.value));
$('wBold').addEventListener('change', e => upd(t => t.bold = e.target.checked));
document.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => { upd(t => t.align = b.dataset.align); syncPanel(); }));
$('wAll').addEventListener('click', () => { if (!sel) return; texts.forEach(t => { t.font = sel.font; t.size = sel.size; t.color = sel.color; t.lh = sel.lh; t.bold = sel.bold; t.align = sel.align; }); buildStrip(); draw(); });
$('wFontFile').addEventListener('change', async e => {
  for (const f of e.target.files) {
    try { const name = f.name.replace(/\.(ttf|otf|woff2?)$/i, ''); const ff = new FontFace(name, await f.arrayBuffer()); await ff.load(); document.fonts.add(ff);
      if (!fontList.some(x => x.name === name)) fontList.push({ name, label: name }); refreshFonts(); if (sel) { $('wFont').value = name; upd(t => t.font = name); } }
    catch { alert(`Could not read the font ${f.name}`); }
  }
  e.target.value = '';
});
// save / load the words (a small file on the user's own device)
function saveFile(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
$('wSave').addEventListener('click', () => saveFile('scrolli_words.json', new Blob([JSON.stringify({ format: 'scrolli-words-1', scenes: N, units: 'mm, pt', fonts: fontList.map(f => f.name), texts }, null, 1)], { type: 'application/json' })));
$('wLoad').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await f.text()); texts = d.texts || []; nextId = 1 + Math.max(0, ...texts.map(t => t.id || 0));
    const missing = [...new Set(texts.map(t => t.font))].filter(n => !fontList.some(x => x.name === n)); if (missing.length) alert('Add these font files again: ' + missing.join(', '));
    sel = null; syncPanel(); buildStrip(); draw(); } catch { alert('That file is not a Scrolli words file.'); } e.target.value = ''; });
$('wPng').addEventListener('click', () => { const sc = 750 / (PAPER_W + 2 * BLEED), c = document.createElement('canvas'); c.width = Math.round(PAPER_W * sc); c.height = Math.round(total(N) * sc);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); paperTo(g, 0, 0, c.width, 0, total(N), sc); c.toBlob(b => saveFile('scrolli_preview_with_words.png', b), 'image/png'); });
refreshFonts(); syncPanel();
document.fonts.load('800 20px Nunito').then(() => document.fonts.load('400 20px Nunito')).then(() => { buildStrip(); draw(); });

new ResizeObserver(resize).observe($('viewer'));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
resize();
})();
