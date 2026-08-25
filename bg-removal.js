/*
 * bg-removal.js
 * ----------------------------------------------------------------
 * موتور حذف پس‌زمینه — کاملاً درون مرورگر، بدون سرور و بدون هوش مصنوعی خارجی.
 *
 * روش کار (region-growing از لبه‌های عکس، با مرجع رنگ ثابت):
 *   ۱) میانگین رنگ پیکسل‌های لبهٔ عکس را به‌عنوان «رنگ پس‌زمینه» تخمین می‌زنیم.
 *   ۲) از تمام پیکسل‌های لبه شروع می‌کنیم و به‌صورت موجی به همسایه‌ها سرایت می‌کنیم؛
 *      هر پیکسل فقط زمانی «پس‌زمینه» علامت می‌خورد که رنگش به همان رنگ ثابت مرحلهٔ ۱
 *      نزدیک باشد (نه به رنگ همسایهٔ قبلی‌اش) — این از نشت الگوریتم به داخل محصول
 *      روی سایه‌روشن‌های ملایم جلوگیری می‌کند.
 *   ۳) لبهٔ ماسک را نرم (feather) می‌کنیم و رنگ پیکسل‌های نیمه‌شفاف را از رنگ پس‌زمینه
 *      «پاک‌سازی» می‌کنیم تا هالهٔ سفید/خاکستری دور محصول ایجاد نشود.
 *
 * معماری: تابع اصلی removeBackgroundSmart(...) تنها API‌ای است که app.js صدا می‌زند.
 * ----------------------------------------------------------------
 */

const BgRemoval = (() => {

  function colorDist(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
  }

  /** میانگین رنگ پیکسل‌های لبهٔ عکس را به‌عنوان تخمین رنگ پس‌زمینه برمی‌گرداند */
  function estimateBorderColor(data, w, h) {
    let r = 0, g = 0, b = 0, n = 0;
    const step = Math.max(1, Math.floor(Math.min(w, h) / 200));
    for (let x = 0; x < w; x += step) {
      for (const y of [0, h - 1]) {
        const i = (y * w + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    for (let y = 0; y < h; y += step) {
      for (const x of [0, w - 1]) {
        const i = (y * w + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    if (n === 0) return { r: 255, g: 255, b: 255 };
    return { r: r / n, g: g / n, b: b / n };
  }

  /**
   * موجی از لبه‌های عکس به سمت داخل حرکت می‌کند؛ هر پیکسل فقط بر اساس فاصلهٔ رنگی‌اش
   * با «رنگ ثابت پس‌زمینه» (bg) — نه رنگ همسایهٔ قبلی — پس‌زمینه علامت می‌خورد.
   * این جلوی نشت الگوریتم به داخل سایه‌روشن‌های محصول را می‌گیرد.
   * خروجی: Uint8ClampedArray هم‌اندازهٔ عکس؛ 255 = پیش‌زمینه (محصول)، 0 = پس‌زمینه.
   */
  function floodFillBackground(data, w, h, tolerance, bg) {
    const n = w * h;
    const visited = new Uint8Array(n); // 1 = بازدید شده (پس‌زمینه)
    const queue = new Int32Array(n);
    let qHead = 0, qTail = 0;

    const isBgColor = (idx) => {
      const i4 = idx * 4;
      return colorDist(data[i4], data[i4 + 1], data[i4 + 2], bg.r, bg.g, bg.b) <= tolerance;
    };

    const trySeed = (idx) => {
      if (!visited[idx] && isBgColor(idx)) { visited[idx] = 1; queue[qTail++] = idx; }
    };

    // بذرهای اولیه: پیکسل‌های لبه که واقعاً به رنگ پس‌زمینه نزدیک‌اند
    for (let x = 0; x < w; x++) {
      trySeed(x);               // y=0
      trySeed((h - 1) * w + x); // y=h-1
    }
    for (let y = 0; y < h; y++) {
      trySeed(y * w);           // x=0
      trySeed(y * w + (w - 1)); // x=w-1
    }

    while (qHead < qTail) {
      const idx = queue[qHead++];
      const x = idx % w, y = (idx / w) | 0;

      if (x > 0) trySeed(idx - 1);
      if (x < w - 1) trySeed(idx + 1);
      if (y > 0) trySeed(idx - w);
      if (y < h - 1) trySeed(idx + w);
    }

    const mask = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) mask[i] = visited[i] ? 0 : 255;
    return mask;
  }

  /** بستن حفره‌های کوچک داخل محصول (dilate سپس erode روی ماسک باینری) */
  function morphClose(mask, w, h, radius) {
    if (radius <= 0) return mask;
    const dilate = (src) => {
      const out = new Uint8ClampedArray(src.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let v = 0;
          for (let dy = -radius; dy <= radius && !v; dy++) {
            const yy = y + dy; if (yy < 0 || yy >= h) continue;
            for (let dx = -radius; dx <= radius; dx++) {
              const xx = x + dx; if (xx < 0 || xx >= w) continue;
              if (src[yy * w + xx] === 255) { v = 255; break; }
            }
          }
          out[y * w + x] = v;
        }
      }
      return out;
    };
    const erode = (src) => {
      const out = new Uint8ClampedArray(src.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let v = 255;
          for (let dy = -radius; dy <= radius && v; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= h) { v = 0; break; }
            for (let dx = -radius; dx <= radius; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= w || src[yy * w + xx] === 0) { v = 0; break; }
            }
          }
          out[y * w + x] = v;
        }
      }
      return out;
    };
    return erode(dilate(mask));
  }

  /** بلور جعبه‌ای ساده روی ماسک برای نرم کردن لبه‌ها (feather) */
  function featherMask(mask, w, h, radius) {
    if (radius <= 0) return mask;
    const tmp = new Float32Array(mask.length);
    const out = new Uint8ClampedArray(mask.length);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      const rowOff = y * w;
      for (let x = -radius; x <= radius; x++) sum += mask[rowOff + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[rowOff + x] = sum / (radius * 2 + 1);
        const addX = Math.min(w - 1, x + radius + 1);
        const subX = Math.max(0, x - radius);
        sum += mask[rowOff + addX] - mask[rowOff + subX];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / (radius * 2 + 1);
        const addY = Math.min(h - 1, y + radius + 1);
        const subY = Math.max(0, y - radius);
        sum += tmp[addY * w + x] - tmp[subY * w + x];
      }
    }
    return out;
  }

  /**
   * برای پیکسل‌های نیمه‌شفاف لبه، رنگ واقعی محصول را از رنگ آمیخته‌شده با پس‌زمینه
   * جدا می‌کند تا هالهٔ رنگ پس‌زمینه دور محصول دیده نشود.
   * فرمول استاندارد رفع آلودگی رنگ در ماتینگ: fg = (observed - (1-a)*bg) / a
   */
  function decontaminate(data, mask, w, h, bg) {
    const n = w * h;
    for (let i = 0; i < n; i++) {
      const a = mask[i] / 255;
      if (a > 0.02 && a < 0.98) {
        const i4 = i * 4;
        const r = (data[i4] - (1 - a) * bg.r) / a;
        const g = (data[i4 + 1] - (1 - a) * bg.g) / a;
        const b = (data[i4 + 2] - (1 - a) * bg.b) / a;
        data[i4] = Math.min(255, Math.max(0, r));
        data[i4 + 1] = Math.min(255, Math.max(0, g));
        data[i4 + 2] = Math.min(255, Math.max(0, b));
      }
    }
  }

  /**
   * تابع اصلی — حذف پس‌زمینه از یک کانواس منبع.
   * options: { tolerance: 0-100 (حساسیت تشخیص), feather: 0-6, closeRadius: 0-3 }
   * خروجی: { maskCanvas } — کانواسی هم‌اندازهٔ ورودی که فقط کانال آلفا (سفید=محصول) دارد
   */
  async function removeBackgroundSmart(sourceCanvas, options = {}) {
    const tolerancePct = options.tolerance ?? 32; // 0..100 از UI
    const feather = options.feather ?? 2;
    const closeRadius = options.closeRadius ?? 1;

    const w = sourceCanvas.width, h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // ابتدا رنگ پس‌زمینه را از لبه‌ها تخمین می‌زنیم (مرجع ثابت برای کل الگوریتم)
    const bg = estimateBorderColor(data, w, h);

    // تبدیل درصد حساسیت کاربر (0-100) به آستانهٔ فاصلهٔ رنگی
    const tolerance = 10 + (tolerancePct / 100) * 55;

    let mask = floodFillBackground(data, w, h, tolerance, bg);
    mask = morphClose(mask, w, h, closeRadius);

    if (feather > 0) {
      mask = featherMask(mask, w, h, feather);
    }

    const outData = new Uint8ClampedArray(data); // کپی رنگ‌ها
    decontaminate(outData, mask, w, h, bg);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w; maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d', { willReadFrequently: true });
    const outImgData = mctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const i4 = i * 4;
      outImgData.data[i4] = outData[i4];
      outImgData.data[i4 + 1] = outData[i4 + 1];
      outImgData.data[i4 + 2] = outData[i4 + 2];
      outImgData.data[i4 + 3] = mask[i];
    }
    mctx.putImageData(outImgData, 0, 0);

    return { maskCanvas, backgroundColorEstimate: bg };
  }

  return { removeBackgroundSmart };
})();
