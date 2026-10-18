import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Download, Share2, Sparkles, X, Loader2 } from "lucide-react";

const CODE_KEY = "photocut_video_access_code";

const EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: "دختر با فنجان قهوه",
    prompt:
      "A young woman in a bright cozy cafe holds a ceramic coffee mug toward the camera and smiles, soft natural window light, shallow depth of field, realistic, handheld phone video",
  },
  {
    label: "عطر لوکس",
    prompt:
      "Cinematic close-up of a luxury perfume bottle on a marble table, slow camera push-in, golden light sparkles, elegant, realistic",
  },
  {
    label: "باز کردن کفش",
    prompt:
      "A man unboxes a pair of white sneakers in a sunlit living room and shows them to the camera, vertical social media video, realistic",
  },
];

type Phase = "idle" | "starting" | "waiting" | "done" | "error";

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

export default function AiVideoGenerator() {
  const startVideo = useAction(api.aiVideo.startVideo);
  const getVideo = useAction(api.aiVideo.getVideo);

  const [prompt, setPrompt] = useState("");
  const [seconds, setSeconds] = useState(5);
  const [code, setCode] = useState(readCode);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusText, setStatusText] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [credits, setCredits] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const busy = phase === "starting" || phase === "waiting";

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  // شمارنده‌ی زمان انتظار
  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  const saveCode = (value: string) => {
    setCode(value);
    try {
      localStorage.setItem(CODE_KEY, value);
    } catch {
      /* ignore */
    }
  };

  const handleStart = async () => {
    if (busy) return;
    if (!prompt.trim()) {
      setError("ابتدا پرامت را بنویسید.");
      setPhase("error");
      return;
    }
    if (!code.trim()) {
      setError("کد دسترسی را وارد کنید.");
      setPhase("error");
      return;
    }

    cancelRef.current = false;
    setError(null);
    setVideoUrl(null);
    setCredits(null);
    setElapsed(0);
    setPhase("starting");
    setStatusText("در حال ارسال درخواست…");

    try {
      const started = await startVideo({ prompt, seconds, accessCode: code.trim() });
      setCredits(started.credits);
      setPhase("waiting");
      setStatusText("در صف ساخت…");

      // حداکثر حدود ۸ دقیقه انتظار (هر ۵ ثانیه یک بار)
      for (let i = 0; i < 96; i++) {
        await sleep(5000);
        if (cancelRef.current) return;

        const info = await getVideo({ id: started.id, accessCode: code.trim() });
        if (cancelRef.current) return;

        if (info.status === "complete" && info.downloadUrl) {
          setVideoUrl(info.downloadUrl);
          setPhase("done");
          return;
        }
        if (info.status === "error") {
          setError(info.errorMessage || "ساخت ویدیو در سرویس با خطا مواجه شد (کردیت برگردانده می‌شود).");
          setPhase("error");
          return;
        }
        if (info.status === "canceled") {
          setError("ساخت ویدیو لغو شد.");
          setPhase("error");
          return;
        }
        setStatusText(info.status === "rendering" ? "در حال ساخت ویدیو…" : "در صف ساخت…");
      }

      setError("ساخت بیش از حد طول کشید. بعداً دوباره امتحان کنید.");
      setPhase("error");
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

  const handleSave = async () => {
    if (!videoUrl) return;
    try {
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const file = new File([blob], `ai-video-${Date.now()}.mp4`, { type: blob.type || "video/mp4" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      // اگر مرورگر اجازه‌ی دریافت مستقیم نداد، لینک را باز می‌کنیم
      window.open(videoUrl, "_blank");
    }
  };

  return (
    <div dir="rtl" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Card className="p-4">
          <h4 className="font-semibold mb-3">✍️ پرامت (صحنه‌ی ویدیو را توضیح بدهید)</h4>
          <textarea
            value={prompt}
            maxLength={1000}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={busy}
            rows={6}
            placeholder="مثلاً: A young woman holds a coffee mug and smiles at the camera, soft light, realistic"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <p className="text-xs text-gray-500 mt-2 leading-5">
            اگر نتیجه با فارسی ضعیف بود، همان توضیح را انگلیسی بنویسید. نتیجه‌ی ساخته‌شده تضمین‌شده نیست و هر بار فرق می‌کند.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                disabled={busy}
                onClick={() => setPrompt(ex.prompt)}
                className="px-3 py-2 rounded-lg text-xs bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">⏱️ مدت ویدیو: {seconds} ثانیه</h4>
          <Slider value={[seconds]} onValueChange={(v: number[]) => setSeconds(v[0])} min={5} max={10} disabled={busy} />
          <p className="text-xs text-gray-500 mt-3 leading-5">
            طبق مستندات Magic Hour، هر ثانیه ۴۸۰p حدود ۲۴ کردیت مصرف می‌کند؛ یعنی این ویدیو حدود {seconds * 24} کردیت.
          </p>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🔑 کد دسترسی</h4>
          <input
            type="password"
            dir="ltr"
            value={code}
            onChange={(e) => saveCode(e.target.value)}
            disabled={busy}
            placeholder="کدی که در Convex تنظیم کرده‌اید"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <p className="text-xs text-gray-500 mt-2 leading-5">
            این کد جلوی مصرف کردیت شما توسط دیگران را می‌گیرد.
          </p>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="bg-gray-900 p-2 flex justify-center items-center min-h-[240px]">
            {videoUrl ? (
              <video
                key={videoUrl}
                src={videoUrl}
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
                    <p>{elapsed} ثانیه گذشته</p>
                    <p className="text-xs mt-2">ساخت معمولاً چند دقیقه طول می‌کشد؛ این صفحه را باز نگه دارید.</p>
                  </>
                ) : (
                  <p>ویدیوی ساخته‌شده اینجا نمایش داده می‌شود.</p>
                )}
              </div>
            )}
          </div>
        </Card>

        {credits !== null && (
          <p className="text-xs text-gray-500">کردیت مصرف‌شده‌ی این درخواست: {credits}</p>
        )}

        {error && <p className="text-sm text-red-600 leading-6">{error}</p>}

        {phase === "done" && videoUrl && (
          <>
            <div className="flex gap-3">
              <Button onClick={handleSave} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
                <Share2 className="w-4 h-4 ml-2" /> ذخیره / اشتراک
              </Button>
              <Button onClick={() => window.open(videoUrl, "_blank")} variant="outline" className="flex-1">
                <Download className="w-4 h-4 ml-2" /> باز کردن لینک
              </Button>
            </div>
            <p className="text-xs text-gray-500 leading-5">
              لینک ویدیو موقت است؛ همین الان ذخیره کنید. ویدیوهای پلن رایگان ممکن است واترمارک داشته باشند و فقط برای استفاده‌ی غیرتجاری مجازند.
            </p>
          </>
        )}

        <div className="flex gap-3">
          {busy ? (
            <Button onClick={handleCancel} variant="outline" className="flex-1">
              <X className="w-4 h-4 ml-2" /> توقف انتظار
            </Button>
          ) : (
            <Button onClick={handleStart} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
              <Sparkles className="w-4 h-4 ml-2" /> ساخت ویدیو با هوش مصنوعی
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
