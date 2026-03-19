import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "خطأ", description: "الرجاء إدخال اسم المستخدم وكلمة المرور", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const apiBase = baseUrl.replace(/\/admin-portal$/, "");
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role: "super_admin" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "فشل تسجيل الدخول");
      }

      const data = await res.json() as { token: string; user: { id: number; name: string; username: string; role: string; tenantId: number | null; tenantName: string | null; tenantSlug: string | null } };

      if (data.user.role !== "super_admin") {
        throw new Error("هذه البوابة مخصصة لمديري المنصة فقط");
      }

      login(data.token, data.user);
      toast({ title: "مرحباً بك", description: "تم تسجيل الدخول بنجاح" });
      setLocation("/dashboard");
    } catch (err) {
      toast({
        title: "فشل تسجيل الدخول",
        description: err instanceof Error ? err.message : "تأكد من صحة البيانات المدخلة",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gray-950">
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-gray-900/90 to-gray-950 z-0" />
      <div className="absolute inset-0 z-0 opacity-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent rounded-full blur-3xl" />
      </div>

      <div className="z-10 w-full max-w-[420px] p-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white drop-shadow-md">بوابة الإدارة</h1>
          <p className="text-white/60 mt-2 text-lg font-medium">LibraryOS — لوحة الإدارة العليا</p>
        </div>

        <Card className="border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/40 rounded-3xl overflow-hidden">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <p className="text-white/70 text-sm">هذه البوابة مخصصة لمديري المنصة فقط</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/80 font-bold ms-1">اسم المستخدم</Label>
                <Input
                  id="username"
                  placeholder="أدخل اسم المستخدم"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 rounded-xl px-4 text-lg"
                  dir="ltr"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80 font-bold ms-1">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 rounded-xl px-4 text-lg"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-14 text-lg font-bold rounded-xl mt-4 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "تسجيل الدخول"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
