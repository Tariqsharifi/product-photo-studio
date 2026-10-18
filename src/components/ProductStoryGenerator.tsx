import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Upload, Share2, Sparkles, X, Loader2, Download } from "lucide-react";

const CODE_KEY = "photocut_video_access_code";
const W = 720;
const H = 1280;
const CREDITS_PER_SECOND = 24;
const FONT_STACK = 'Vazirmatn, Tahoma, "Segoe UI", system-ui, sans-serif';

interface Shot {
  id: string;
  label: string;
  enabled: boolean;
  text: string;
  note?: string;
}

interface ShotState {
  status: "idle" | "queued" | "rendering" | "complete" | "error";
  url?: string;
  credits?: number;
  error?: string;
}

type Phase = "idle" | "uploading" | "generating" | "stitching" | "done" | "error";

const DEFAULT_SHOTS: Shot[] = [
  {
    id: "reveal",
    label: "صحنه ۱ — معرفی و جذب توجه",
    enabled: true,
    text: "Cinematic reveal of {p}: slow smooth camera push-in, golden light sweeps across its surface, sparkling highlights, soft floating dust particles, luxury commercial, ultra realistic",
  },
  {
    id: "detail",
    label: "صحنه ۲ — جزئیات و کیفیت",
    enabled: true,
    text: "Extreme close-up macro shot of {p}, the camera slowly slides along its surface showing texture and glossy reflections, shallow depth of field, soft studio light, realistic",
  },
  {
    id: "hero",
    label: "صحنه ۳ — نمای پایانی",
    enabled: true,
    text: "Final hero shot of {p} standing in the center, slow elegant orbiting camera, glossy reflections, gentle light flare, premium look, realistic",
  },
  {
    id: "use",
    label: "صحنه ۴ — استفاده (اختیاری)",
    enabled: false,
    note: "ممکن است شکل محصول را کمی تغییر دهد؛ اول صحنه‌های ۱ تا ۳ را امتحان کنید.",
    text: "A person's hand naturally uses {p} in a bright modern home, soft natural window light, realistic motion, lifestyle commercial",
  },
];

/* ───────────────────────── ابزارها ───────────────────────── */

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function errText(err: unknown): string {
  if (err instanceof ConvexError) return String(err.data);
  return "خطای ناشناخته. دوباره امتحان کنید.";
}

function readCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) || "";
  } catch {
    return "";
  }
}

// عکس محصول را روی صحنه‌ی عمودی ۹:۱۶ می‌گذارد تا ویدیو هم عمودی ساخته شود
function composePhoto(img: HTMLImageElement): { base64: string; previewUrl: string } {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#eceef2");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const s = Math.min((W * 0.82) / iw, (H * 0.55) / ih);
  const dw = iw * s;
  const dh = ih * s;
  const cx = W / 2;
  const cy = H * 0.48;

  // سایه‌ی نرم زیر محصول
  ctx.save();
  ctx.translate(cx, cy + dh / 2 + 8);
  ctx.scale(1, 0.1);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, dw * 0.5);
  sg.addColorStop(0, "rgba(0,0,0,0.22)");
  sg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.arc(0, 0, dw * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);

  const dataUrl = c.toDataURL("image/jpeg", 0.9);
  return { base64: dataUrl.split(",")[1] || "", previewUrl: dataUrl };
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

type FetchClipFn = (args: { url: string; accessCode: string }) => Promise<{ base64: string; mimeType: string }>;

// اول مستقیم از مرورگر؛ اگر مرورگر اجازه نداد از طریق سرور
async function loadClipBlobUrl(url: string, accessCode: string, fetchClip: FetchClipFn): Promise<string> {
  try {
    const res = await fetch(url);
    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    /* ادامه با سرور */
  }
  const r = await fetchClip({ url, accessCode });
  return URL.createObjectURL(base64ToBlob(r.base64, r.mimeType));
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement) {
  const vw = v.videoWidth || W;
  const vh = v.videoHeight || H;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s;
  const dh = vh * s;
  ctx.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, yFrac: number, size: number, color: string, alpha: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  ctx.font = `800 ${size}px ${FONT_STACK}`;
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (!cur || ctx.measureText(test).width <= W * 0.82) cur = test;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);

  const lh = size * 1.35;
  const y0 = H * yFrac - ((shown.length - 1) * lh) / 2;

  ctx.save();
  const bandH = shown.length * lh + size * 1.4;
  const bg = ctx.createLinearGradient(0, y0 - bandH, 0, y0 + bandH);
  bg.addColorStop(0, "rgba(0,0,0,0)");
  bg.addColorStop(0.5, "rgba(0,0,0,0.5)");
  bg.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bg;
  ctx.fillRect(0, y0 - bandH, W, bandH * 2);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  try {
    (ctx as CanvasRenderingContext2D & { direction: CanvasDirection }).direction = "rtl";
  } catch {
    /* ignore */
  }
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  shown.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + i * lh));
  ctx.restore();
}

const HIDDEN_STYLE = "position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none";

// کلیپ‌ها را پشت سر هم پخش و روی یک بوم ضبط می‌کند تا یک ویدیوی واحد شود
async function stitchClips(
  urls: string[],
  title: string,
  cta: string,
  onProgress: (p: number) => void
): Promise<{ blob: Blob; ext: string }> {
  const mime = pickMime();
  if (!mime) throw new Error("no-recorder");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = HIDDEN_STYLE;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  const videos: HTMLVideoElement[] = [];

  try {
    try {
      await document.fonts?.load(`800 40px ${FONT_STACK}`);
    } catch {
      /* ignore */
    }

    for (const u of urls) {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.preload = "auto";
      v.style.cssText = HIDDEN_STYLE;
      v.src = u;
      document.body.appendChild(v);
      videos.push(v);
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("load-timeout")), 20000);
        v.onloadeddata = () => {
          clearTimeout(t);
          resolve();
        };
        v.onerror = () => {
          clearTimeout(t);
          reject(new Error("load-error"));
        };
        v.load();
      });
    }

    const totalDur = videos.reduce((sum, v) => sum + (v.duration || 0), 0) || 1;
    const stream = canvas.captureStream(30);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    const stopped = new Promise<void>((res) => {
      recorder.onstop = () => res();
    });
    recorder.start();

    let doneDur = 0;
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      await new Promise<void>((resolve) => {
        let raf = 0;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          cancelAnimationFrame(raf);
          resolve();
        };
        const dur = v.duration || 5;
        const guard = setTimeout(finish, (dur + 2) * 1000);
        v.onended = () => {
          clearTimeout(guard);
          finish();
        };
        const draw = () => {
          if (finished) return;
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);
          drawCover(ctx, v);
          const t = v.currentTime;
          if (i === 0 && title.trim()) drawCaption(ctx, title, 0.78, 54, "#ffffff", clamp(t / 0.5));
          if (i === videos.length - 1 && cta.trim()) drawCaption(ctx, cta, 0.78, 46, "#fde68a", clamp(t / 0.5));
          onProgress(clamp((doneDur + t) / totalDur));
          raf = requestAnimationFrame(draw);
        };
        v.currentTime = 0;
        v.play()
          .then(() => draw())
          .catch(() => finish());
      });
      doneDur += videos[i].duration || 0;
    }

    await sleep(250);
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    stream.getTracks().forEach((tr) => tr.stop());

    const realType = (recorder.mimeType || mime).split(";")[0] || "video/mp4";
    const blob = new Blob(chunks, { type: realType });
    if (blob.size === 0) throw new Error("empty");
    return { blob, ext: realType.includes("mp4") ? "mp4" : "webm" };
  } finally {
    videos.forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.remove();
    });
    canvas.remove();
  }
}

/* ───────────────────────── کامپوننت ───────────────────────── */

export default function ProductStoryGenerator() {
  const uploadImage = useAction(api.aiVideo.uploadImage);
  const startImageVideo = useAction(api.aiVideo.startImageVideo);
  const getVideo = useAction(api.aiVideo.getVideo);
  const fetchClip = useAction(api.aiVideo.fetchClip);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const [photo, setPhoto] = useState<{ base64: string; previewUrl: string } | null>(null);
  const [productText, setProductText] = useState("");
  const [shots, setShots] = useState<Shot[]>(DEFAULT_SHOTS);
  const [states, setStates] = useState<ShotState[]>(DEFAULT_SHOTS.map(() => ({ status: "idle" })));
  const [seconds, setSeconds] = useState(4);
  const [title, setTitle] = useState("");
  const [cta, setCta] = useState("");
  const [code, setCode] = useState(readCode);

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [stitchPct, setStitchPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finalVideo, setFinalVideo] = useState<{ url: string; blob: Blob; ext: string } | null>(null);

  const busy = phase === "uploading" || phase === "generating" || phase === "stitching";
  const enabledCount = shots.filter((s) => s.enabled).length;
  const estimate = enabledCount * seconds * CREDITS_PER_SECOND;
  const usedCredits = states.reduce((sum, s) => sum + (s.credits || 0), 0);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    return () => {
      if (finalVideo) URL.revokeObjectURL(finalVideo.url);
    };
  }, [finalVideo]);

  const saveCode = (value: string) => {
    setCode(value);
    try {
      localStorage.setItem(CODE_KEY, value);
    } catch {
      /* ignore */
    }
  };

  const patchState = (idx: number, patch: Partial<ShotState>) =>
    setStates((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const updateShot = (idx: number, patch: Partial<Shot>) =>
    setShots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  /* انتخاب عکس */
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const im = new window.Image();
    im.onload = () => {
      try {
        setPhoto(composePhoto(im));
        setError(null);
      } catch {
        setError("پردازش عکس ناموفق بود. عکس دیگری را امتحان کنید.");
      }
      URL.revokeObjectURL(url);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      setError("این عکس خوانده نشد. یک عکس JPG یا PNG امتحان کنید.");
    };
    im.src = url;
    e.target.value = "";
  };

  /* شروع */
  const handleStart = async () => {
    if (busy) return;
    if (!photo) {
      setError("ابتدا عکس محصول را انتخاب کنید.");
      return;
    }
    if (!code.trim()) {
      setError("کد دسترسی را وارد کنید.");
      return;
    }
    if (enabledCount === 0) {
      setError("حداقل یک صحنه را فعال کنید.");
      return;
    }

    const accessCode = code.trim();
    cancelRef.current = false;
    setError(null);
    setFinalVideo(null);
    setStates(shots.map(() => ({ status: "idle" })));
    setElapsed(0);
    setStitchPct(0);

    const product = productText.trim() || "the product";

    try {
      setPhase("uploading");
      setStatusText("در حال ارسال عکس محصول…");
      const { filePath } = await uploadImage({ imageBase64: photo.base64, accessCode });
      if (cancelRef.current) return;

      setPhase("generating");
      setStatusText("در حال شروع ساخت صحنه‌ها…");

      const jobs: { idx: number; id: string; done: boolean }[] = [];
      const clipUrls: (string | null)[] = shots.map(() => null);
      let stopStarting = false;

      for (let i = 0; i < shots.length; i++) {
        if (!shots[i].enabled || stopStarting) continue;
        const prompt = shots[i].text.split("{p}").join(product);
        try {
          const started = await startImageVideo({ filePath, prompt, seconds, accessCode });
          jobs.push({ idx: i, id: started.id, done: false });
          patchState(i, { status: "queued", credits: started.credits });
        } catch (err) {
          const msg = errText(err);
          patchState(i, { status: "error", error: msg });
          if (msg.includes("اعتبار") || msg.includes("کلید") || msg.includes("کد دسترسی")) stopStarting = true;
        }
        if (cancelRef.current) return;
      }

      if (jobs.length === 0) {
        setError("هیچ صحنه‌ای شروع نشد. خطای بالا را بررسی کنید.");
        setPhase("error");
        return;
      }

      setStatusText("صحنه‌ها در حال ساخت هستند…");
      const deadline = Date.now() + 8 * 60 * 1000;
      while (!cancelRef.current && Date.now() < deadline && jobs.some((j) => !j.done)) {
        await sleep(5000);
        for (const j of jobs) {
          if (j.done || cancelRef.current) continue;
          try {
            const info = await getVideo({ id: j.id, accessCode });
            if (info.status === "complete" && info.downloadUrl) {
              j.done = true;
              clipUrls[j.idx] = info.downloadUrl;
              patchState(j.idx, { status: "complete", url: info.downloadUrl });
            } else if (info.status === "error" || info.status === "canceled") {
              j.done = true;
              patchState(j.idx, { status: "error", error: info.errorMessage || "ساخت این صحنه ناموفق بود." });
            } else {
              patchState(j.idx, { status: info.status === "rendering" ? "rendering" : "queued" });
            }
          } catch {
            /* دفعه‌ی بعد دوباره امتحان می‌شود */
          }
        }
      }
      if (cancelRef.current) return;

      jobs.forEach((j) => {
        if (!j.done) patchState(j.idx, { status: "error", error: "ساخت بیش از حد طول کشید." });
      });

      const ordered = clipUrls.filter((u): u is string => !!u);
      if (ordered.length === 0) {
        setError("هیچ صحنه‌ای ساخته نشد.");
        setPhase("error");
        return;
      }

      setPhase("stitching");
      setStatusText("در حال چسباندن صحنه‌ها به هم…");

      const blobUrls: string[] = [];
      try {
        for (const u of ordered) {
          blobUrls.push(await loadClipBlobUrl(u, accessCode, fetchClip));
        }
        const out = await stitchClips(blobUrls, title, cta, (p) => setStitchPct(Math.round(p * 100)));
        if (cancelRef.current) return;
        setFinalVideo({ url: URL.createObjectURL(out.blob), blob: out.blob, ext: out.ext });
        setPhase("done");
      } catch (err) {
        console.error(err);
        setError("چسباندن صحنه‌ها ناموفق بود. می‌توانید هر صحنه را جدا از فهرست پایین باز و ذخیره کنید.");
        setPhase("error");
      } finally {
        blobUrls.forEach((b) => URL.revokeObjectURL(b));
      }
    } catch (err) {
      if (cancelRef.current) return;
      setError(errText(err));
      setPhase("error");
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setPhase("idle");
    setStatusText("");
  };

  const fileName = () => `product-story-${Date.now()}.${finalVideo?.ext || "mp4"}`;

  const handleShare = async () => {
    if (!finalVideo) return;
    const file = new File([finalVideo.blob], fileName(), { type: finalVideo.blob.type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
    }
    setError("اشتراک‌گذاری در این مرورگر ممکن نیست؛ از دکمه‌ی «دانلود» استفاده کنید.");
  };

  const handleDownload = () => {
    if (!finalVideo) return;
    const a = document.createElement("a");
    a.href = finalVideo.url;
    a.download = fileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const statusLabel = (s: ShotState) => {
    if (s.status === "queued") return "در صف…";
    if (s.status === "rendering") return "در حال ساخت…";
    if (s.status === "complete") return "آماده ✓";
    if (s.status === "error") return `خطا: ${s.error || ""}`;
    return "";
  };

  return (
    <div dir="rtl" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* ورودی‌ها */}
      <div className="space-y-4">
        <Card className="p-4">
          <h4 className="font-semibold mb-3">📸 عکس محصول</h4>
          {photo ? (
            <div className="flex items-center gap-3">
              <img src={photo.previewUrl} alt="محصول" className="w-24 h-auto rounded-md border" />
              <Button variant="outline" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 ml-2" /> تغییر عکس
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 ml-2" /> انتخاب عکس محصول
            </Button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
          <p className="text-xs text-gray-500 mt-2 leading-5">
            بهتر است محصول واضح باشد و پس‌زمینه‌ی عکس سفید یا حذف‌شده باشد. عکس روی صحنه‌ی عمودی ۹:۱۶ قرار می‌گیرد.
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🏷️ محصول چیست؟ (کوتاه، ترجیحاً انگلیسی)</h4>
          <input
            dir="ltr"
            value={productText}
            maxLength={120}
            disabled={busy}
            onChange={(e) => setProductText(e.target.value)}
            placeholder="a clear crystal-cut liquid soap dispenser with chrome pump"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <p className="text-xs text-gray-500 mt-2 leading-5">
            این توضیح جای {"{p}"} در پرامت صحنه‌ها می‌نشیند. هرچه دقیق‌تر باشد، محصول کمتر تغییر می‌کند.
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🎬 صحنه‌های داستان</h4>
          <div className="space-y-4">
            {shots.map((s, i) => (
              <div key={s.id} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    disabled={busy}
                    onChange={(e) => updateShot(i, { enabled: e.target.checked })}
                  />
                  {s.label}
                </label>
                {s.note && <p className="text-xs text-amber-700">{s.note}</p>}
                {s.enabled && (
                  <textarea
                    dir="ltr"
                    rows={3}
                    value={s.text}
                    disabled={busy}
                    onChange={(e) => updateShot(i, { text: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">⏱️ مدت هر صحنه: {seconds} ثانیه</h4>
          <Slider value={[seconds]} onValueChange={(v: number[]) => setSeconds(v[0])} min={3} max={5} disabled={busy} />
          <p className="text-xs text-gray-500 mt-3 leading-5">
            {enabledCount} صحنه × {seconds} ثانیه ≈ {estimate} کردیت (برآورد بر اساس ۲۴ کردیت در ثانیه برای ۴۸۰p؛ عدد دقیق بعد از شروع نمایش داده می‌شود).
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">✍️ متن روی ویدیو (اختیاری)</h4>
          <div className="space-y-3">
            <input
              dir="rtl"
              value={title}
              maxLength={50}
              disabled={busy}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="متن ابتدای ویدیو (مثلاً: جلوه‌ی کریستالی برای سرویس بهداشتی شما)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <input
              dir="rtl"
              value={cta}
              maxLength={60}
              disabled={busy}
              onChange={(e) => setCta(e.target.value)}
              placeholder="متن پایانی (مثلاً: سفارش از دایرکت)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-5">
            موسیقی را داخل خود اینستاگرام موقع انتشار ریلز اضافه کنید؛ بهتر دیده می‌شود.
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🔑 کد دسترسی</h4>
          <input
            type="password"
            dir="ltr"
            value={code}
            disabled={busy}
            onChange={(e) => saveCode(e.target.value)}
            placeholder="کدی که در Convex تنظیم کرده‌اید"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </Card>
      </div>

      {/* نتیجه */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="bg-gray-900 p-2 flex justify-center items-center min-h-[240px]">
            {finalVideo ? (
              <video
                key={finalVideo.url}
                src={finalVideo.url}
                controls
                playsInline
                loop
                className="w-auto h-auto max-h-[60vh] max-w-full rounded-md"
              />
            ) : (
              <div className="text-center text-gray-400 text-sm p-6 leading-7">
                {busy ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-purple-400" />
                    <p>{statusText}</p>
                    {phase === "stitching" ? <p>{stitchPct}٪</p> : <p>{elapsed} ثانیه گذشته</p>}
                    <p className="text-xs mt-2">این صفحه را باز نگه دارید و صفحه‌ی گوشی را خاموش نکنید.</p>
                  </>
                ) : (
                  <p>داستان ساخته‌شده اینجا نمایش داده می‌شود.</p>
                )}
              </div>
            )}
          </div>
        </Card>

        {states.some((s) => s.status !== "idle") && (
          <Card className="p-4 space-y-2">
            <h4 className="font-semibold text-sm">وضعیت صحنه‌ها</h4>
            {shots.map((s, i) =>
              states[i].status === "idle" ? null : (
                <div key={s.id} className="flex items-start justify-between gap-2 text-xs">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-gray-600 text-left">
                    {statusLabel(states[i])}
                    {states[i].url && (
                      <>
                        {" "}
                        <a href={states[i].url} target="_blank" rel="noreferrer" className="text-purple-600 underline">
                          باز کردن
                        </a>
                      </>
                    )}
                  </span>
                </div>
              )
            )}
            {usedCredits > 0 && <p className="text-xs text-gray-500">کردیت مصرف‌شده (طبق پاسخ سرویس): {usedCredits}</p>}
          </Card>
        )}

        {error && <p className="text-sm text-red-600 leading-6">{error}</p>}

        {phase === "done" && finalVideo && (
          <>
            <div className="flex gap-3">
              <Button onClick={handleShare} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
                <Share2 className="w-4 h-4 ml-2" /> ذخیره / اشتراک
              </Button>
              <Button onClick={handleDownload} variant="outline" className="flex-1">
                <Download className="w-4 h-4 ml-2" /> دانلود {finalVideo.ext.toUpperCase()}
              </Button>
            </div>
            <p className="text-xs text-gray-500 leading-5">
              ویدیوهای پلن رایگان Magic Hour ممکن است واترمارک داشته باشند و فقط برای استفاده‌ی غیرتجاری مجازند.
            </p>
          </>
        )}

        <div className="flex gap-3">
          {busy ? (
            <Button onClick={handleCancel} variant="outline" className="flex-1">
              <X className="w-4 h-4 ml-2" /> توقف
            </Button>
          ) : (
            <Button onClick={handleStart} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
              <Sparkles className="w-4 h-4 ml-2" /> ساخت داستان محصول
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
