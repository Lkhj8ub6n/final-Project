import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookOpen, Store, MonitorSmartphone, ShieldCheck, Loader2 } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"tenant_admin" | "cashier" | "super_admin">("tenant_admin");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({ title: "خطأ", description: "الرجاء إدخال اسم المستخدم وكلمة المرور", variant: "destructive" });
      return;
    }

    try {
      const response = await loginMutation.mutateAsync({
        data: { username, password, role }
      });
      
      login(response.token, response.user);
      
      // Route based on role
      if (response.user.role === 'super_admin') setLocation('/admin');
      else if (response.user.role === 'tenant_admin') setLocation('/dashboard');
      else if (response.user.role === 'cashier') setLocation('/pos/sell');
      else if (response.user.role === 'student') setLocation(`/store/${response.user.tenantSlug}`);
      
      toast({ title: "مرحباً بك", description: "تم تسجيل الدخول بنجاح" });
    } catch (error: any) {
      toast({ 
        title: "فشل تسجيل الدخول", 
        description: error.message || "تأكد من صحة البيانات المدخلة", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-gray-50">
      {/* Background Image/Pattern */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Background" 
          className="w-full h-full object-cover opacity-60 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/90 to-accent/20 mix-blend-multiply"></div>
      </div>

      <div className="z-10 w-full max-w-[420px] p-4">
        <div className="text-center mb-8 animate-in" style={{ animationDelay: '0ms' }}>
          <div className="w-20 h-20 bg-white rounded-2xl shadow-2xl shadow-black/10 flex items-center justify-center mx-auto mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white drop-shadow-md">LibraryOS</h1>
          <p className="text-white/80 mt-2 text-lg font-medium">نظام إدارة المكتبات المتكامل</p>
        </div>

        <Card className="border-0 shadow-2xl shadow-black/20 rounded-3xl overflow-hidden glass-card animate-in" style={{ animationDelay: '100ms' }}>
          <CardContent className="p-8">
            <Tabs defaultValue={role} onValueChange={(v) => setRole(v as any)} className="w-full mb-8">
              <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl h-12">
                <TabsTrigger value="tenant_admin" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm text-sm">
                  <Store className="w-4 h-4 me-1.5" />
                  المالك
                </TabsTrigger>
                <TabsTrigger value="cashier" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm text-sm">
                  <MonitorSmartphone className="w-4 h-4 me-1.5" />
                  كاشير
                </TabsTrigger>
                <TabsTrigger value="super_admin" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm text-sm">
                  <ShieldCheck className="w-4 h-4 me-1.5" />
                  إدارة
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-foreground font-bold ms-1">اسم المستخدم</Label>
                <Input 
                  id="username" 
                  placeholder="أدخل اسم المستخدم" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 bg-white border-gray-200 focus:border-primary focus:ring-primary/20 rounded-xl px-4 text-lg"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <Label htmlFor="password" className="text-foreground font-bold">كلمة المرور</Label>
                </div>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 bg-white border-gray-200 focus:border-primary focus:ring-primary/20 rounded-xl px-4 text-lg"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-bold rounded-xl mt-4 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin" /> : "تسجيل الدخول"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
