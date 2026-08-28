import { useState, useRef } from "react";
import { removeBackground } from "@imgly/background-removal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Download, Trash2, Loader2, Palette, Check, X, Package } from "lucide-react";
import JSZip from "jszip";

type BackgroundPreset = 
  | "white" 
  | "light-gray" 
  | "dark-gray" 
  | "studio-dark" 
  | "studio-light" 
  | "concrete-dark" 
  | "concrete-light" 
  | "gradient-warm" 
  | "gradient-cool"
  | "transparent";

interface ImageItem {
  id: string;
  name: string;
  original: string;
  processed: string | null;
  status: "pending" | "processing" | "done" | "error";
}

const backgroundPresets: { id: BackgroundPreset; name: string; preview: string }[] = [
  { id: "white", name: "سفید", preview: "bg-white" },
  { id: "light-gray", name: "خاکستری روشن", preview: "bg-gray-100" },
  { id: "dark-gray", name: "خاکستری تیره", preview: "bg-gray-700" },
  { id: "studio-dark", name: "استودیو تیره", preview: "bg-gradient-to-b from-gray-800 to-gray-900" },
  { id: "studio-light", name: "استودیو روشن", preview: "bg-gradient-to-b from-gray-100 to-gray-300" },
  { id: "concrete-dark", name: "بتن تیره", preview: "bg-gradient-to-b from-gray-600 to-gray-800" },
  { id: "concrete-light", name: "بتن روشن", preview: "bg-gradient-to-b from-gray-200 to-gray-400" },
  { id: "gradient-warm", name: "گرادیانت گرم", preview: "bg-gradient-to-br from-orange-100 to-amber-200" },
  { id: "gradient-cool", name: "گرادیانت سرد", preview: "bg-gradient-to-br from-blue-100 to-slate-200" },
  { id: "transparent", name: "شفاف", preview: "bg-gray-200" },
];

export default function BackgroundRemover() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundPreset>("white");
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: ImageItem[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const dataUrl = await readFileAsDataURL(file);
        newImages.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          original: dataUrl,
          processed: null,
          status: "pending",
        });
      } catch (error) {
        console.error("Error reading file:", file.name, error);
      }
    }

    if (newImages.length > 0) {
      setImages((prev) => {
        const updated = [...prev, ...newImages];
        if (!selectedImageId && updated.length > 0) {
          setSelectedImageId(updated[0].id);
        }
        return updated;
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          resolve(result);
        } else {
          reject(new Error("Failed to read file"));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, preset: BackgroundPreset) => {
    switch (preset) {
      case "white":
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        break;
        
      case "light-gray":
        ctx.fillStyle = "#f3f4f6";
        ctx.fillRect(0, 0, width, height);
        break;
        
      case "dark-gray":
        ctx.fillStyle = "#374151";
        ctx.fillRect(0, 0, width, height);
        break;
        
      case "studio-dark": {
        const gradDark = ctx.createRadialGradient(
          width / 2, height * 0.4, 0,
          width / 2, height * 0.4, Math.max(width, height) * 0.8
        );
        gradDark.addColorStop(0, "#4b5563");
        gradDark.addColorStop(0.6, "#374151");
        gradDark.addColorStop(1, "#1f2937");
        ctx.fillStyle = gradDark;
        ctx.fillRect(0, 0, width, height);
        break;
      }
        
      case "studio-light": {
        const gradLight = ctx.createLinearGradient(0, 0, 0, height);
        gradLight.addColorStop(0, "#f9fafb");
        gradLight.addColorStop(0.5, "#e5e7eb");
        gradLight.addColorStop(1, "#d1d5db");
        ctx.fillStyle = gradLight;
        ctx.fillRect(0, 0, width, height);
        break;
      }
        
      case "concrete-dark": {
        const gradConcrete = ctx.createLinearGradient(0, 0, 0, height);
        gradConcrete.addColorStop(0, "#6b7280");
        gradConcrete.addColorStop(0.35, "#9ca3af");
        gradConcrete.addColorStop(0.4, "#6b7280");
        gradConcrete.addColorStop(1, "#4b5563");
        ctx.fillStyle = gradConcrete;
        ctx.fillRect(0, 0, width, height);
        for (let i = 0; i < 8000; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          const alpha = Math.random() * 0.15;
          ctx.fillStyle = `rgba(0,0,0,${alpha})`;
          ctx.fillRect(x, y, 1, 1);
        }
        break;
      }
        
      case "concrete-light": {
        const gradConcreteLight = ctx.createLinearGradient(0, 0, 0, height);
        gradConcreteLight.addColorStop(0, "#e5e7eb");
        gradConcreteLight.addColorStop(0.35, "#f3f4f6");
        gradConcreteLight.addColorStop(0.4, "#d1d5db");
        gradConcreteLight.addColorStop(1, "#9ca3af");
        ctx.fillStyle = gradConcreteLight;
        ctx.fillRect(0, 0, width, height);
        for (let i = 0; i < 8000; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          const alpha = Math.random() * 0.1;
          ctx.fillStyle = `rgba(0,0,0,${alpha})`;
          ctx.fillRect(x, y, 1, 1);
        }
        break;
      }
        
      case "gradient-warm": {
        const gradWarm = ctx.createLinearGradient(0, 0, width, height);
        gradWarm.addColorStop(0, "#fff7ed");
        gradWarm.addColorStop(0.5, "#fed7aa");
        gradWarm.addColorStop(1, "#fef3c7");
        ctx.fillStyle = gradWarm;
        ctx.fillRect(0, 0, width, height);
        break;
      }
        
      case "gradient-cool": {
        const gradCool = ctx.createLinearGradient(0, 0, width, height);
        gradCool.addColorStop(0, "#dbeafe");
        gradCool.addColorStop(0.5, "#e2e8f0");
        gradCool.addColorStop(1, "#f1f5f9");
        ctx.fillStyle = gradCool;
        ctx.fillRect(0, 0, width, height);
        break;
      }
        
      case "transparent": {
        const size = 10;
        for (let y = 0; y < height; y += size) {
          for (let x = 0; x < width; x += size) {
            ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? "#ffffff" : "#e5e7eb";
            ctx.fillRect(x, y, size, size);
          }
        }
        break;
      }
    }
  };

  const processImage = async (imageItem: ImageItem): Promise<string | null> => {
    try {
      const response = await fetch(imageItem.original);
      const blob = await response.blob();
      
      const resultBlob = await removeBackground(blob, {
        progress: (key: string, current: number, total: number) => {
          console.log(`${key}: ${Math.round(current / total * 100)}%`);
        }
      });
      
      const img = new window.Image();
      const url = URL.createObjectURL(resultBlob);
      
      return new Promise((resolve) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawBackground(ctx, canvas.width, canvas.height, selectedBackground);
          ctx.drawImage(img, 0, 0);
          
          const result = canvas.toDataURL("image/png", 1.0);
          URL.revokeObjectURL(url);
          resolve(result);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });
    } catch (error) {
      console.error("Error processing image:", error);
      return null;
    }
  };

  const handleProcessSingle = async (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image || isProcessing) return;

    setIsProcessing(true);
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, status: "processing" } : img))
    );

    const result = await processImage(image);

    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, processed: result, status: result ? "done" : "error" }
          : img
      )
    );

    setIsProcessing(false);
  };

  const handleProcessAll = async () => {
    const pendingImages = images.filter((img) => img.status === "pending" || img.status === "error");
    if (pendingImages.length === 0 || isBatchProcessing) return;

    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: pendingImages.length });

    for (let i = 0; i < pendingImages.length; i++) {
      const image = pendingImages[i];
      setBatchProgress({ current: i + 1, total: pendingImages.length });
      
      setImages((prev) =>
        prev.map((img) => (img.id === image.id ? { ...img, status: "processing" } : img))
      );

      const result = await processImage(image);

      setImages((prev) =>
        prev.map((img) =>
          img.id === image.id
            ? { ...img, processed: result, status: result ? "done" : "error" }
            : img
        )
      );
    }

    setIsBatchProcessing(false);
    setBatchProgress({ current: 0, total: 0 });
  };

  const handleDownloadSingle = (image: ImageItem) => {
    const imageToDownload = image.processed || image.original;
    if (!imageToDownload) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      const newWindow = window.open("", "_blank");
      if (newWindow) {
        newWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>PhotoCut</title>
            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
            <style>
              body { margin: 0; padding: 10px; background: #f5f5f5; display: flex; flex-direction: column; align-items: center; font-family: -apple-system, sans-serif; }
              img { max-width: 100%; height: auto; border-radius: 8px; }
              .tip { background: #e8f5e9; padding: 10px 15px; border-radius: 8px; margin-top: 10px; color: #2e7d32; }
            </style>
          </head>
          <body>
            <img src="${imageToDownload}" alt="${image.name}" />
            <div class="tip">💡 انگشتتون رو روی عکس نگه دارید → "ذخیره در تصاویر"</div>
          </body>
          </html>
        `);
        newWindow.document.close();
      }
    } else {
      const link = document.createElement("a");
      link.download = `product-${image.name}`;
      link.href = imageToDownload;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
const handleDownloadAllIndividually = async () => {
  const processedImages = images.filter((img) => img.status === "done");
  if (processedImages.length === 0) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (navigator.share && navigator.canShare) {
    try {
      const files = await Promise.all(
        processedImages.map(async (img, index) => {
          const response = await fetch(img.processed!);
          const blob = await response.blob();
          return new File([blob], `product-${index + 1}-${img.name}`, { type: "image/png" });
        })
      );

      if (navigator.canShare({ files })) {
        await navigator.share({ files });
        return;
      }
    } catch (error) {
      console.error("Share failed, falling back:", error);
    }
  }

  if (isIOS) {
    const imagesHtml = processedImages
      .map(
        (img) => `
        <div class="photo-block">
          <img src="${img.processed}" alt="${img.name}" />
        </div>
      `
      )
      .join("");

    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>PhotoCut - ذخیره همه</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { margin: 0; padding: 10px; background: #f5f5f5; font-family: -apple-system, sans-serif; }
            .tip { background: #e8f5e9; padding: 12px 15px; border-radius: 8px; margin-bottom: 15px; color: #2e7d32; text-align: center; position: sticky; top: 0; }
            .photo-block { margin-bottom: 20px; text-align: center; }
            .photo-block img { max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          </style>
        </head>
        <body>
          <div class="tip">💡 روی هر عکس انگشتتون رو نگه دارید → ذخیره در تصاویر</div>
          ${imagesHtml}
        </body>
        </html>
      `);
      newWindow.document.close();
    }
  } else {
    processedImages.forEach((image, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.download = `product-${image.name}`;
        link.href = image.processed!;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 500);
    });
  }
};


  const handleDownloadAll = async () => {
    const processedImages = images.filter((img) => img.status === "done");
    if (processedImages.length === 0) return;

    const zip = new JSZip();
    
    processedImages.forEach((image, index) => {
      const base64Data = image.processed?.split(",")[1];
      if (base64Data) {
        const fileName = `product-${index + 1}-${image.name.replace(/\.[^/.]+$/, "")}.png`;
        zip.file(fileName, base64Data, { base64: true });
      }
    });

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.download = `product-photos-${Date.now()}.zip`;
    link.href = URL.createObjectURL(content);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const handleRemoveImage = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
  };

  const handleClearAll = () => {
    setImages([]);
    setSelectedImageId(null);
  };

  const selectedImage = images.find((img) => img.id === selectedImageId);
  const doneCount = images.filter((img) => img.status === "done").length;
  const pendingCount = images.filter((img) => img.status === "pending" || img.status === "error").length;

  return (
    <div className="space-y-6">
      <div 
        className="border-2 border-dashed border-purple-300 rounded-2xl p-8 text-center hover:border-purple-500 transition-colors cursor-pointer bg-purple-50/50"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto text-purple-400 mb-3" />
        <h3 className="text-lg font-semibold text-gray-800 mb-1">چند عکس همزمان آپلود کنید</h3>
        <p className="text-gray-500 text-sm">روی این ناحیه بزنید و چند عکس انتخاب کنید</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple={true}
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-purple-600" />
            <span className="font-medium">{images.length} عکس</span>
            {doneCount > 0 && <span className="text-green-600">✓ {doneCount} آماده</span>}
            {pendingCount > 0 && <span className="text-orange-600">⏳ {pendingCount} در انتظار</span>}
          </div>
          
          <div className="flex-1" />
          
          {isBatchProcessing && (
            <div className="text-sm text-purple-600">
              <Loader2 className="w-4 h-4 animate-spin inline ml-1" />
              {batchProgress.current}/{batchProgress.total}
            </div>
          )}
          
          <Button
            onClick={handleProcessAll}
            disabled={isBatchProcessing || pendingCount === 0}
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            {isBatchProcessing ? (
              <>
                <Loader2 className="w-4 h-4 ml-1 animate-spin" />
                در حال پردازش...
              </>
            ) : (
              <>🔄 پردازش همه ({pendingCount})</>
            )}
          </Button>
          
          {doneCount > 0 && (
            <Button onClick={handleDownloadAll} size="sm" variant="outline">
              <Package className="w-4 h-4 ml-1" />
              دانلود همه (ZIP)
            </Button>
          )}
                    {doneCount > 0 && (
            <Button onClick={handleDownloadAllIndividually} size="sm" variant="outline">
              <Download className="w-4 h-4 ml-1" />
              ذخیره همه در گالری
            </Button>
          )}

          <Button onClick={handleClearAll} size="sm" variant="ghost">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            <h4 className="font-semibold text-gray-700 text-sm">لیست عکس‌ها:</h4>
            {images.map((image) => (
              <div
                key={image.id}
                onClick={() => setSelectedImageId(image.id)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                  selectedImageId === image.id 
                    ? "bg-purple-100 border-2 border-purple-400" 
                    : "bg-white border-2 border-transparent hover:bg-gray-50"
                }`}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img src={image.processed || image.original} alt={image.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{image.name}</p>
                  <p className="text-xs text-gray-500">
                    {image.status === "pending" && "⏳ در انتظار"}
                    {image.status === "processing" && "🔄 در حال پردازش..."}
                    {image.status === "done" && "✅ آماده"}
                    {image.status === "error" && "❌ خطا"}
                  </p>
                </div>
                <div className="flex gap-1">
                  {image.status === "done" && (
                    <Button onClick={(e) => { e.stopPropagation(); handleDownloadSingle(image); }} size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <Button onClick={(e) => { e.stopPropagation(); handleRemoveImage(image.id); }} size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {selectedImage ? (
              <>
                <Card className="overflow-hidden">
                  <div className="bg-gray-100 flex items-center justify-center p-2" style={{ minHeight: "300px", maxHeight: "500px" }}>
                    <img src={selectedImage.processed || selectedImage.original} alt={selectedImage.name} className="w-full h-auto max-h-[450px] object-contain" />
                  </div>
                </Card>
                <div className="flex gap-3">
                  <Button onClick={() => handleProcessSingle(selectedImage.id)} disabled={isProcessing || selectedImage.status === "processing"} className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600">
                    {selectedImage.status === "processing" ? (
                      <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> در حال پردازش...</>
                    ) : selectedImage.status === "done" ? (
                      <><Check className="w-4 h-4 ml-2" /> پردازش شده ✓</>
                    ) : (
                      <><Trash2 className="w-4 h-4 ml-2" /> حذف پس‌زمینه</>
                    )}
                  </Button>
                  <Button onClick={() => handleDownloadSingle(selectedImage)} disabled={selectedImage.status !== "done"} variant="outline" className="flex-1">
                    <Download className="w-4 h-4 ml-2" /> دانلود
                  </Button>
                </div>
              </>
            ) : (
              <Card className="p-12 text-center text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>از لیست سمت راست یک عکس انتخاب کنید</p>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
              <Palette className="w-5 h-5 text-purple-600" />
              پس‌زمینه
            </div>
            <div className="grid grid-cols-2 gap-2">
              {backgroundPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedBackground(preset.id)}
                  className={`relative p-3 rounded-lg border-2 transition-all text-right ${
                    selectedBackground === preset.id 
                      ? 'border-purple-500 ring-2 ring-purple-200 bg-purple-50' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`w-full h-8 rounded mb-1 ${preset.preview}`} />
                  <span className="text-xs font-medium text-gray-700">{preset.name}</span>
                  {selectedBackground === preset.id && (
                    <div className="absolute top-1 left-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
