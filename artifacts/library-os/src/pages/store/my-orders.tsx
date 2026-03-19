import React, { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useStoreAuth } from "@/lib/store-auth-context";
import { Button } from "@/components/ui/button";
import type { Order } from "@workspace/api-client-react";
import {
  ArrowRight, Package, ShoppingBag, Clock,
  CheckCircle2, Truck, XCircle, RefreshCw
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const statusMap: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  new:       { label: "جديد — في الانتظار", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  preparing: { label: "قيد التجهيز", color: "bg-blue-100 text-blue-700 border-blue-200", icon: RefreshCw },
  ready:     { label: "جاهز للاستلام", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  delivered: { label: "تم التسليم", color: "bg-gray-100 text-gray-600 border-gray-200", icon: Truck },
  cancelled: { label: "ملغى", color: "bg-red-100 text-red-600 border-red-200", icon: XCircle },
};

export default function StoreMyOrders() {
  const [match, params] = useRoute("/store/:tenantSlug/my-orders");
  const [, setLocation] = useLocation();
  const tenantSlug = params?.tenantSlug || "";

  const { isAuthenticated, student, token } = useStoreAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !tenantSlug || !token) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/store/${tenantSlug}/my-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Order[]>;
      })
      .then(data => { setOrders(data); })
      .catch(err => { setError((err as Error).message); })
      .finally(() => { setIsLoading(false); });
  }, [isAuthenticated, tenantSlug, token]);

  if (!match) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full mx-4 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h2 className="text-xl font-bold mb-2">يجب تسجيل الدخول</h2>
          <p className="text-muted-foreground text-sm mb-6">سجّل دخولك لعرض طلباتك</p>
          <Button onClick={() => setLocation(`/store/${tenantSlug}`)} className="rounded-xl font-bold">
            العودة للمتجر
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setLocation(`/store/${tenantSlug}`)}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <h1 className="font-display font-bold text-lg">طلباتي</h1>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {student && (
          <p className="text-sm text-muted-foreground">مرحباً <span className="font-bold text-foreground">{student.name}</span> — إليك سجل طلباتك</p>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm font-bold">
            خطأ في تحميل الطلبات: {error}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border/50 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : !orders.length ? (
          <div className="bg-white rounded-2xl border border-border/50 p-16 text-center">
            <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-xl font-bold mb-2">لا توجد طلبات بعد</p>
            <p className="text-muted-foreground text-sm mb-6">ابدأ التسوق وستظهر طلباتك هنا</p>
            <Button onClick={() => setLocation(`/store/${tenantSlug}`)} className="rounded-xl font-bold px-8">
              تسوق الآن
            </Button>
          </div>
        ) : (
          orders.map(order => {
            const status = statusMap[order.status] ?? statusMap["new"];
            const StatusIcon = status.icon;
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                  <div>
                    <p className="font-bold text-base">طلب #{order.id}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(order.createdAt).toLocaleDateString("ar-JO", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${status.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    {status.label}
                  </span>
                </div>
                <div className="px-5 py-3 space-y-2">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.productName} × {item.quantity}</span>
                      <span className="font-bold">{item.total.toFixed(3)} د.أ</span>
                    </div>
                  ))}
                  {order.notes && (
                    <p className="text-xs text-muted-foreground border-t border-border/40 pt-2 mt-2">ملاحظة: {order.notes}</p>
                  )}
                </div>
                <div className="px-5 py-3 bg-gray-50/70 border-t border-border/40 flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-bold">الإجمالي</span>
                  <span className="font-display font-bold text-lg text-primary">{order.total.toFixed(3)} د.أ</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
