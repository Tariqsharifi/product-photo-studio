import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, X, Smartphone, Monitor } from "lucide-react";

export default function InstallGuide() {
  const [showGuide, setShowGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setIsAndroid(/Android/.test(userAgent));
  }, []);

  return (
    <>
      <Button
        onClick={() => setShowGuide(true)}
        className="fixed bottom-4 left-4 z-50 bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg"
        size="lg"
      >
        <Download className="w-5 h-5 ml-2" />
        نصب اپلیکیشن
      </Button>

      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">📱 نصب PhotoCut</h2>
                <Button onClick={() => setShowGuide(false)} variant="ghost" size="icon">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {isIOS ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Smartphone className="w-8 h-8 text-blue-600" />
                    <h3 className="text-lg font-semibold">آیفون و آیپد</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">۱</span>
                      <p>دکمه <strong>Share</strong> در پایین Safari رو بزنید</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">۲</span>
                      <p><strong>"Add to Home Screen"</strong> رو انتخاب کنید</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">۳</span>
                      <p>دکمه <strong>"Add"</strong> رو بزنید</p>
                    </div>
                  </div>
                </div>
              ) : isAndroid ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Smartphone className="w-8 h-8 text-green-600" />
                    <h3 className="text-lg font-semibold">اندروید</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">۱</span>
                      <p>منوی سه نقطه (⋮) در Chrome رو بزنید</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">۲</span>
                      <p><strong>"Install App"</strong> رو انتخاب کنید</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">۳</span>
                      <p>دکمه <strong>"Install"</strong> رو بزنید</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Monitor className="w-8 h-8 text-purple-600" />
                    <h3 className="text-lg font-semibold">کامپیوتر</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex gap-3">
                      <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">۱</span>
                      <p>روی آیکون قفل در نوار آدرس بزنید</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">۲</span>
                      <p><strong>"Install PhotoCut"</strong> رو انتخاب کنید</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t">
                <p className="text-sm text-gray-600 mb-3">یا لینک رو به دوستانتون بفرستید:</p>
                <div className="flex gap-2">
                  <input type="text" value={window.location.href} readOnly className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50" />
                  <Button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("کپی شد! ✅"); }} variant="outline" size="sm">کپی</Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
