import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/use-auth";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const debugToken = localStorage.getItem("authToken");

  if (isLoading) {

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

    if (!isAuthenticated) {
    return (
      <div style={{ padding: 20, fontSize: 14, wordBreak: "break-all" }}>
        <p>⚠️ توکن پیدا نشد یا کاربر تایید نشد</p>
        <p>مقدار توکن توی حافظه: {debugToken ? debugToken : "❌ خالیه (چیزی ذخیره نشده)"}</p>
        <button onClick={() => (window.location.href = "/product-photo-studio/auth")} style={{ marginTop: 10, padding: "8px 16px" }}>
          برو صفحه ورود
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
