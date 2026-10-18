import { useState } from "react";
import VideoMaker from "@/components/VideoMaker";
import AiVideoGenerator from "@/components/AiVideoGenerator";
import ProductStoryGenerator from "@/components/ProductStoryGenerator";

type Mode = "story" | "photo" | "ai";

export default function VideoStudio() {
  const [mode, setMode] = useState<Mode>("story");

  const btn = (active: boolean) =>
    `flex-1 px-2 py-2 rounded-lg text-xs sm:text-sm transition-all ${
      active ? "bg-purple-500 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
    }`;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex gap-2">
        <button type="button" className={btn(mode === "story")} onClick={() => setMode("story")}>
          داستان محصول (AI)
        </button>
        <button type="button" className={btn(mode === "photo")} onClick={() => setMode("photo")}>
          ساده از عکس (رایگان)
        </button>
        <button type="button" className={btn(mode === "ai")} onClick={() => setMode("ai")}>
          فقط پرامت
        </button>
      </div>

      {mode === "photo" && <VideoMaker />}
      <div className={mode === "story" ? "" : "hidden"}>
        <ProductStoryGenerator />
      </div>
      <div className={mode === "ai" ? "" : "hidden"}>
        <AiVideoGenerator />
      </div>
    </div>
  );
}
