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

// شروع ساخت ویدیو از روی پرامت (Magic Hour: POST /v1/text-to-video)
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

    // پلن رایگان: ۴۸۰p ، مدل ltx-2.5 ، عمودی ۹:۱۶ ، مدت ۵ تا ۱۰ ثانیه
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

    if (!res.ok) {
      const msg = await readMessage(res);
      console.error("MagicHour start error", res.status, msg);
      if (res.status === 401) throw new ConvexError("کلید Magic Hour معتبر نیست.");
      if (res.status === 402) throw new ConvexError("اعتبار (کردیت) Magic Hour تمام شده است.");
      if (res.status === 400 || res.status === 422) {
        throw new ConvexError(`درخواست رد شد: ${msg || "پارامترها نامعتبر است."}`);
      }
      throw new ConvexError("سرویس ساخت ویدیو خطا داد. کمی بعد دوباره امتحان کنید.");
    }

    const data = (await res.json()) as { id: string; credits_charged: number };
    return { id: data.id, credits: data.credits_charged };
  },
});

// پیگیری وضعیت (Magic Hour: GET /v1/video-projects/{id})
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
