import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Image, Wand2, Download, Star, Check } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800">PhotoCut</span>
          </div>
          <div className="flex gap-3">
            <Link to="/auth">
              <Button variant="ghost">ورود</Button>
            </Link>
            <Link to="/auth">
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                شروع رایگان
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Star className="w-4 h-4" />
            رایگان و بدون محدودیت
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            حذف پس‌زمینه عکس
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              {" "}با هوش مصنوعی
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            عکس‌های محصولات فروشگاهتون رو حرفه‌ای کنید. پس‌زمینه رو حذف کنید و پس‌زمینه جدید بذارید.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 text-lg px-8 py-6">
                <Wand2 className="w-5 h-5 ml-2" />
                همین الان شروع کنید
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">چرا PhotoCut؟</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">هوش مصنوعی رایگان</h3>
            <p className="text-gray-600">بدون نیاز به API key، پس‌زمینه عکس‌ها رو خودکار حذف کنید</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mb-4">
              <Image className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">پس‌زمینه حرفه‌ای</h3>
            <p className="text-gray-600">۱۰ نوع پس‌زمینه استودیویی برای محصولات فروشگاهی</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl font-bold mb-2">پردازش گروهی</h3>
            <p className="text-gray-600">چند عکس رو همزمان پردازش کنید و در وقت صرفه‌جویی کنید</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16 bg-gray-50 rounded-3xl">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">چطور کار میکنه؟</h2>
        <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { step: "۱", title: "عکس رو آپلود کنید", desc: "عکس محصولتون رو انتخاب کنید" },
            { step: "۲", title: "پس‌زمینه رو حذف کنید", desc: "با یک کلیک پس‌زمینه حذف میشه" },
            { step: "۳", title: "پس‌زمینه جدید انتخاب کنید", desc: "از ۱۰ پس‌زمینه حرفه‌ای یکی رو انتخاب کنید" },
            { step: "۴", title: "دانلود کنید", desc: "عکس آماده رو ذخیره کنید" },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-bold mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">همین الان شروع کنید!</h2>
          <p className="text-lg mb-8 opacity-90">رایگان ثبت نام کنید و عکس‌های فروشگاهتون رو حرفه‌ای کنید</p>
          <Link to="/auth">
            <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100 text-lg px-8 py-6">
              شروع رایگان
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-gray-500">
        <p>© 2024 PhotoCut. تمامی حقوق محفوظ است.</p>
      </footer>
    </div>
  );
}
