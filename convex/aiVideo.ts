import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";

const API = "https://api.magichour.ai";

function checkAccess(code: string) {
  const expected = process.env.VIDEO_ACCESS_CODE;
  if (!expected) {
    throw new ConvexError("کد دسترسی روی سرور تنظیم نشده است (VIDEO_ACCESS_CODE).");
  }
  if (code !== expected) {
    throw new ConvexError("کد دسترسی اشتباه است.");
  }
}

function getKey(): string {
  const key = process.env.MAGIC_HOUR_API_KEY;
  if (!key) {
    throw new ConvexError("کلید Magic Hour روی سرور تنظیم نشده است (MAGIC_HOUR_API_KEY).");
  }
  return key;
}

async function readMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: string };
    return j.message || "";
  } catch {
    return "";
  }
}

function failStart(status: number, msg: string): ConvexError<string> {
  console.error("MagicHour error", status, msg);
  if (status === 401) return new ConvexError("کلید Magic Hour معتبر نیست.");
  if (status === 402) return new ConvexError("اعتبار (کردیت) Magic Hour تمام شده است.");
  if (status === 400 || status === 422) {
    return new ConvexError(`درخواست رد شد: ${msg || "پارامترها نامعتبر است."}`);
  }
  return new ConvexError("سرویس ساخت ویدیو خطا داد. کمی بعد دوباره امتحان کنید.");
}

// ───────── ساخت ویدیو از روی پرامت (POST /v1/text-to-video) ─────────
export const startVideo = action({
  args: {
    prompt: v.string(),
    seconds: v.number(),
    accessCode: v.string(),
  },
  handler: async (_ctx, args): Promise<{ id: string; credits: number }> => {
    checkAccess(args.accessCode);
    const key = getKey();

    const prompt = args.prompt.trim();
    if (!prompt) throw new ConvexError("پرامت خالی است.");
    if (prompt.length > 1000) throw new ConvexError("پرامت خیلی طولانی است (حداکثر ۱۰۰۰ حرف).");

    const seconds = Math.min(10, Math.max(5, Math.round(args.seconds)));

    const res = await fetch(`${API}/v1/text-to-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        name: "PhotoCut promo video",
        end_seconds: seconds,
        aspect_ratio: "9:16",
        resolution: "480p",
        model: "ltx-2.5",
        audio: true,
        style: { prompt },
      }),
    });

    if (!res.ok) throw failStart(res.status, await readMessage(res));

    const data = (await res.json()) as { id: string; credits_charged: number };
    return { id: data.id, credits: data.credits_charged };
  },
});

// ───────── آپلود عکس محصول (POST /v1/files/upload-urls + PUT) ─────────
export const uploadImage = action({
  args: {
    imageBase64: v.string(),
    accessCode: v.string(),
  },
  handler: async (_ctx, args): Promise<{ filePath: string }> => {
    checkAccess(args.accessCode);
    const key = getKey();

    if (args.imageBase64.length > 8_000_000) {
      throw new ConvexError("حجم عکس خیلی زیاد است.");
    }

    const bin = atob(args.imageBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const res = await fetch(`${API}/v1/files/upload-urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ items: [{ type: "image", extension: "jpg" }] }),
    });
    if (!res.ok) throw failStart(res.status, await readMessage(res));

    const data = (await res.json()) as {
      items: { upload_url: string; file_path: string }[];
    };
    const item = data.items[0];
    if (!item) throw new ConvexError("آدرس آپلود دریافت نشد.");

    const put = await fetch(item.upload_url, { method: "PUT", body: bytes });
    if (!put.ok) {
      console.error("MagicHour upload PUT failed", put.status);
      throw new ConvexError("آپلود عکس ناموفق بود.");
    }

    return { filePath: item.file_path };
  },
});

// ───────── ساخت ویدیو از روی عکس (POST /v1/image-to-video) ─────────
export const startImageVideo = action({
  args: {
    filePath: v.string(),
    prompt: v.string(),
    seconds: v.number(),
    accessCode: v.string(),
  },
  handler: async (_ctx, args): Promise<{ id: string; credits: number }> => {
    checkAccess(args.accessCode);
    const key = getKey();

    const prompt = args.prompt.trim();
    if (!prompt) throw new ConvexError("پرامت صحنه خالی است.");
    if (prompt.length > 1000) throw new ConvexError("پرامت صحنه خیلی طولانی است.");

    const seconds = Math.min(8, Math.max(2, Math.round(args.seconds)));

    const res = await fetch(`${API}/v1/image-to-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        name: "PhotoCut story shot",
        end_seconds: seconds,
        model: "ltx-2.5",
        resolution: "480p",
        audio: false,
        style: { prompt },
        assets: { image_file_path: args.filePath },
      }),
    });

    if (!res.ok) throw failStart(res.status, await readMessage(res));

    const data = (await res.json()) as { id: string; credits_charged: number };
    return { id: data.id, credits: data.credits_charged };
  },
});

// ───────── پیگیری وضعیت (GET /v1/video-projects/{id}) ─────────
export const getVideo = action({
  args: {
    id: v.string(),
    accessCode: v.string(),
  },
  handler: async (
    _ctx,
    args
  ): Promise<{ status: string; downloadUrl: string | null; errorMessage: string | null }> => {
    checkAccess(args.accessCode);
    const key = getKey();

    const res = await fetch(`${API}/v1/video-projects/${encodeURIComponent(args.id)}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
    });

    if (!res.ok) {
      const msg = await readMessage(res);
      console.error("MagicHour status error", res.status, msg);
      throw new ConvexError("دریافت وضعیت ویدیو ناموفق بود.");
    }

    const data = (await res.json()) as {
      status: string;
      downloads?: { url: string; expires_at: string }[];
      error?: { message: string; code: string } | null;
    };

    return {
      status: data.status,
      downloadUrl: data.downloads && data.downloads.length > 0 ? data.downloads[0].url : null,
      errorMessage: data.error ? data.error.message : null,
    };
  },
});

// ───────── دریافت فایل کلیپ از طریق سرور (برای وقتی مرورگر اجازه‌ی دریافت مستقیم ندارد) ─────────
export const fetchClip = action({
  args: {
    url: v.string(),
    accessCode: v.string(),
  },
  handler: async (_ctx, args): Promise<{ base64: string; mimeType: string }> => {
    checkAccess(args.accessCode);

    let parsed: URL;
    try {
      parsed = new URL(args.url);
    } catch {
      throw new ConvexError("آدرس کلیپ نامعتبر است.");
    }
    if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("magichour.ai")) {
      throw new ConvexError("آدرس کلیپ مجاز نیست.");
    }

    const res = await fetch(parsed.toString());
    if (!res.ok) throw new ConvexError("دریافت کلیپ ناموفق بود.");

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > 12_000_000) throw new ConvexError("حجم کلیپ خیلی زیاد است.");

    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }

    return { base64: btoa(binary), mimeType: res.headers.get("content-type") || "video/mp4" };
  },
});
