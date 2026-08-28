import { useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sparkles, Mail, ArrowRight } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const signIn = useAction(api.users.signIn);
  
  const verifyCode = useMutation(api.users.verifyCode);
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    
    setIsLoading(true);
    try {
      const result = await verifyCode({ email, code });
      localStorage.setItem("authToken", result.token);
      const from = (location.state as any)?.from?.pathname || "/dashboard";
      navigate(from);
    } catch (error) {
      console.error(error);
    }
    setIsLoading(false);
  };

 const handleCodeSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!code) return;
  
  setIsLoading(true);
  try {
    const result = await verifyCode({ email, code });
    localStorage.setItem("authToken", result.token);
    localStorage.setItem("authEmail", email);
    const from = (location.state as any)?.from?.pathname || "/dashboard";
    navigate(from);
  } catch (error) {
    console.error(error);
  }
  setIsLoading(false);
};
 
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ورود به PhotoCut</h1>
          <p className="text-gray-500 mt-2">حساب کاربری ندارید؟ خودکار ساخته میشه!</p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ایمیل خود را وارد کنید
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-10"
                  dir="ltr"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              disabled={isLoading || !email}
            >
              {isLoading ? "در حال ارسال..." : "ارسال کد تایید"}
              <ArrowRight className="w-4 h-4 mr-2" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                کد ۶ رقمی ارسال شده به {email}
              </label>
              <Input
                type="text"
                placeholder="۱۲۳۴۵۶"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={6}
                className="text-center text-2xl tracking-widest"
                dir="ltr"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
              disabled={isLoading || code.length < 6}
            >
              {isLoading ? "در حال تایید..." : "تایید و ورود"}
            </Button>
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full"
              onClick={() => setStep("email")}
            >
              تغییر ایمیل
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
