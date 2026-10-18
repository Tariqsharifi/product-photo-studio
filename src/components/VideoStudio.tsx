import { useState } from "react";
import VideoMaker from "@/components/VideoMaker";
import AiVideoGenerator from "@/components/AiVideoGenerator";

export default function VideoStudio() {
  const [mode, setMode] = useState<"photo" | "ai">("photo");

  const btn = (active: boolean) =>
    `flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
      active ? "bg-purple-500 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"
    }`;

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex gap-2">
        <button type="button" className={btn(mode === "photo")} onClick={() => setMode("photo")}>
          از روی عکس (رایگان)
        </button>
        <button type="button" className={btn(mode === "ai")} onClick={() => setMode("ai")}>
          با پرامت (هوش مصنوعی)
        </button>
      </div>

      {mode === "photo" && <VideoMaker />}
      <div className={mode === "ai" ? "" : "hidden"}>
        <AiVideoGenerator />
      </div>
    </div>
  );
}
