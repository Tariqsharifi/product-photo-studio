/*
 * bg-removal.js
 * ----------------------------------------------------------------
 * موتور حذف پس‌زمینه — کاملاً درون مرورگر، بدون سرور و بدون هوش مصنوعی خارجی.
 *
 * روش کار (region-growing از لبه‌های عکس):
 *   ۱) از تمام پیکسل‌های لبهٔ عکس شروع می‌کنیم (فرض: پس‌زمینه معمولاً به لبه‌ها می‌رسد).
 *   ۲) به‌صورت موجی به پیکسل‌های همسایه سرایت می‌کنیم، تا وقتی که اختلاف رنگ با همسایهٔ
 *      قبلی از آستانهٔ حساسیت بیشتر شود (همان لبهٔ محصول).
 *   ۳) لبهٔ ماسک را نرم (feather) می‌کنیم و رنگ پیکسل‌های نیمه‌شفاف را از رنگ پس‌زمینه
 *      «پاک‌سازی» می‌کنیم تا هالهٔ سفید/خاکستری دور محصول ایجاد نشود.
 *
 * معماری: تابع اصلی removeBackgroundSmart(...) تنها API‌ای است که app.js صدا می‌زند.
 * برای اضافه کردن یک موتور قوی‌تر (مثلاً یک مدل هوش مصنوعی یا API ابری) در آینده،
 * کافی است تابعی با همین امضا نوشته و در app.js جایگزین این تابع شود — بقیهٔ برنامه
 * (ابزار اصلاح دستی ماسک با قلم‌مو، ترکیب با پس‌زمینه، و غیره) بدون تغییر کار می‌کند.
 * ----------------------------------------------------------------
 */

const BgRemoval = (() => {

  function colorDist(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    // فاصلهٔ رنگی با وزن‌دهی نزدیک به حساسیت چشم انسان
    return Math.sqrt(0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db);
  }

  /** میانگین رنگ پیکسل‌های لبهٔ عکس را به‌عنوان تخمین اولیهٔ رنگ پس‌زمینه برمی‌گرداند */
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
   * موجی از لبه‌های عکس به سمت داخل حرکت می‌کند و هر پیکسلی را که با همسایهٔ
   * «پس‌زمینهٔ» خودش رنگ نزدیکی دارد هم پس‌زمینه علامت می‌زند.
   * خروجی: Uint8ClampedArray هم‌اندازهٔ عکس؛ 255 = پیش‌زمینه (محصول)، 0 = پس‌زمینه.
   */
  function floodFillBackground(data, w, h, tolerance) {
    const n = w * h;
    const visited = new Uint8Array(n); // 1 = بازدید شده (پس‌زمینه)
    const queue = new Int32Array(n);
    let qHead = 0, qTail = 0;

    const pushIfBg = (idx, refR, refG, refB) => {
      if (visited[idx]) return;
      const i4 = idx * 4;
      const d = colorDist(data[i4], data[i4 + 1], data[i4 + 2], refR, refG, refB);
      if (d <= tolerance) {
        visited[idx] = 1;
        queue[qTail++] = idx;
      }
    };

    // بذرهای اولیه: تمام پیکسل‌های لبه (نسبت به رنگ خودشان به‌عنوان مرجع)
    for (let x = 0; x < w; x++) {
      let idx = x; // y=0
      if (!visited[idx]) { visited[idx] = 1; queue[qTail++] = idx; }
      idx = (h - 1) * w + x;
      if (!visited[idx]) { visited[idx] = 1; queue[qTail++] = idx; }
    }
    for (let y = 0; y < h; y++) {
      let idx = y * w;
      if (!visited[idx]) { visited[idx] = 1; queue[qTail++] = idx; }
      idx = y * w + (w - 1);
      if (!visited[idx]) { visited[idx] = 1; queue[qTail++] = idx; }
    }

    while (qHead < qTail) {
      const idx = queue[qHead++];
      const x = idx % w, y = (idx / w) | 0;
      const i4 = idx * 4;
      const r = data[i4], g = data[i4 + 1], b = data[i4 + 2];

      if (x > 0) pushIfBg(idx - 1, r, g, b);
      if (x < w - 1) pushIfBg(idx + 1, r, g, b);
      if (y > 0) pushIfBg(idx - w, r, g, b);
      if (y < h - 1) pushIfBg(idx + w, r, g, b);
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
    // افقی
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
    // عمودی
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
    const ctx = sourceCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // تبدیل درصد حساسیت کاربر (0-100) به آستانهٔ فاصلهٔ رنگی (0-90 تقریبی)
    const tolerance = 6 + (tolerancePct / 100) * 80;

    let mask = floodFillBackground(data, w, h, tolerance);
    mask = morphClose(mask, w, h, closeRadius);

    const bg = estimateBorderColor(data, w, h);

    if (feather > 0) {
      mask = featherMask(mask, w, h, feather);
    }

    const outData = new Uint8ClampedArray(data); // کپی رنگ‌ها
    decontaminate(outData, mask, w, h, bg);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w; maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d');
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
