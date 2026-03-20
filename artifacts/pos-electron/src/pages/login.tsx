import React, { useEffect, useState } from "react";
import { ShoppingCart, Wifi, WifiOff } from "lucide-react";
import { useAuth } from "../lib/auth-context";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showServer, setShowServer] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getConfig("server_url").then((url) => {
        if (url) setServerUrl(url);
        else setShowServer(true);
      }).catch(() => { setShowServer(true); });
    } else {
      setShowServer(true);
      console.warn("Electron API not found. Running in web mode?");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim()) { setError("يرجى إدخال رابط الخادم"); setShowServer(true); return; }
    setLoading(true);
    setError("");
    const err = await login(username, password, serverUrl.trim());
    setLoading(false);
    if (err) { setError(err); }
    else { onLogin(); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-amber-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-teal-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-teal-500/25">
            <ShoppingCart className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 font-display">LibraryOS POS</h1>
          <p className="text-gray-500 mt-2 text-lg">تطبيق الكاشير - نظام نقاط البيع</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl shadow-teal-100/50 p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            {showServer && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700">رابط الخادم</label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://your-server.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm font-mono"
                  dir="ltr"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">اسم المستخدم</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cashier1"
                required
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg font-bold"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 text-lg"
                dir="ltr"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-teal-500 to-teal-600 text-white font-bold text-lg rounded-xl hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-teal-500/30 mt-2"
            >
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setShowServer(!showServer)}
              className="text-sm text-gray-400 hover:text-gray-600 underline"
            >
              {showServer ? "إخفاء إعدادات الخادم" : "تغيير رابط الخادم"}
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
          <WifiOff className="w-4 h-4" />
          <span>يعمل أون لاين وأوف لاين</span>
          <Wifi className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
