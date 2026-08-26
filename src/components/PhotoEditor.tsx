import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Upload, Download, RotateCcw, RotateCw, FlipHorizontal, Trash2 } from "lucide-react";

export default function PhotoEditor() {
  const [image, setImage] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [activeFilter, setActiveFilter] = useState("original");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filters = [
    { id: "original", name: "اصلی", css: "" },
    { id: "grayscale", name: "سیاه سفید", css: "grayscale(100%)" },
    { id: "sepia", name: "سپیا", css: "sepia(80%)" },
    { id: "vintage", name: "وینتیج", css: "sepia(40%) contrast(90%)" },
    { id: "dramatic", name: "دراماتیک", css: "contrast(150%) saturate(70%)" },
    { id: "fade", name: "فید", css: "contrast(80%) brightness(110%)" },
    { id: "vivid", name: "ویوید", css: "saturate(150%) contrast(110%)" },
    { id: "cool", name: "سرد", css: "hue-rotate(20deg) saturate(110%)" },
    { id: "warm", name: "گرم", css: "hue-rotate(-20deg) saturate(110%)" },
  ];

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setBrightness(100);
        setContrast(100);
        setSaturation(100);
        setRotation(0);
        setFlipH(false);
        setActiveFilter("original");
      };
      reader.readAsDataURL(file);
    }
  };

  const getFilterCSS = () => {
    const baseFilter = filters.find(f => f.id === activeFilter)?.css || "";
    return `${baseFilter} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`.trim();
  };

  const handleDownload = () => {
    if (!image) return;
    
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      
      ctx.filter = getFilterCSS();
      
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      
      ctx.drawImage(img, 0, 0);
      
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          const dataUrl = canvas.toDataURL("image/png");
          newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>PhotoCut</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { margin: 0; padding: 10px; background: #f5f5f5; display: flex; flex-direction: column; align-items: center; }
                img { max-width: 100%; border-radius: 8px; }
                .tip { background: #e8f5e9; padding: 10px; border-radius: 8px; margin-top: 10px; color: #2e7d32; }
              </style>
            </head>
            <body>
              <img src="${dataUrl}" />
              <div class="tip">💡 انگشتتون رو نگه دارید → ذخیره در تصاویر</div>
            </body>
            </html>
          `);
          newWindow.document.close();
        }
      } else {
        const link = document.createElement("a");
        link.download = `edited-photo-${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }
    };
    img.src = image;
  };

  const handleClear = () => {
    setImage(null);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setRotation(0);
    setFlipH(false);
    setActiveFilter("original");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!image) {
    return (
      <div 
        className="border-2 border-dashed border-purple-300 rounded-2xl p-12 text-center hover:border-purple-500 transition-colors cursor-pointer bg-purple-50/50 h-full flex flex-col items-center justify-center"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-16 h-16 mx-auto text-purple-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-800 mb-2">عکس رو آپلود کنید</h3>
        <p className="text-gray-500">فایل‌های PNG، JPG، WEBP پشتیبانی میشن</p>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="bg-gray-100 p-2">
            <img
              src={image}
              alt="Editing"
              className="w-full h-auto max-h-[400px] object-contain"
              style={{ filter: getFilterCSS(), transform: `rotate(${rotation}deg) ${flipH ? "scaleX(-1)" : ""}` }}
            />
          </div>
        </Card>
        <div className="flex gap-3">
          <Button onClick={handleDownload} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
            <Download className="w-4 h-4 ml-2" /> دانلود
          </Button>
          <Button onClick={handleClear} variant="outline">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <h4 className="font-semibold mb-3">⚙️ تنظیمات</h4>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">روشنایی: {brightness}%</label>
              <Slider value={[brightness]} onValueChange={(v) => setBrightness(v[0])} min={0} max={200} />
            </div>
            <div>
              <label className="text-sm text-gray-600">کنتراست: {contrast}%</label>
              <Slider value={[contrast]} onValueChange={(v) => setContrast(v[0])} min={0} max={200} />
            </div>
            <div>
              <label className="text-sm text-gray-600">اشباع رنگ: {saturation}%</label>
              <Slider value={[saturation]} onValueChange={(v) => setSaturation(v[0])} min={0} max={200} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🔄 چرخش و قرینه</h4>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setRotation(r => r - 90)}>
              <RotateCcw className="w-4 h-4 ml-1" /> چپ
            </Button>
            <Button variant="outline" onClick={() => setRotation(r => r + 90)}>
              <RotateCw className="w-4 h-4 ml-1" /> راست
            </Button>
            <Button variant="outline" onClick={() => setFlipH(f => !f)}>
              <FlipHorizontal className="w-4 h-4 ml-1" /> قرینه
            </Button>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-semibold mb-3">🎨 فیلترها</h4>
          <div className="grid grid-cols-3 gap-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`p-2 rounded-lg text-sm transition-all ${
                  activeFilter === filter.id
                    ? "bg-purple-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {filter.name}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
