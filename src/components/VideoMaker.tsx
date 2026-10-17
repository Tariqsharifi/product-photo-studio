import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Upload, Download, Share2, Loader2, Film, Trash2, X } from "lucide-react";

/* ───────────────────────── انواع و ثابت‌ها ───────────────────────── */

type MotionId = "zoom-in" | "zoom-out" | "pan-right" | "pan-left" | "cinematic";
type MusicId = "none" | "calm" | "upbeat" | "cinematic";
type BgId = "blur" | "dark" | "light" | "warm";
type LayoutId = "contain" | "cover";
type QualityId = "720" | "1080";

interface Cfg {
  motion: MotionId;
  layout: LayoutId;
  title: string;
  subtitle: string;
}

interface Assets {
  src: HTMLCanvasElement;
  bg: HTMLCanvasElement;
  vignette: HTMLCanvasElement;
  grain: CanvasPattern | null;
}

const MOTIONS: { id: MotionId; name: string }[] = [
  { id: "cinematic", name: "سینمایی" },
  { id: "zoom-in", name: "زوم به داخل" },
  { id: "zoom-out", name: "زوم به بیرون" },
  { id: "pan-right", name: "حرکت به راست" },
  { id: "pan-left", name: "حرکت به چپ" },
];

const MUSICS: { id: MusicId; name: string }[] = [
  { id: "calm", name: "آرام" },
  { id: "upbeat", name: "شاد" },
  { id: "cinematic", name: "سینمایی" },
  { id: "none", name: "بدون موسیقی" },
];

const BGS: { id: BgId; name: string }[] = [
  { id: "blur", name: "تاری عکس" },
  { id: "dark", name: "تیره" },
  { id: "light", name: "روشن" },
  { id: "warm", name: "گرم" },
];

const FONT_STACK = 'Vazirmatn, Tahoma, "Segoe UI", system-ui, sans-serif';

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

function sizeFor(q: QualityId) {
  return q === "1080" ? { W: 1080, H: 1920 } : { W: 720, H: 1280 };
}

/* ───────────────────────── آماده‌سازی تصویر و پس‌زمینه ───────────────────────── */

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

// کوچک‌کردن عکس‌های خیلی بزرگ برای روان‌بودن انیمیشن روی موبایل
function makeSource(img: HTMLImageElement): HTMLCanvasElement {
  const maxSide = 1600;
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = makeCanvas(img.naturalWidth * k, img.naturalHeight * k);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// بدون استفاده از ctx.filter (روی iOS Safari پشتیبانی کامل ندارد): تاری با کوچک‌کردن و بزرگ‌کردن
function makeBackground(src: HTMLCanvasElement, W: number, H: number, bg: BgId): HTMLCanvasElement {
  const out = makeCanvas(W, H);
  const ctx = out.getContext("2d")!;

  if (bg === "blur") {
    const coverScale = Math.max(W / src.width, H / src.height);
    const cw = src.width * coverScale;
    const ch = src.height * coverScale;
    const step1 = makeCanvas(W / 30, H / 30);
    const s1 = step1.getContext("2d")!;
    s1.imageSmoothingQuality = "high";
    s1.drawImage(src, (step1.width - (cw / 30)) / 2, (step1.height - (ch / 30)) / 2, cw / 30, ch / 30);
    const step2 = makeCanvas(W / 10, H / 10);
    const s2 = step2.getContext("2d")!;
    s2.imageSmoothingEnabled = true;
    s2.drawImage(step1, 0, 0, step2.width, step2.height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(step2, 0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, W, H);
  } else if (bg === "dark") {
    const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, Math.max(W, H) * 0.8);
    g.addColorStop(0, "#4b5563");
    g.addColorStop(0.6, "#1f2937");
    g.addColorStop(1, "#0b0f19");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (bg === "light") {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#fafafa");
    g.addColorStop(0.55, "#e5e7eb");
    g.addColorStop(1, "#cbd0d8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#fff7ed");
    g.addColorStop(0.5, "#fed7aa");
    g.addColorStop(1, "#fde68a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  return out;
}

function makeVignette(W: number, H: number): HTMLCanvasElement {
  const c = makeCanvas(W, H);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return c;
}

function makeGrain(): CanvasPattern | null {
  const c = makeCanvas(200, 200);
  const ctx = c.getContext("2d")!;
  const data = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.random() * 255;
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return ctx.createPattern(c, "repeat");
}

/* ───────────────────────── رسم هر فریم ───────────────────────── */

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (!cur || ctx.measureText(test).width <= maxW) {
      cur = test;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] += "…";
    return kept;
  }
  return lines;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  dur: number,
  cfg: Cfg,
  a: Assets
) {
  const k = W / 720;
  const p = clamp(t / dur);
  const e = easeInOut(p);

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(a.bg, 0, 0, W, H);

  /* محصول */
  const iw = a.src.width;
  const ih = a.src.height;
  const contain = cfg.layout === "contain";
  const baseScale = contain ? Math.min((W * 0.84) / iw, (H * 0.5) / ih) : Math.max(W / iw, H / ih);

  let z = 1;
  let dx = 0;
  let dy = 0;
  let rot = 0;
  switch (cfg.motion) {
    case "zoom-in":
      z = 1 + 0.2 * e;
      break;
    case "zoom-out":
      z = 1.2 - 0.2 * e;
      break;
    case "pan-right":
      z = 1.1;
      dx = (-0.05 + 0.1 * e) * W;
      break;
    case "pan-left":
      z = 1.1;
      dx = (0.05 - 0.1 * e) * W;
      break;
    case "cinematic":
      z = 1.02 + 0.14 * e;
      dx = Math.sin(p * Math.PI) * 0.018 * W;
      dy = -0.02 * H * e;
      rot = Math.sin(p * Math.PI) * 0.006;
      break;
  }

  const cx = W / 2 + dx;
  const cy = (contain ? H * 0.38 : H / 2) + dy;

  if (contain) {
    // سایه‌ی نرم زیر محصول
    ctx.save();
    ctx.translate(W / 2 + dx * 0.6, cy + (ih * baseScale * z) / 2 + 12 * k);
    ctx.scale(1, 0.12);
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, iw * baseScale * z * 0.5);
    sg.addColorStop(0, "rgba(0,0,0,0.38)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, iw * baseScale * z * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(z, z);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(a.src, (-iw * baseScale) / 2, (-ih * baseScale) / 2, iw * baseScale, ih * baseScale);
  ctx.restore();

  /* برق نور */
  if (p > 0.3 && p < 0.58) {
    const q = (p - 0.3) / 0.28;
    const bw = W * 0.28;
    ctx.save();
    ctx.translate(-bw + q * (W + bw * 2), 0);
    ctx.transform(1, 0, -0.3, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, bw, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.26)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, bw, H);
    ctx.restore();
  }

  /* وینیت و گرین */
  ctx.drawImage(a.vignette, 0, 0, W, H);
  if (a.grain) {
    ctx.save();
    ctx.translate(Math.random() * 200, Math.random() * 200);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = a.grain;
    ctx.fillRect(-200, -200, W + 200, H + 200);
    ctx.restore();
  }

  /* متن (داخل ناحیه‌ی امن ریلز) */
  const hasText = cfg.title.trim() || cfg.subtitle.trim();
  if (hasText) {
    const bandTop = H * 0.62;
    const bg = ctx.createLinearGradient(0, bandTop, 0, H);
    bg.addColorStop(0, "rgba(0,0,0,0)");
    bg.addColorStop(0.45, "rgba(0,0,0,0.5)");
    bg.addColorStop(1, "rgba(0,0,0,0.7)");
    const bandAlpha = easeOut(clamp((t - 0.6) / 0.6));
    ctx.save();
    ctx.globalAlpha = bandAlpha;
    ctx.fillStyle = bg;
    ctx.fillRect(0, bandTop, W, H - bandTop);
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    try {
      (ctx as CanvasRenderingContext2D & { direction: CanvasDirection }).direction = "rtl";
    } catch {
      /* ignore */
    }

    if (cfg.title.trim()) {
      const ta = easeOut(clamp((t - 0.9) / 0.7));
      const size = Math.round(62 * k);
      ctx.font = `800 ${size}px ${FONT_STACK}`;
      const lines = wrapLines(ctx, cfg.title, W * 0.82, 2);
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 10 * k;
      const lh = size * 1.3;
      const y0 = H * 0.72 + (1 - ta) * 36 * k - ((lines.length - 1) * lh) / 2;
      lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + i * lh));
      ctx.restore();
    }

    if (cfg.subtitle.trim()) {
      const sa = easeOut(clamp((t - 1.25) / 0.7));
      const size = Math.round(40 * k);
      ctx.font = `600 ${size}px ${FONT_STACK}`;
      const lines = wrapLines(ctx, cfg.subtitle, W * 0.8, 2);
      ctx.save();
      ctx.globalAlpha = sa;
      ctx.fillStyle = "#fde68a";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8 * k;
      const lh = size * 1.3;
      const y0 = H * 0.8 + (1 - sa) * 30 * k;
      lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y0 + i * lh));
      ctx.restore();
    }
  }

  /* محو در ابتدا و انتها */
  const fadeIn = clamp(t / 0.35);
  const fadeOut = clamp((dur - t) / 0.45);
  const fade = Math.min(fadeIn, fadeOut);
  if (fade < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}

/* ───────────────────────── موسیقی ساخته‌شده با WebAudio (بدون فایل کپی‌رایت) ───────────────────────── */

function tone(
  ac: AudioContext,
  out: AudioNode,
  freq: number,
  start: number,
  len: number,
  type: OscillatorType,
  vol: number,
  attack = 0.02,
  release = 0.25
) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + len + release);
  o.connect(g);
  g.connect(out);
  o.start(start);
  o.stop(start + len + release + 0.05);
}

function noiseBuffer(ac: AudioContext) {
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function hat(ac: AudioContext, out: AudioNode, buf: AudioBuffer, start: number, vol: number) {
  const s = ac.createBufferSource();
  s.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 7000;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
  s.connect(f);
  f.connect(g);
  g.connect(out);
  s.start(start);
  s.stop(start + 0.1);
}

function kick(ac: AudioContext, out: AudioNode, start: number, vol: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(150, start);
  o.frequency.exponentialRampToValueAtTime(45, start + 0.14);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
  o.connect(g);
  g.connect(out);
  o.start(start);
  o.stop(start + 0.3);
}

function scheduleMusic(ac: AudioContext, dest: AudioNode, mood: MusicId, dur: number) {
  if (mood === "none") return;
  const t0 = ac.currentTime + 0.05;

  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.exponentialRampToValueAtTime(0.6, t0 + 0.4);
  master.gain.setValueAtTime(0.6, t0 + Math.max(0.5, dur - 0.9));
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  master.connect(dest);

  const noise = noiseBuffer(ac);

  if (mood === "calm") {
    const chords = [
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [261.63, 329.63, 392],
      [196, 246.94, 293.66],
    ];
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    lp.connect(master);
    const chordLen = 2.4;
    for (let i = 0, c = 0; i < dur; i += chordLen, c++) {
      chords[c % chords.length].forEach((f) => tone(ac, lp, f, t0 + i, chordLen, "sine", 0.14, 0.5, 0.8));
    }
    const beat = 60 / 72;
    for (let i = 0, n = 0; i < dur; i += beat / 2, n++) {
      const ch = chords[Math.floor(i / chordLen) % chords.length];
      tone(ac, master, ch[n % 3] * 2, t0 + i, 0.25, "triangle", 0.05, 0.01, 0.3);
    }
  } else if (mood === "upbeat") {
    const beat = 60 / 112;
    const bass = [110, 110, 87.31, 98];
    const arp = [220, 277.18, 329.63, 277.18];
    for (let i = 0, n = 0; i < dur; i += beat, n++) {
      kick(ac, master, t0 + i, 0.6);
      hat(ac, master, noise, t0 + i + beat / 2, 0.12);
      tone(ac, master, bass[Math.floor(n / 2) % bass.length], t0 + i, beat * 0.9, "triangle", 0.22, 0.01, 0.1);
      tone(ac, master, arp[n % arp.length] * 2, t0 + i + beat / 4, beat / 3, "triangle", 0.07, 0.01, 0.12);
      tone(ac, master, arp[(n + 2) % arp.length] * 2, t0 + i + (beat * 3) / 4, beat / 3, "triangle", 0.06, 0.01, 0.12);
    }
  } else {
    // cinematic: درون‌مایه‌ی پایین + ریسر + ضربه‌ی پایانی
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(220, t0);
    lp.frequency.exponentialRampToValueAtTime(1800, t0 + dur - 0.8);
    lp.connect(master);
    tone(ac, lp, 55, t0, dur, "sawtooth", 0.2, 0.8, 0.5);
    tone(ac, lp, 55.6, t0, dur, "sawtooth", 0.16, 0.8, 0.5);
    tone(ac, lp, 110, t0 + 1.2, dur - 1.2, "triangle", 0.1, 1.0, 0.5);

    const rs = ac.createBufferSource();
    rs.buffer = noise;
    rs.loop = true;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(400, t0);
    bp.frequency.exponentialRampToValueAtTime(6000, t0 + dur - 0.7);
    const rg = ac.createGain();
    rg.gain.setValueAtTime(0.0001, t0);
    rg.gain.exponentialRampToValueAtTime(0.18, t0 + dur - 0.8);
    rg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur - 0.1);
    rs.connect(bp);
    bp.connect(rg);
    rg.connect(master);
    rs.start(t0);
    rs.stop(t0 + dur);

    kick(ac, master, t0 + dur - 0.75, 0.9);
  }
}

/* ───────────────────────── ضبط ───────────────────────── */

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";
}

/* ───────────────────────── کامپوننت ───────────────────────── */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm transition-all ${
        active ? "bg-purple-500 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

export default function VideoMaker() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const [duration, setDuration] = useState(7);
  const [motion, setMotion] = useState<MotionId>("cinematic");
  const [music, setMusic] = useState<MusicId>("calm");
  const [bg, setBg] = useState<BgId>("blur");
  const [layout, setLayout] = useState<LayoutId>("contain");
  const [quality, setQuality] = useState<QualityId>("720");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");

  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; blob: Blob; ext: string } | null>(null);
  const [assetsVersion, setAssetsVersion] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assetsRef = useRef<Assets | null>(null);
  const cancelRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);

  const cfgRef = useRef<Cfg>({ motion, layout, title, subtitle });
  cfgRef.current = { motion, layout, title, subtitle };
  const durationRef = useRef(duration);
  durationRef.current = duration;

  const { W, H } = sizeFor(quality);
  const showResult = !!result && !recording;

  /* آپلود */
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const im = new window.Image();
    im.onload = () => {
      setImgUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setImg(im);
      setError(null);
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      setError("این عکس خوانده نشد. یک عکس دیگر (JPG یا PNG) امتحان کنید.");
    };
    im.src = url;
    e.target.value = "";
  };

  /* ساخت پس‌زمینه و افکت‌ها با تغییر عکس/کیفیت/پس‌زمینه */
  useEffect(() => {
    if (!img) {
      assetsRef.current = null;
      return;
    }
    const src = makeSource(img);
    assetsRef.current = {
      src,
      bg: makeBackground(src, W, H, bg),
      vignette: makeVignette(W, H),
      grain: makeGrain(),
    };
    setAssetsVersion((v) => v + 1);
  }, [img, bg, W, H]);

  /* پیش‌نمایش زنده (فقط وقتی در حال ضبط نیستیم) */
  useEffect(() => {
    if (!img || recording || result) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const a = assetsRef.current;
      if (a) {
        const dur = durationRef.current;
        const t = (((performance.now() - start) / 1000) % (dur + 1.2)) as number;
        drawFrame(ctx, W, H, Math.min(t, dur), dur, cfgRef.current, a);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [img, recording, result, assetsVersion, W, H]);

  /* پاک‌سازی */
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      try {
        if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop();
      } catch {
        /* ignore */
      }
      audioRef.current?.close().catch(() => {});
      wakeRef.current?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.url);
    };
  }, [result]);

  /* ساخت ویدیو */
  const startRecording = async () => {
    const canvas = canvasRef.current;
    const a = assetsRef.current;
    if (!img || !canvas || !a || recording) return;

    setError(null);
    setResult(null);

    const mime = pickMime();
    if (!mime || typeof canvas.captureStream !== "function") {
      setError("این مرورگر ضبط ویدیو را پشتیبانی نمی‌کند. روی آیفون از Safari و روی اندروید از Chrome به‌روز استفاده کنید.");
      return;
    }

    cancelRef.current = false;
    setRecording(true);
    setProgress(0);

    const dur = durationRef.current;
    let ac: AudioContext | null = null;

    try {
      // قفل نکردن صفحه در حین ضبط (اگر مرورگر پشتیبانی کند)
      try {
        wakeRef.current = (await navigator.wakeLock?.request("screen")) || null;
      } catch {
        /* ignore */
      }

      try {
        await document.fonts?.load(`800 40px ${FONT_STACK}`);
      } catch {
        /* ignore */
      }

      const stream = canvas.captureStream(30);

      if (music !== "none") {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ac = new AC();
        audioRef.current = ac;
        await ac.resume();
        const dest = ac.createMediaStreamDestination();
        scheduleMusic(ac, dest, music, dur);
        dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      }

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: quality === "1080" ? 8_000_000 : 5_000_000,
      });
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      const ctx = canvas.getContext("2d")!;
      recorder.start();
      const t0 = performance.now();
      let lastPct = -1;

      await new Promise<void>((resolve) => {
        const loop = () => {
          if (cancelRef.current) return resolve();
          const t = (performance.now() - t0) / 1000;
          drawFrame(ctx, W, H, Math.min(t, dur), dur, cfgRef.current, a);
          const pct = Math.floor(clamp(t / dur) * 100);
          if (pct !== lastPct) {
            lastPct = pct;
            setProgress(pct);
          }
          if (t >= dur) return resolve();
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      });

      // کمی صبر تا آخرین فریم‌ها ضبط شوند
      if (!cancelRef.current) await new Promise((r) => setTimeout(r, 200));
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      stream.getTracks().forEach((tr) => tr.stop());

      if (cancelRef.current) return;

      const realType = (recorder.mimeType || mime).split(";")[0] || "video/mp4";
      const ext = realType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: realType });
      if (blob.size === 0) throw new Error("empty");
      setResult({ url: URL.createObjectURL(blob), blob, ext });
    } catch (err) {
      console.error(err);
      setError("ساخت ویدیو ناموفق بود. صفحه را باز نگه دارید، کیفیت را روی ۷۲۰ بگذارید و دوباره امتحان کنید.");
    } finally {
      try {
        await ac?.close();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
      try {
        await wakeRef.current?.release();
      } catch {
        /* ignore */
      }
      wakeRef.current = null;
      recorderRef.current = null;
      setRecording(false);
    }
  };

  const cancelRecording = () => {
    cancelRef.current = true;
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    } catch {
      /* ignore */
    }
  };

  /* ذخیره و اشتراک */
  const fileName = () => `product-video-${Date.now()}.${result?.ext || "mp4"}`;

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.url;
    link.download = fileName();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (!result) return;
    const file = new File([result.blob], fileName(), { type: result.blob.type });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      console.error("Share failed:", err);
    }
    setError("اشتراک‌گذاری در این مرورگر ممکن نیست؛ از دکمه‌ی «دانلود» استفاده کنید.");
  };

  const handleClear = () => {
    cancelRecording();
    setImg(null);
    setImgUrl(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setTitle("");
    setSubtitle("");
  };

  /* ───────── رابط ───────── */

  if (!img) {
    return (
      <div dir="rtl">
        <div
          className="border-2 border-dashed border-purple-300 rounded-2xl p-10 text-center hover:border-purple-500 transition-colors cursor-pointer bg-purple-50/50 flex flex-col items-center justify-center"
          onClick={() => fileInputRef.current?.click()}
        >
          <Film className="w-14 h-14 mx-auto text-purple-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">عکس محصول را انتخاب کنید</h3>
          <p className="text-gray-500 text-sm leading-6">
            یک ویدیوی عمودی ۵ تا ۱۰ ثانیه‌ای مناسب ریلز اینستاگرام می‌سازیم.
            <br />
            بهتر است عکس محصول با پس‌زمینه‌ی حذف‌شده باشد.
          </p>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div dir="rtl" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* پیش‌نمایش / نتیجه */}
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="bg-gray-900 p-2 flex justify-center">
            {showResult && result && (
              <video
                key={result.url}
                src={result.url}
                controls
                playsInline
                loop
                className="w-auto h-auto max-h-[60vh] max-w-full rounded-md"
              />
            )}
            {/* کانوس همیشه در DOM می‌ماند تا ضبط روی همان عنصر انجام شود */}
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className={`w-auto h-auto max-h-[60vh] max-w-full rounded-md ${showResult ? "hidden" : ""}`}
              style={{ aspectRatio: "9 / 16" }}
            />
          </div>
        </Card>

        {recording && (
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-600 to-pink-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-gray-600 text-center">
              در حال ساخت ویدیو… {progress}٪ — لطفاً از این صفحه خارج نشوید و صفحه را خاموش نکنید.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {showResult && result && (
          <>
            {result.ext !== "mp4" && (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 leading-6">
                این مرورگر فقط ویدیو را با فرمت WebM ساخته است. برای خروجی MP4، روی آیفون از Safari و روی اندروید از Chrome به‌روز استفاده کنید.
              </p>
            )}
            <div className="flex gap-3">
              <Button onClick={handleShare} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
                <Share2 className="w-4 h-4 ml-2" /> ذخیره / اشتراک
              </Button>
              <Button onClick={handleDownload} variant="outline" className="flex-1">
                <Download className="w-4 h-4 ml-2" /> دانلود {result.ext.toUpperCase()}
              </Button>
            </div>
            <p className="text-xs text-gray-500 leading-5">
              روی آیفون: «ذخیره / اشتراک» را بزنید و «Save Video» را انتخاب کنید تا در گالری ذخیره شود.
            </p>
          </>
        )}
      </div>

      {/* تنظیمات */}
      <div className="space-y-4">
        <Card className="p-4">
          <h4 className="font-semibold mb-3">⏱️ مدت ویدیو: {duration} ثانیه</h4>
          <Slider value={[duration]} onValueChange={(v: number[]) => setDuration(v[0])} min={5} max={10} disabled={recording} />
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🎬 حرکت دوربین</h4>
          <div className="flex flex-wrap gap-2">
            {MOTIONS.map((m) => (
              <Chip key={m.id} active={motion === m.id} onClick={() => setMotion(m.id)}>
                {m.name}
              </Chip>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🖼️ چیدمان و پس‌زمینه</h4>
          <div className="flex flex-wrap gap-2 mb-3">
            <Chip active={layout === "contain"} onClick={() => setLayout("contain")}>
              محصول در مرکز
            </Chip>
            <Chip active={layout === "cover"} onClick={() => setLayout("cover")}>
              پر کردن صفحه
            </Chip>
          </div>
          {layout === "contain" && (
            <div className="flex flex-wrap gap-2">
              {BGS.map((b) => (
                <Chip key={b.id} active={bg === b.id} onClick={() => setBg(b.id)}>
                  {b.name}
                </Chip>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">✍️ متن روی ویدیو</h4>
          <div className="space-y-3">
            <input
              dir="rtl"
              value={title}
              maxLength={40}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان (مثلاً: جدیدترین مدل ۱۴۰۵)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <input
              dir="rtl"
              value={subtitle}
              maxLength={50}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="زیرعنوان (مثلاً: ارسال رایگان)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🎵 موسیقی</h4>
          <div className="flex flex-wrap gap-2">
            {MUSICS.map((m) => (
              <Chip key={m.id} active={music === m.id} onClick={() => setMusic(m.id)}>
                {m.name}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">موسیقی‌ها داخل خود برنامه ساخته می‌شوند و مشکل کپی‌رایت ندارند.</p>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">📐 کیفیت</h4>
          <div className="flex gap-2">
            <Chip active={quality === "720"} onClick={() => setQuality("720")}>
              ۷۲۰×۱۲۸۰ (پیشنهادی)
            </Chip>
            <Chip active={quality === "1080"} onClick={() => setQuality("1080")}>
              ۱۰۸۰×۱۹۲۰
            </Chip>
          </div>
        </Card>

        <div className="flex gap-3">
          {recording ? (
            <Button onClick={cancelRecording} variant="outline" className="flex-1">
              <X className="w-4 h-4 ml-2" /> لغو
            </Button>
          ) : (
            <Button onClick={startRecording} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
              <Film className="w-4 h-4 ml-2" /> ساخت ویدیو
            </Button>
          )}
          <Button onClick={handleClear} variant="outline" disabled={recording}>
            {recording ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
