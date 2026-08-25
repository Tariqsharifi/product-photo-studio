/* app.js — منطق اصلی «استودیو محصول» */
(() => {
'use strict';

const MAX_DIM = 1400;       // حداکثر ابعاد کاری برای ادیت (سرعت بیشتر روی موبایل)
const HISTORY_LIMIT = 12;

/* ---------------------------------------------------------------- */
/* وضعیت برنامه                                                      */
/* ---------------------------------------------------------------- */
const S = {
  subjectCanvas: null,      // RGBA فعلی (پس از برش/چرخش/حذف پس‌زمینه/قلم‌مو)
  baseOriginalCanvas: null, // نسخهٔ پاک و کاملاً مات، هم‌هندسه با subjectCanvas (برای ابزار «بازگردانی»)
  originalLoadedCanvas: null, // عکس خام اولیه، فقط برای مقایسهٔ قبل/بعد
  hasBg: false,
  backgroundColor: '#FFFFFF',
  adjustments: { brightness: 0, contrast: 0, saturation: 0, exposure: 0, shadows: 0, highlights: 0, temperature: 0, sharpness: 0, blur: 0 },
  shadow: { enabled: false, intensity: 40 },
  padding: 8,
  history: [],
  future: [],
  compareMode: false,
  currentTool: null,
  brush: { mode: 'erase', size: 40 },
  bgTolerance: 32,
};

const $ = (id) => document.getElementById(id);
const viewCanvas = $('viewCanvas');
const vctx = viewCanvas.getContext('2d');
const canvasStage = $('canvasStage');
const cropOverlay = $('cropOverlayCanvas');
const brushOverlay = $('brushOverlayCanvas');

/* ---------------------------------------------------------------- */
/* ابزارهای کمکی عمومی                                               */
/* ---------------------------------------------------------------- */
function cloneCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function makeOpaqueCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toast(msg, ms = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, ms);
}

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

/* ---------------------------------------------------------------- */
/* بارگذاری عکس                                                      */
/* ---------------------------------------------------------------- */
function loadFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    initFromImage(img);
  };
  img.onerror = () => toast('این فایل قابل بازکردن نبود.');
  img.src = url;
}

function initFromImage(img) {
  let w = img.naturalWidth, h = img.naturalHeight;
  const scale = Math.min(1, MAX_DIM / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);

  const c = makeOpaqueCanvas(w, h);
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0, w, h);

  S.subjectCanvas = c;
  S.baseOriginalCanvas = cloneCanvas(c);
  S.originalLoadedCanvas = cloneCanvas(c);
  S.hasBg = false;
  S.backgroundColor = null;
  S.adjustments = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, shadows: 0, highlights: 0, temperature: 0, sharpness: 0, blur: 0 };
  S.shadow = { enabled: false, intensity: 40 };
  S.padding = 8;
  S.history = []; S.future = [];

  showEditor();
  render();
  pushHistory(); // نقطهٔ شروع، برای بازگشت کامل با بازنشانی
  updateUndoRedoButtons();
}

function showEditor() {
  $('screen-home').hidden = true;
  $('screen-editor').hidden = false;
  $('emptyHint').hidden = true;
}

/* ---------------------------------------------------------------- */
/* موتور رندر                                                        */
/* ---------------------------------------------------------------- */
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function applyPixelAdjustments(srcCanvas, adj) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d');
  const imgData = srcCanvas.getContext('2d').getImageData(0, 0, w, h);
  const d = imgData.data;

  const brightness = adj.brightness, contrast = adj.contrast, saturation = adj.saturation,
        exposure = adj.exposure, shadows = adj.shadows, highlights = adj.highlights, temperature = adj.temperature;

  if (brightness || contrast || saturation || exposure || shadows || highlights || temperature) {
    const expMul = Math.pow(2, exposure / 60);
    const contMul = (259 * (contrast * 2.55 + 255)) / (255 * (259 - contrast * 2.55));
    const tempR = temperature > 0 ? temperature * 0.6 : 0;
    const tempB = temperature < 0 ? -temperature * 0.6 : 0;
    const tempRminus = temperature < 0 ? -temperature * 0.3 : 0;
    const tempBminus = temperature > 0 ? temperature * 0.3 : 0;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];

      // نوردهی (ضربی، شبیه دیافراگم)
      r *= expMul; g *= expMul; b *= expMul;

      // روشنایی (جمعی)
      r += brightness * 2.2; g += brightness * 2.2; b += brightness * 2.2;

      // دما (گرم/سرد)
      r += tempR - tempRminus; b += tempB - tempBminus;

      // سایه‌های تیره و های‌لایت (بر اساس روشنایی پیکسل)
      if (shadows !== 0 || highlights !== 0) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (shadows !== 0) {
          const w1 = clamp(1 - lum / 140, 0, 1);
          const amt = (shadows / 100) * 60 * w1;
          r += amt; g += amt; b += amt;
        }
        if (highlights !== 0) {
          const w2 = clamp((lum - 140) / 115, 0, 1);
          const amt = (highlights / 100) * 60 * w2;
          r += amt; g += amt; b += amt;
        }
      }

      // کنتراست
      r = contMul * (r - 128) + 128;
      g = contMul * (g - 128) + 128;
      b = contMul * (b - 128) + 128;

      d[i] = clamp(r, 0, 255);
      d[i + 1] = clamp(g, 0, 255);
      d[i + 2] = clamp(b, 0, 255);
    }
  }

  if (saturation !== 0) {
    const s = 1 + saturation / 100;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = clamp(gray + (d[i] - gray) * s, 0, 255);
      d[i + 1] = clamp(gray + (d[i + 1] - gray) * s, 0, 255);
      d[i + 2] = clamp(gray + (d[i + 2] - gray) * s, 0, 255);
    }
  }

  octx.putImageData(imgData, 0, 0);

  if (adj.sharpness > 0) {
    unsharpMask(out, adj.sharpness / 100);
  }

  return out;
}

function unsharpMask(canvas, amount) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const blurred = document.createElement('canvas');
  blurred.width = w; blurred.height = h;
  const bctx = blurred.getContext('2d');
  bctx.filter = 'blur(1.6px)';
  bctx.drawImage(canvas, 0, 0);

  const sharp = ctx.getImageData(0, 0, w, h);
  const soft = bctx.getImageData(0, 0, w, h);
  const sd = sharp.data, bd = soft.data;
  const k = amount * 1.6;
  for (let i = 0; i < sd.length; i += 4) {
    sd[i] = clamp(sd[i] + (sd[i] - bd[i]) * k, 0, 255);
    sd[i + 1] = clamp(sd[i + 1] + (sd[i + 1] - bd[i + 1]) * k, 0, 255);
    sd[i + 2] = clamp(sd[i + 2] + (sd[i + 2] - bd[i + 2]) * k, 0, 255);
  }
  ctx.putImageData(sharp, 0, 0);
}

function bboxOfAlpha(canvas) {
  const w = canvas.width, h = canvas.height;
  const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w, h }; // چیزی پیدا نشد؛ کل عکس
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function render() {
  if (!S.subjectCanvas) return;

  const displaySrc = S.compareMode ? S.originalLoadedCanvas : S.subjectCanvas;
  let subject = displaySrc;

  if (!S.compareMode) {
    subject = applyPixelAdjustments(S.subjectCanvas, S.adjustments);
    if (S.adjustments.blur > 0) {
      const blurred = document.createElement('canvas');
      blurred.width = subject.width; blurred.height = subject.height;
      const bctx = blurred.getContext('2d');
      bctx.filter = `blur(${S.adjustments.blur / 8}px)`;
      bctx.drawImage(subject, 0, 0);
      subject = blurred;
    }
  }

  const w = subject.width, h = subject.height;
  viewCanvas.width = w; viewCanvas.height = h;

  vctx.clearRect(0, 0, w, h);

  const showBg = !S.compareMode && S.hasBg && S.backgroundColor;
  if (showBg) {
    vctx.fillStyle = S.backgroundColor;
    vctx.fillRect(0, 0, w, h);
  }

  if (!S.compareMode && S.hasBg && S.shadow.enabled) {
    drawProductShadow(vctx, subject, S.shadow.intensity);
  }

  vctx.drawImage(subject, 0, 0);

  $('beforeBadge').hidden = !S.compareMode;
  syncOverlaySizes();
}

function drawProductShadow(ctx, subject, intensity) {
  const box = bboxOfAlpha(subject);
  if (box.w <= 0) return;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h + Math.max(4, box.h * 0.02);
  const rx = box.w * 0.42;
  const ry = Math.max(6, box.h * 0.05);
  const alpha = clamp(intensity / 100, 0, 1) * 0.45;

  ctx.save();
  ctx.filter = `blur(${Math.max(3, ry * 0.5)}px)`;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  grad.addColorStop(0, `rgba(20,20,22,${alpha})`);
  grad.addColorStop(1, 'rgba(20,20,22,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function syncOverlaySizes() {
  const rect = viewCanvas.getBoundingClientRect();
  [cropOverlay, brushOverlay].forEach((ov) => {
    ov.style.position = 'absolute';
    ov.style.left = (viewCanvas.offsetLeft) + 'px';
    ov.style.top = (viewCanvas.offsetTop) + 'px';
    if (ov.width !== viewCanvas.width) ov.width = viewCanvas.width;
    if (ov.height !== viewCanvas.height) ov.height = viewCanvas.height;
    ov.style.width = rect.width + 'px';
    ov.style.height = rect.height + 'px';
  });
}
window.addEventListener('resize', () => { if (!$('screen-editor').hidden) syncOverlaySizes(); });

/* ---------------------------------------------------------------- */
/* تاریخچه (واگرد/ازنو)                                              */
/* ---------------------------------------------------------------- */
function snapshotState() {
  return {
    subjectURL: S.subjectCanvas.toDataURL('image/png'),
    baseURL: S.baseOriginalCanvas.toDataURL('image/png'),
    hasBg: S.hasBg,
    backgroundColor: S.backgroundColor,
    adjustments: { ...S.adjustments },
    shadow: { ...S.shadow },
    padding: S.padding,
  };
}

function restoreSnapshot(snap, cb) {
  const img1 = new Image(), img2 = new Image();
  let loaded = 0;
  const done = () => {
    loaded++;
    if (loaded < 2) return;
    const c1 = makeOpaqueCanvas(img1.width, img1.height);
    c1.getContext('2d').drawImage(img1, 0, 0);
    const c2 = makeOpaqueCanvas(img2.width, img2.height);
    c2.getContext('2d').drawImage(img2, 0, 0);
    S.subjectCanvas = c1;
    S.baseOriginalCanvas = c2;
    S.hasBg = snap.hasBg;
    S.backgroundColor = snap.backgroundColor;
    S.adjustments = { ...snap.adjustments };
    S.shadow = { ...snap.shadow };
    S.padding = snap.padding;
    if (cb) cb();
  };
  img1.onload = done; img2.onload = done;
  img1.src = snap.subjectURL; img2.src = snap.baseURL;
}

function pushHistory() {
  S.history.push(snapshotState());
  if (S.history.length > HISTORY_LIMIT) S.history.shift();
  S.future = [];
  updateUndoRedoButtons();
}

function doUndo() {
  if (S.history.length < 2) return;
  const current = S.history.pop();
  S.future.push(current);
  const prev = S.history[S.history.length - 1];
  restoreSnapshot(prev, () => { render(); updateUndoRedoButtons(); refreshOpenToolUI(); });
}

function doRedo() {
  if (S.future.length === 0) return;
  const next = S.future.pop();
  S.history.push(next);
  restoreSnapshot(next, () => { render(); updateUndoRedoButtons(); refreshOpenToolUI(); });
}

function updateUndoRedoButtons() {
  $('btnUndo').disabled = S.history.length < 2;
  $('btnRedo').disabled = S.future.length === 0;
}

function refreshOpenToolUI() {
  if (S.currentTool && TOOLS[S.currentTool] && !$('toolSheet').hidden) {
    TOOLS[S.currentTool].open($('toolSheetBody'));
  }
}

/* ---------------------------------------------------------------- */
/* حذف پس‌زمینه                                                      */
/* ---------------------------------------------------------------- */
async function runRemoveBackground() {
  if (!S.subjectCanvas) return;
  const overlay = $('processingOverlay');
  $('processingText').textContent = 'در حال تشخیص محصول و حذف پس‌زمینه…';
  overlay.hidden = false;
  $('btnRemoveBg').querySelector('.pill-spinner').hidden = false;

  await new Promise((r) => setTimeout(r, 30)); // اجازه بده اسپینر رندر شود

  try {
    const result = await BgRemoval.removeBackgroundSmart(cloneCanvas(S.baseOriginalCanvas), {
      tolerance: S.bgTolerance, feather: 2, closeRadius: 1,
    });
    S.subjectCanvas = result.maskCanvas;
    S.hasBg = true;
    if (!S.backgroundColor) S.backgroundColor = '#FFFFFF';
    render();
    pushHistory();
    toast('پس‌زمینه حذف شد. اگر جایی اشتباه بود، از ابزار «قلم‌مو» برای اصلاح استفاده کن.');
  } catch (err) {
    console.error(err);
    toast('حذف پس‌زمینه با خطا مواجه شد. دوباره امتحان کن.');
  } finally {
    overlay.hidden = true;
    $('btnRemoveBg').querySelector('.pill-spinner').hidden = true;
  }
}

/* ---------------------------------------------------------------- */
/* آماده‌سازی محصول (کراپ محکم + فاصله + سفید + وسط‌چین)              */
/* ---------------------------------------------------------------- */
async function runPrepareProduct() {
  const overlay = $('processingOverlay');
  overlay.hidden = false;
  $('processingText').textContent = 'در حال آماده‌سازی عکس محصول…';
  await new Promise((r) => setTimeout(r, 30));

  try {
    if (!S.hasBg) {
      const result = await BgRemoval.removeBackgroundSmart(cloneCanvas(S.baseOriginalCanvas), {
        tolerance: S.bgTolerance, feather: 2, closeRadius: 1,
      });
      S.subjectCanvas = result.maskCanvas;
      S.hasBg = true;
    }
    applyCropPad(S.padding || 8);
    S.backgroundColor = '#FFFFFF';
    render();
    pushHistory();
    toast('محصول آماده شد: پس‌زمینه سفید، وسط‌چین و بهینه برای فروشگاه.');
  } catch (err) {
    console.error(err);
    toast('آماده‌سازی محصول با خطا مواجه شد.');
  } finally {
    overlay.hidden = true;
  }
}

function applyCropPad(paddingPct) {
  const box = bboxOfAlpha(S.subjectCanvas);
  const padX = Math.round(box.w * (paddingPct / 100));
  const padY = Math.round(box.h * (paddingPct / 100));
  const newW = box.w + padX * 2;
  const newH = box.h + padY * 2;

  const newSubject = makeOpaqueTransparent(newW, newH);
  newSubject.getContext('2d').drawImage(
    S.subjectCanvas, box.x, box.y, box.w, box.h, padX, padY, box.w, box.h
  );

  const newBase = makeOpaqueTransparent(newW, newH);
  newBase.getContext('2d').drawImage(
    S.baseOriginalCanvas, box.x, box.y, box.w, box.h, padX, padY, box.w, box.h
  );

  S.subjectCanvas = newSubject;
  S.baseOriginalCanvas = newBase;
}

function makeOpaqueTransparent(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* ---------------------------------------------------------------- */
/* ابزار برش (Crop)                                                  */
/* ---------------------------------------------------------------- */
const cropState = { x: 0.1, y: 0.1, w: 0.8, h: 0.8, dragging: null, startPt: null, startRect: null };

function openCropTool(body) {
  cropOverlay.hidden = false;
  syncOverlaySizes();
  cropState.x = 0.06; cropState.y = 0.06; cropState.w = 0.88; cropState.h = 0.88;

  body.innerHTML = `
    <div class="field-hint">گوشه‌ها را برای برش دقیق بکش. سپس «اعمال برش» را بزن.</div>
    <div class="sheet-actions">
      <button class="pill-btn pill-secondary" id="cropCancel" type="button">انصراف</button>
      <button class="pill-btn pill-primary" id="cropApply" type="button">اعمال برش</button>
    </div>
    <div class="divider"><span>تغییر اندازهٔ خروجی</span></div>
    <div class="field-row">
      <label>عرض (پیکسل)</label>
      <input type="number" id="resizeW" min="20" max="4000" value="${S.subjectCanvas.width}">
    </div>
    <div class="field-row">
      <label>ارتفاع (پیکسل)</label>
      <input type="number" id="resizeH" min="20" max="4000" value="${S.subjectCanvas.height}">
    </div>
    <div class="sheet-actions">
      <button class="pill-btn pill-primary pill-wide" id="resizeApply" type="button">اعمال تغییر اندازه</button>
    </div>
  `;

  drawCropOverlay();

  $('cropCancel').onclick = closeCropTool;
  $('cropApply').onclick = () => {
    const w = S.subjectCanvas.width, h = S.subjectCanvas.height;
    const rx = Math.round(cropState.x * w), ry = Math.round(cropState.y * h);
    const rw = Math.round(cropState.w * w), rh = Math.round(cropState.h * h);
    if (rw < 8 || rh < 8) { toast('ناحیهٔ انتخابی خیلی کوچک است.'); return; }

    const newSubject = makeOpaqueTransparent(rw, rh);
    newSubject.getContext('2d').drawImage(S.subjectCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
    const newBase = makeOpaqueTransparent(rw, rh);
    newBase.getContext('2d').drawImage(S.baseOriginalCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
    S.subjectCanvas = newSubject; S.baseOriginalCanvas = newBase;

    closeCropTool();
    render();
    pushHistory();
    toast('برش اعمال شد.');
  };

  $('resizeApply').onclick = () => {
    const nw = clamp(parseInt($('resizeW').value, 10) || S.subjectCanvas.width, 20, 4000);
    const nh = clamp(parseInt($('resizeH').value, 10) || S.subjectCanvas.height, 20, 4000);
    const newSubject = makeOpaqueTransparent(nw, nh);
    newSubject.getContext('2d').drawImage(S.subjectCanvas, 0, 0, nw, nh);
    const newBase = makeOpaqueTransparent(nw, nh);
    newBase.getContext('2d').drawImage(S.baseOriginalCanvas, 0, 0, nw, nh);
    S.subjectCanvas = newSubject; S.baseOriginalCanvas = newBase;
    closeCropTool();
    render();
    pushHistory();
    toast('اندازهٔ عکس تغییر کرد.');
  };
}

function closeCropTool() {
  cropOverlay.hidden = true;
  closeToolSheet();
}

function drawCropOverlay() {
  const ctx = cropOverlay.getContext('2d');
  const w = cropOverlay.width, h = cropOverlay.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(20,20,22,.55)';
  ctx.fillRect(0, 0, w, h);
  const rx = cropState.x * w, ry = cropState.y * h, rw = cropState.w * w, rh = cropState.h * h;
  ctx.clearRect(rx, ry, rw, rh);
  ctx.strokeStyle = '#d4a94a'; ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, rw, rh);
  const hs = 16;
  ctx.fillStyle = '#d4a94a';
  [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([hx, hy]) => {
    ctx.beginPath(); ctx.arc(hx, hy, hs / 2, 0, Math.PI * 2); ctx.fill();
  });
}

function cropPointerPos(e) {
  const rect = cropOverlay.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

function hitTestHandle(pt) {
  const corners = {
    tl: { x: cropState.x, y: cropState.y },
    tr: { x: cropState.x + cropState.w, y: cropState.y },
    bl: { x: cropState.x, y: cropState.y + cropState.h },
    br: { x: cropState.x + cropState.w, y: cropState.y + cropState.h },
  };
  const thresh = 0.06;
  for (const key in corners) {
    const c = corners[key];
    if (Math.abs(pt.x - c.x) < thresh && Math.abs(pt.y - c.y) < thresh) return key;
  }
  if (pt.x > cropState.x && pt.x < cropState.x + cropState.w && pt.y > cropState.y && pt.y < cropState.y + cropState.h) return 'move';
  return null;
}

cropOverlay.addEventListener('pointerdown', (e) => {
  if (cropOverlay.hidden) return;
  const pt = cropPointerPos(e);
  cropState.dragging = hitTestHandle(pt);
  cropState.startPt = pt;
  cropState.startRect = { ...cropState };
  cropOverlay.setPointerCapture(e.pointerId);
});
cropOverlay.addEventListener('pointermove', (e) => {
  if (cropOverlay.hidden || !cropState.dragging) return;
  const pt = cropPointerPos(e);
  const dx = pt.x - cropState.startPt.x, dy = pt.y - cropState.startPt.y;
  const r0 = cropState.startRect;

  if (cropState.dragging === 'move') {
    cropState.x = clamp(r0.x + dx, 0, 1 - r0.w);
    cropState.y = clamp(r0.y + dy, 0, 1 - r0.h);
  } else {
    let { x, y, w, h } = r0;
    if (cropState.dragging.includes('l')) { x = clamp(r0.x + dx, 0, r0.x + r0.w - 0.08); w = r0.w - (x - r0.x); }
    if (cropState.dragging.includes('r')) { w = clamp(r0.w + dx, 0.08, 1 - r0.x); }
    if (cropState.dragging.includes('t')) { y = clamp(r0.y + dy, 0, r0.y + r0.h - 0.08); h = r0.h - (y - r0.y); }
    if (cropState.dragging.includes('b')) { h = clamp(r0.h + dy, 0.08, 1 - r0.y); }
    cropState.x = x; cropState.y = y; cropState.w = w; cropState.h = h;
  }
  drawCropOverlay();
});
['pointerup', 'pointercancel'].forEach((evt) =>
  cropOverlay.addEventListener(evt, () => { cropState.dragging = null; })
);

/* ---------------------------------------------------------------- */
/* ابزار چرخش                                                        */
/* ---------------------------------------------------------------- */
function rotate90(dir) {
  const src = S.subjectCanvas, base = S.baseOriginalCanvas;
  const w = src.width, h = src.height;
  const rot = (c) => {
    const out = makeOpaqueTransparent(h, w);
    const ctx = out.getContext('2d');
    ctx.translate(dir > 0 ? h : 0, dir > 0 ? 0 : w);
    ctx.rotate(dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    ctx.drawImage(c, 0, 0);
    return out;
  };
  S.subjectCanvas = rot(src);
  S.baseOriginalCanvas = rot(base);
  render();
  pushHistory();
}

function rotateFine(deg) {
  if (deg === 0) return;
  const rad = deg * Math.PI / 180;
  const rot = (c) => {
    const w = c.width, h = c.height;
    const nw = Math.round(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)));
    const nh = Math.round(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)));
    const out = makeOpaqueTransparent(nw, nh);
    const ctx = out.getContext('2d');
    ctx.translate(nw / 2, nh / 2);
    ctx.rotate(rad);
    ctx.drawImage(c, -w / 2, -h / 2);
    return out;
  };
  S.subjectCanvas = rot(S.subjectCanvas);
  S.baseOriginalCanvas = rot(S.baseOriginalCanvas);
  viewCanvas.style.transform = '';
  render();
  pushHistory();
}

/* ---------------------------------------------------------------- */
/* قلم‌مو (حذف / بازگردانی)                                          */
/* ---------------------------------------------------------------- */
let painting = false, paintedSinceDown = false;

function brushPointerPos(e) {
  const rect = brushOverlay.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * brushOverlay.width;
  const y = (e.clientY - rect.top) / rect.height * brushOverlay.height;
  return { x, y };
}

function paintAt(x, y) {
  const w = S.subjectCanvas.width, h = S.subjectCanvas.height;
  const ctx = S.subjectCanvas.getContext('2d');
  const r = S.brush.size / 2;

  if (S.brush.mode === 'erase') {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    // بازگردانی: رنگ و آلفای اصلی را از baseOriginalCanvas برمی‌گرداند
    const bx = Math.max(0, Math.round(x - r)), by = Math.max(0, Math.round(y - r));
    const bw = Math.min(w - bx, Math.round(r * 2)), bh = Math.min(h - by, Math.round(r * 2));
    if (bw <= 0 || bh <= 0) return;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.clearRect(bx, by, bw, bh);
    ctx.drawImage(S.baseOriginalCanvas, bx, by, bw, bh, bx, by, bw, bh);
    ctx.restore();
  }
  drawBrushCursor(x, y, r);
  scheduleRender();
}

function drawBrushCursor(x, y, r) {
  const bctx = brushOverlay.getContext('2d');
  bctx.clearRect(0, 0, brushOverlay.width, brushOverlay.height);
  bctx.strokeStyle = S.brush.mode === 'erase' ? '#e5484d' : '#4caf7d';
  bctx.lineWidth = 2;
  bctx.beginPath(); bctx.arc(x, y, r, 0, Math.PI * 2); bctx.stroke();
}

brushOverlay.addEventListener('pointerdown', (e) => {
  if (brushOverlay.hidden) return;
  painting = true; paintedSinceDown = false;
  brushOverlay.setPointerCapture(e.pointerId);
  const p = brushPointerPos(e);
  paintAt(p.x, p.y);
  paintedSinceDown = true;
});
brushOverlay.addEventListener('pointermove', (e) => {
  if (brushOverlay.hidden) return;
  const p = brushPointerPos(e);
  if (painting) { paintAt(p.x, p.y); paintedSinceDown = true; }
  else drawBrushCursor(p.x, p.y, S.brush.size / 2);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) =>
  brushOverlay.addEventListener(evt, () => {
    if (painting && paintedSinceDown) { S.hasBg = true; pushHistory(); }
    painting = false;
  })
);

/* ---------------------------------------------------------------- */
/* تعریف ابزارهای نوار پایین                                         */
/* ---------------------------------------------------------------- */
const ICONS = {
  crop: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 12a9 9 0 1 1 2.6 6.4M3 12v6m0-6h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  adjust: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 6h10M4 12h16M4 18h7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="6" r="2.2" fill="currentColor"/><circle cx="8" cy="18" r="2.2" fill="currentColor"/></svg>',
  filters: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="15" cy="15" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  brush: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 17c-2 0-3-1-3-3 3 0 3-3 6-3l6-6 3 3-6 6c0 3-3 3-3 6-2 0-3-1-3-3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
  bgcolor: '<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/></svg>',
  shadow: '<svg viewBox="0 0 24 24" width="20" height="20"><ellipse cx="12" cy="18" rx="7" ry="2.4" fill="currentColor" opacity=".5"/><rect x="9" y="4" width="6" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  spacing: '<svg viewBox="0 0 24 24" width="20" height="20"><rect x="7" y="7" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M2 2l3 3M22 2l-3 3M2 22l3-3M22 22l-3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  enhance: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z" fill="currentColor"/><circle cx="19" cy="18" r="1.6" fill="currentColor"/><circle cx="5" cy="19" r="1.2" fill="currentColor"/></svg>',
};

function slider(id, label, min, max, val, unit = '') {
  return `<div class="field-row">
    <label>${label} <span id="${id}Val">${val}${unit}</span></label>
    <input type="range" id="${id}" min="${min}" max="${max}" value="${val}">
  </div>`;
}

const TOOLS = {
  crop: {
    label: 'برش', icon: ICONS.crop,
    open(body) { openCropTool(body); },
    close() { cropOverlay.hidden = true; },
  },
  rotate: {
    label: 'چرخش', icon: ICONS.rotate,
    open(body) {
      body.innerHTML = `
        <div class="sheet-actions">
          <button class="pill-btn pill-secondary" id="rotL" type="button">۹۰° چپ</button>
          <button class="pill-btn pill-secondary" id="rotR" type="button">۹۰° راست</button>
        </div>
        ${slider('rotFine', 'صاف کردن افق', -45, 45, 0, '°')}
      `;
      $('rotL').onclick = () => rotate90(-1);
      $('rotR').onclick = () => rotate90(1);
      const rf = $('rotFine');
      rf.addEventListener('input', () => {
        $('rotFineVal').textContent = rf.value + '°';
        viewCanvas.style.transform = `rotate(${rf.value}deg)`;
      });
      rf.addEventListener('change', () => {
        rotateFine(parseFloat(rf.value));
        rf.value = 0; $('rotFineVal').textContent = '0°';
      });
    },
  },
  adjust: {
    label: 'تنظیمات', icon: ICONS.adjust,
    open(body) {
      const a = S.adjustments;
      body.innerHTML = `
        ${slider('adjExposure', 'نوردهی', -100, 100, a.exposure)}
        ${slider('adjBrightness', 'روشنایی', -100, 100, a.brightness)}
        ${slider('adjContrast', 'کنتراست', -100, 100, a.contrast)}
        ${slider('adjShadows', 'سایه‌های تیره', -100, 100, a.shadows)}
        ${slider('adjHighlights', 'های‌لایت', -100, 100, a.highlights)}
        ${slider('adjSaturation', 'اشباع رنگ', -100, 100, a.saturation)}
        ${slider('adjTemperature', 'دما', -100, 100, a.temperature)}
        ${slider('adjSharpness', 'وضوح', 0, 100, a.sharpness)}
        ${slider('adjBlur', 'بلور', 0, 100, a.blur)}
        <div class="sheet-actions">
          <button class="pill-btn pill-secondary pill-wide" id="adjReset" type="button">بازنشانی تنظیمات</button>
        </div>
      `;
      const keys = ['exposure', 'brightness', 'contrast', 'shadows', 'highlights', 'saturation', 'temperature', 'sharpness', 'blur'];
      keys.forEach((k) => {
        const id = 'adj' + k[0].toUpperCase() + k.slice(1);
        const el = $(id);
        el.addEventListener('input', () => {
          $(id + 'Val').textContent = el.value;
          S.adjustments[k] = parseFloat(el.value);
          scheduleRender();
        });
        el.addEventListener('change', () => pushHistory());
      });
      $('adjReset').onclick = () => {
        S.adjustments = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, shadows: 0, highlights: 0, temperature: 0, sharpness: 0, blur: 0 };
        render(); pushHistory();
        TOOLS.adjust.open(body);
      };
    },
  },
  filters: {
    label: 'فیلترها', icon: ICONS.filters,
    open(body) {
      const presets = [
        { name: 'اصلی', v: { brightness: 0, contrast: 0, saturation: 0, temperature: 0 } },
        { name: 'گرم', v: { temperature: 28, saturation: 8 } },
        { name: 'سرد', v: { temperature: -26 } },
        { name: 'پرکنتراست', v: { contrast: 28, saturation: 14 } },
        { name: 'ملایم', v: { contrast: -10, brightness: 6, saturation: -6 } },
        { name: 'سیاه‌وسفید', v: { saturation: -100 } },
      ];
      body.innerHTML = `<div class="preset-row">${presets.map((p, i) =>
        `<button class="preset-chip" data-i="${i}" type="button">${p.name}</button>`).join('')}</div>
        <p class="field-hint">فیلتر روی مقادیر «تنظیمات» اثر می‌گذارد؛ می‌توانی بعد از انتخاب، آن‌ها را از تب تنظیمات دقیق‌تر کنی.</p>`;
      body.querySelectorAll('.preset-chip').forEach((btn) => {
        btn.onclick = () => {
          const p = presets[+btn.dataset.i];
          S.adjustments = { ...S.adjustments, brightness: 0, contrast: 0, saturation: 0, temperature: 0, ...p.v };
          render(); pushHistory();
          body.querySelectorAll('.preset-chip').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
        };
      });
    },
  },
  brush: {
    label: 'قلم‌مو', icon: ICONS.brush,
    open(body) {
      brushOverlay.hidden = false;
      syncOverlaySizes();
      body.innerHTML = `
        <div class="field-row">
          <label>حالت</label>
          <div class="segmented" id="brushMode">
            <button type="button" data-v="erase" class="seg-btn active">حذف</button>
            <button type="button" data-v="restore" class="seg-btn">بازگردانی</button>
          </div>
        </div>
        ${slider('brushSize', 'اندازهٔ قلم', 8, 160, S.brush.size, 'px')}
        <p class="field-hint">با انگشت روی محصول بکش. «حذف» بخشی از عکس را پاک می‌کند، «بازگردانی» همان بخش را از عکس اصلی برمی‌گرداند.</p>
      `;
      body.querySelectorAll('#brushMode .seg-btn').forEach((b) => {
        b.onclick = () => {
          S.brush.mode = b.dataset.v;
          body.querySelectorAll('#brushMode .seg-btn').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
        };
      });
      const bs = $('brushSize');
      bs.addEventListener('input', () => { $('brushSizeVal').textContent = bs.value + 'px'; S.brush.size = +bs.value; });
    },
    close() { brushOverlay.hidden = true; }
  },
  bgcolor: {
    label: 'پس‌زمینه', icon: ICONS.bgcolor,
    open(body) {
      if (!S.hasBg) {
        body.innerHTML = `<p class="field-hint">اول باید پس‌زمینه را حذف کنی تا بتوانی رنگ پس‌زمینه را عوض کنی.</p>`;
        return;
      }
      const colors = ['#FFFFFF', '#F4F1EA', '#141416', '#E9EEF2'];
      body.innerHTML = `
        <div class="swatch-row" id="swatchRow">
          <div class="swatch transparent" data-v="" title="شفاف"></div>
          ${colors.map((c) => `<div class="swatch" data-v="${c}" style="background:${c}"></div>`).join('')}
          <input type="color" id="customColor" value="#ffffff">
        </div>
      `;
      const markActive = () => {
        body.querySelectorAll('.swatch').forEach((s) => {
          s.classList.toggle('active', (s.dataset.v || null) === S.backgroundColor);
        });
      };
      markActive();
      body.querySelectorAll('.swatch').forEach((sEl) => {
        sEl.onclick = () => {
          S.backgroundColor = sEl.dataset.v || null;
          render(); pushHistory(); markActive();
        };
      });
      $('customColor').addEventListener('input', (e) => {
        S.backgroundColor = e.target.value; render();
      });
      $('customColor').addEventListener('change', () => { pushHistory(); markActive(); });
    },
  },
  shadow: {
    label: 'سایه محصول', icon: ICONS.shadow,
    open(body) {
      if (!S.hasBg) {
        body.innerHTML = `<p class="field-hint">اول باید پس‌زمینه را حذف کنی تا سایهٔ زیر محصول ساخته شود.</p>`;
        return;
      }
      body.innerHTML = `
        <div class="toggle-row">
          <span>نمایش سایهٔ ملایم</span>
          <div class="switch ${S.shadow.enabled ? 'on' : ''}" id="shadowSwitch"><div class="knob"></div></div>
        </div>
        ${slider('shadowIntensity', 'شدت سایه', 0, 100, S.shadow.intensity)}
      `;
      $('shadowSwitch').onclick = () => {
        S.shadow.enabled = !S.shadow.enabled;
        $('shadowSwitch').classList.toggle('on', S.shadow.enabled);
        render(); pushHistory();
      };
      const si = $('shadowIntensity');
      si.addEventListener('input', () => { $('shadowIntensityVal').textContent = si.value; S.shadow.intensity = +si.value; scheduleRender(); });
      si.addEventListener('change', () => pushHistory());
    },
  },
  spacing: {
    label: 'فاصله از لبه', icon: ICONS.spacing,
    open(body) {
      if (!S.hasBg) {
        body.innerHTML = `<p class="field-hint">اول باید پس‌زمینه را حذف کنی تا بتوانی فاصلهٔ اطراف محصول را تنظیم کنی.</p>`;
        return;
      }
      body.innerHTML = `
        ${slider('paddingRange', 'فاصلهٔ اطراف محصول', 0, 30, S.padding, '٪')}
        <div class="sheet-actions">
          <button class="pill-btn pill-primary pill-wide" id="paddingApply" type="button">اعمال</button>
        </div>
      `;
      const pr = $('paddingRange');
      pr.addEventListener('input', () => { $('paddingRangeVal').textContent = pr.value + '٪'; });
      $('paddingApply').onclick = () => {
        S.padding = +pr.value;
        applyCropPad(S.padding);
        render(); pushHistory();
        toast('فاصلهٔ اطراف محصول به‌روزرسانی شد.');
      };
    },
  },
  enhance: {
    label: 'بهبود خودکار', icon: ICONS.enhance,
    direct: true,
    run() {
      S.adjustments.contrast = clamp(S.adjustments.contrast + 12, -100, 100);
      S.adjustments.saturation = clamp(S.adjustments.saturation + 8, -100, 100);
      S.adjustments.sharpness = clamp(S.adjustments.sharpness + 18, 0, 100);
      S.adjustments.exposure = clamp(S.adjustments.exposure + 6, -100, 100);
      S.adjustments.shadows = clamp(S.adjustments.shadows + 12, -100, 100);
      S.adjustments.highlights = clamp(S.adjustments.highlights - 8, -100, 100);
      render(); pushHistory();
      toast('بهبود خودکار اعمال شد.');
    },
  },
};

/* ---------------------------------------------------------------- */
/* ساخت نوار ابزار و شیت‌ها                                          */
/* ---------------------------------------------------------------- */
function buildToolbar() {
  const dock = $('toolbarDock');
  dock.innerHTML = '';
  Object.keys(TOOLS).forEach((key) => {
    const t = TOOLS[key];
    const btn = document.createElement('button');
    btn.className = 'tool-icon-btn';
    btn.type = 'button';
    btn.dataset.tool = key;
    btn.innerHTML = `<span class="ti-box">${t.icon}</span><span>${t.label}</span>`;
    btn.onclick = () => {
      if (t.direct) { t.run(); return; }
      openToolSheet(key);
    };
    dock.appendChild(btn);
  });
}

function openToolSheet(key) {
  closeAllOverlaysExcept(key);
  S.currentTool = key;
  document.querySelectorAll('.tool-icon-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === key));
  $('toolSheetTitle').textContent = TOOLS[key].label;
  $('toolSheet').hidden = false;
  TOOLS[key].open($('toolSheetBody'));
}

function closeAllOverlaysExcept(exceptKey) {
  if (S.currentTool && S.currentTool !== exceptKey && TOOLS[S.currentTool] && TOOLS[S.currentTool].close) {
    TOOLS[S.currentTool].close();
  }
}

function closeToolSheet() {
  if (S.currentTool && TOOLS[S.currentTool] && TOOLS[S.currentTool].close) TOOLS[S.currentTool].close();
  $('toolSheet').hidden = true;
  document.querySelectorAll('.tool-icon-btn').forEach((b) => b.classList.remove('active'));
  S.currentTool = null;
}

/* ---------------------------------------------------------------- */
/* ذخیره‌سازی / خروجی                                                 */
/* ---------------------------------------------------------------- */
function buildFinalCanvas(targetSize) {
  render(); // مطمئن شو viewCanvas به‌روز است
  let src = viewCanvas;
  if (!S.backgroundColor) {
    // اگر پس‌زمینه شفاف است ولی فرمت JPG انتخاب شده، سفید کن تا خروجی سیاه نشود
  }
  let out = src;
  if (targetSize && targetSize !== 'original') {
    const size = parseInt(targetSize, 10);
    const c = makeOpaqueTransparent(size, size);
    const ctx = c.getContext('2d');
    if (S.backgroundColor) { ctx.fillStyle = S.backgroundColor; ctx.fillRect(0, 0, size, size); }
    const scale = Math.min(size / src.width, size / src.height);
    const dw = src.width * scale, dh = src.height * scale;
    ctx.drawImage(src, (size - dw) / 2, (size - dh) / 2, dw, dh);
    out = c;
  }
  return out;
}

function exportCanvas(canvas, format, quality) {
  let finalCanvas = canvas;
  if (format === 'jpeg' && !S.backgroundColor) {
    // JPG شفافیت ندارد؛ پس‌زمینهٔ سفید اضافه کن
    const c = makeOpaqueTransparent(canvas.width, canvas.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, 0, 0);
    finalCanvas = c;
  }
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const dataURL = finalCanvas.toDataURL(mime, format === 'jpeg' ? quality / 100 : undefined);
  return dataURL;
}

function doSave(dataURL, ext) {
  $('savePreviewImg').src = dataURL;
  $('savePreviewWrap').hidden = false;
  const link = $('downloadLink');
  link.href = dataURL;
  link.download = `product-photo-${Date.now()}.${ext}`;
  link.click();
  toast('عکس ذخیره شد (یا برای ذخیره روی تصویر لمس‌ولمس‌نگه‌دار).');
}

/* ---------------------------------------------------------------- */
/* رویدادهای کلی UI                                                  */
/* ---------------------------------------------------------------- */
function init() {
  buildToolbar();

  $('btnPickPhoto').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) loadFile(e.target.files[0]);
    e.target.value = '';
  });

  $('btnBack').addEventListener('click', () => {
    closeToolSheet();
    $('screen-editor').hidden = true;
    $('screen-home').hidden = false;
  });

  $('btnUndo').addEventListener('click', doUndo);
  $('btnRedo').addEventListener('click', doRedo);

  $('btnCompare').addEventListener('click', () => {
    S.compareMode = !S.compareMode;
    $('btnCompare').classList.toggle('active', S.compareMode);
    $('compareLabel').textContent = S.compareMode ? 'در حال مشاهده: قبل' : 'قبل/بعد';
    render();
  });

  $('toolSheetClose').addEventListener('click', closeToolSheet);

  $('btnRemoveBg').addEventListener('click', runRemoveBackground);
  $('btnPrepareProduct').addEventListener('click', runPrepareProduct);

  /* ---- شیت ذخیره ---- */
  let fmt = 'jpeg', sizeChoice = 'original';
  $('btnGoSave').addEventListener('click', () => { $('saveSheet').hidden = false; });
  $('saveSheetClose').addEventListener('click', () => { $('saveSheet').hidden = true; });
  $('saveSheet').addEventListener('click', (e) => { if (e.target === $('saveSheet')) $('saveSheet').hidden = true; });

  $('formatSegmented').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    fmt = b.dataset.value;
    $('formatSegmented').querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    $('qualityRow').style.display = fmt === 'jpeg' ? '' : 'none';
  });
  $('sizeSegmented').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn'); if (!b) return;
    sizeChoice = b.dataset.value;
    $('sizeSegmented').querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
  });
  const qr = $('qualityRange');
  qr.addEventListener('input', () => { $('qualityVal').textContent = qr.value + '٪'; });

  $('btnDoSave').addEventListener('click', () => {
    const canvas = buildFinalCanvas(sizeChoice);
    const dataURL = exportCanvas(canvas, fmt, +qr.value);
    doSave(dataURL, fmt === 'png' ? 'png' : 'jpg');
  });

  $('btnSaveForShop').addEventListener('click', async () => {
    if (!S.hasBg) {
      await runPrepareProduct();
    } else if (S.backgroundColor !== '#FFFFFF' || S.padding < 4) {
      S.backgroundColor = '#FFFFFF';
      applyCropPad(Math.max(S.padding, 8));
      render(); pushHistory();
    }
    const canvas = buildFinalCanvas('1000');
    const dataURL = exportCanvas(canvas, 'jpeg', 92);
    doSave(dataURL, 'jpg');
    $('saveSheet').hidden = true;
  });

  // درگ‌اند‌دراپ برای دسکتاپ (اختیاری، بدون آسیب به موبایل)
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
}

document.addEventListener('DOMContentLoaded', init);
})();
