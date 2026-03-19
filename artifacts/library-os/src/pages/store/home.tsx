import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useListStoreProducts, useRegisterStudent, useLogin, LoginRequestRole } from "@workspace/api-client-react";
import { useStoreAuth } from "@/lib/store-auth-context";
import { useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Search, ShoppingCart, BookOpen, MapPin, Phone,
  Plus, LogIn, LogOut, User, Package, ShoppingBag,
  Loader2, CheckCircle2
} from "lucide-react";

const categoryEmojis: Record<string, string> = {
  قرطاسية: "✏️", دوسيات: "📚", كتب: "📘", بطاقات: "💳", ألعاب: "🎲",
  أدوات: "🖊️", حقائب: "🎒", default: "📦",
};

export default function StoreHome() {
  const [match, params] = useRoute("/store/:tenantSlug");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tenantSlug = params?.tenantSlug || "";

  const { student, login: storeLogin, logout: storeLogout, isAuthenticated } = useStoreAuth();
  const { addItem, totalItems } = useCart();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [tenantName, setTenantName] = useState("المكتبة");

  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [regForm, setRegForm] = useState({ fullName: "", phone: "", password: "", confirmPassword: "" });

  const loginMutation = useLogin();
  const registerMutation = useRegisterStudent();

  const { data: products, isLoading } = useListStoreProducts(tenantSlug, {
    search: searchQuery || undefined,
    category: activeCategory || undefined,
  });

  useEffect(() => {
    if (!tenantSlug) return;
    fetch(`/api/store/${tenantSlug}/info`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.name) setTenantName(d.name); })
      .catch(() => {});
  }, [tenantSlug]);

  const categories = products
    ? [...new Set(products.map(p => p.category))].sort()
    : [];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.phone || !loginForm.password) return;
    try {
      const res = await loginMutation.mutateAsync({
        data: { username: loginForm.phone, password: loginForm.password, role: LoginRequestRole.student },
      });
      storeLogin(res.token, res.user as any);
      toast({ title: `مرحباً ${res.user.name}` });
      setAuthMode(null);
      setLoginForm({ phone: "", password: "" });
    } catch (e: any) {
      toast({ title: "فشل تسجيل الدخول", description: "تأكد من رقم الهاتف وكلمة المرور", variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regForm.password !== regForm.confirmPassword) {
      toast({ title: "خطأ", description: "كلمتا المرور غير متطابقتين", variant: "destructive" });
      return;
    }
    try {
      const res = await registerMutation.mutateAsync({
        data: { fullName: regForm.fullName, phone: regForm.phone, password: regForm.password, tenantSlug },
      });
      storeLogin(res.token, res.user as any);
      toast({ title: "تم إنشاء الحساب", description: `مرحباً ${res.user.name}!` });
      setAuthMode(null);
      setRegForm({ fullName: "", phone: "", password: "", confirmPassword: "" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleAddToCart = (product: any) => {
    if (!isAuthenticated) {
      toast({ title: "يجب تسجيل الدخول أولاً", description: "سجّل دخولك لإضافة منتجات للسلة" });
      setAuthMode("login");
      return;
    }
    addItem(product);
    toast({ title: "تمت الإضافة للسلة", description: product.name });
  };

  if (!match) return null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center text-white shadow-md shadow-primary/20">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-display font-bold text-lg leading-tight">{tenantName}</h1>
                <p className="text-xs text-primary font-bold leading-none">متجر إلكتروني</p>
              </div>
            </div>

            <div className="flex-1 max-w-lg relative">
              <Input
                placeholder="ابحث عن منتج..."
                className="h-10 rounded-full bg-gray-100 border-transparent focus:bg-white focus:border-primary pe-10"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAuthenticated ? (
                <>
                  <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2 font-bold text-sm rounded-full" onClick={() => setLocation(`/store/${tenantSlug}/my-orders`)}>
                    <Package className="w-4 h-4" /> طلباتي
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground" onClick={() => { storeLogout(); toast({ title: "تم تسجيل الخروج" }); }}>
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full font-bold" onClick={() => setAuthMode("login")}>
                  <LogIn className="w-4 h-4 me-1" /> دخول
                </Button>
              )}

              <Button
                size="sm"
                className="rounded-full font-bold shadow-md shadow-primary/20 relative"
                onClick={() => setLocation(`/store/${tenantSlug}/cart`)}
              >
                <ShoppingCart className="w-4 h-4 me-1" />
                <span className="hidden sm:inline">السلة</span>
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-white">
                    {totalItems}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Student welcome bar */}
        {isAuthenticated && (
          <div className="bg-primary/5 border-b border-primary/10 px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-primary" />
              <span className="font-bold text-primary">مرحباً {student?.name}</span>
              <span className="text-muted-foreground">— يمكنك الآن إضافة المنتجات لسلتك وإتمام الطلب</span>
            </div>
          </div>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <section className="py-6 bg-white border-b border-border/40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-all ${!activeCategory ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-gray-100 text-muted-foreground hover:bg-gray-200"}`}
                >
                  الكل
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                    className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${activeCategory === cat ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-gray-100 text-muted-foreground hover:bg-gray-200"}`}
                  >
                    <span>{categoryEmojis[cat] || categoryEmojis.default}</span>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Products Grid */}
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {searchQuery || activeCategory ? (
              <p className="text-sm text-muted-foreground mb-4">
                {products?.length} نتيجة {activeCategory ? `في "${activeCategory}"` : ""} {searchQuery ? `لـ "${searchQuery}"` : ""}
              </p>
            ) : (
              <h3 className="text-xl font-display font-bold mb-4">جميع المنتجات</h3>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array(10).fill(0).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl p-4 h-64 animate-pulse border border-gray-100">
                    <div className="w-full h-28 bg-gray-200 rounded-xl mb-3" />
                    <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
                    <div className="h-8 bg-gray-200 rounded-lg w-full" />
                  </div>
                ))}
              </div>
            ) : !products?.length ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-lg font-bold">لا توجد منتجات</p>
                <p className="text-sm mt-1">جرّب تغيير كلمة البحث أو الفئة</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {products.map(product => (
                  <div key={product.id} className="bg-white rounded-2xl border border-border/60 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 group flex flex-col overflow-hidden">
                    <div className="aspect-square bg-gray-50 flex items-center justify-center text-4xl border-b border-border/40 group-hover:bg-primary/5 transition-colors">
                      {categoryEmojis[product.category] || categoryEmojis.default}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <p className="text-xs text-muted-foreground font-bold mb-1">{product.category}</p>
                      <h4 className="font-bold text-sm leading-tight line-clamp-2 flex-1 mb-2">{product.name}</h4>
                      <div className="flex items-center justify-between mt-auto">
                        <div>
                          {product.discountedPrice ? (
                            <div>
                              <p className="text-xs text-muted-foreground line-through">{product.price.toFixed(3)}</p>
                              <p className="font-display font-bold text-base text-destructive">{product.discountedPrice.toFixed(3)} د.أ</p>
                            </div>
                          ) : (
                            <p className="font-display font-bold text-base text-primary">{product.price.toFixed(3)} د.أ</p>
                          )}
                        </div>
                        <Button
                          size="icon"
                          className="w-8 h-8 rounded-full shadow-sm shadow-primary/20"
                          disabled={!product.isAvailable}
                          onClick={() => handleAddToCart(product)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {!product.isAvailable && (
                        <p className="text-xs text-destructive font-bold mt-1">نفذ المخزون</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="bg-foreground text-white/70 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-white">{tenantName}</span>
          </div>
          <p className="text-sm text-white/40">مدعوم بواسطة <span className="text-white font-bold">LibraryOS</span></p>
        </div>
      </footer>

      {/* Auth Modal */}
      <Dialog open={authMode !== null} onOpenChange={o => !o && setAuthMode(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {authMode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
            </DialogTitle>
          </DialogHeader>

          {authMode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="font-bold">رقم الهاتف</Label>
                <Input
                  placeholder="07XXXXXXXX" dir="ltr"
                  value={loginForm.phone} onChange={e => setLoginForm({ ...loginForm, phone: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">كلمة المرور</Label>
                <Input
                  type="password" placeholder="••••••••"
                  value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <Button type="submit" className="w-full h-12 font-bold rounded-xl" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "دخول"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ليس لديك حساب؟{" "}
                <button type="button" className="text-primary font-bold" onClick={() => setAuthMode("register")}>إنشاء حساب</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="font-bold">الاسم الكامل</Label>
                <Input
                  placeholder="محمد أحمد"
                  value={regForm.fullName} onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">رقم الهاتف</Label>
                <Input
                  placeholder="07XXXXXXXX" dir="ltr"
                  value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-bold">كلمة المرور</Label>
                  <Input
                    type="password" placeholder="••••••••"
                    value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold">تأكيد المرور</Label>
                  <Input
                    type="password" placeholder="••••••••"
                    value={regForm.confirmPassword} onChange={e => setRegForm({ ...regForm, confirmPassword: e.target.value })}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 font-bold rounded-xl" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "إنشاء الحساب"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                لديك حساب بالفعل؟{" "}
                <button type="button" className="text-primary font-bold" onClick={() => setAuthMode("login")}>تسجيل الدخول</button>
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
