import React, { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { useStoreAuth } from "@/lib/store-auth-context";
import { useCreateStoreOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingCart, ArrowRight, Trash2, Plus, Minus,
  BookOpen, CheckCircle2, Loader2, Package
} from "lucide-react";

export default function StoreCart() {
  const [match, params] = useRoute("/store/:tenantSlug/cart");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const tenantSlug = params?.tenantSlug || "";

  const { items, tenantSlug: cartSlug, removeItem, updateQuantity, clearCart, totalPrice } = useCart();
  const { isAuthenticated } = useStoreAuth();
  const createOrderMutation = useCreateStoreOrder();

  const [notes, setNotes] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (cartSlug !== null && cartSlug !== tenantSlug) {
      clearCart();
    }
  }, [tenantSlug, cartSlug, clearCart]);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast({ title: "يجب تسجيل الدخول أولاً", variant: "destructive" });
      setLocation(`/store/${tenantSlug}`);
      return;
    }
    if (!items.length) return;

    try {
      const order = await createOrderMutation.mutateAsync({
        tenantSlug,
        data: {
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          notes: notes || undefined,
        },
      });
      setOrderId(order.id);
      setIsSuccess(true);
      clearCart();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
      toast({ title: "خطأ في إرسال الطلب", description: msg, variant: "destructive" });
    }
  };

  if (!match) return null;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" dir="rtl">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">تم استلام طلبك!</h2>
          <p className="text-muted-foreground mb-2">رقم الطلب: <span className="font-bold text-foreground">#{orderId}</span></p>
          <p className="text-sm text-muted-foreground mb-8">ستتواصل معك المكتبة عند جاهزية طلبك. يمكنك متابعة حالة طلبك من صفحة "طلباتي".</p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => setLocation(`/store/${tenantSlug}/my-orders`)} className="rounded-xl font-bold h-12">
              <Package className="w-4 h-4 me-2" /> متابعة طلباتي
            </Button>
            <Button variant="outline" onClick={() => setLocation(`/store/${tenantSlug}`)} className="rounded-xl font-bold h-12">
              العودة للتسوق
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setLocation(`/store/${tenantSlug}`)}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h1 className="font-display font-bold text-lg">سلة التسوق</h1>
            {items.length > 0 && (
              <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{items.length}</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {!items.length ? (
          <div className="bg-white rounded-2xl border border-border/50 p-16 text-center">
            <ShoppingCart className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-xl font-bold mb-2">السلة فارغة</p>
            <p className="text-muted-foreground text-sm mb-6">أضف منتجات للمتابعة</p>
            <Button onClick={() => setLocation(`/store/${tenantSlug}`)} className="rounded-xl font-bold px-8">
              تصفح المنتجات
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Items */}
            <div className="bg-white rounded-2xl border border-border/50 overflow-hidden">
              <div className="divide-y divide-border/40">
                {items.map(item => (
                  <div key={item.productId} className="flex items-center gap-4 p-4">
                    <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center text-2xl border border-gray-100 shrink-0">
                      📦
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm line-clamp-1">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                      <p className="font-bold text-primary text-sm mt-1">{item.price.toFixed(3)} د.أ</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline" size="icon" className="w-8 h-8 rounded-lg"
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <Button
                        variant="outline" size="icon" className="w-8 h-8 rounded-lg"
                        disabled={item.quantity >= item.stockQuantity}
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        title={item.quantity >= item.stockQuantity ? `الحد الأقصى المتاح: ${item.stockQuantity}` : undefined}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="shrink-0 text-left w-20">
                      <p className="font-bold text-sm">{(item.price * item.quantity).toFixed(3)} د.أ</p>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => removeItem(item.productId)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-border/50 p-4">
              <Label className="font-bold text-sm mb-2 block">ملاحظات للمكتبة (اختياري)</Label>
              <Input
                placeholder="أي ملاحظات أو تعليمات خاصة..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="rounded-xl"
              />
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl border border-border/50 p-5">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المنتجات ({items.reduce((s, i) => s + i.quantity, 0)} قطعة)</span>
                  <span className="font-bold">{totalPrice.toFixed(3)} د.أ</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">التوصيل</span>
                  <span className="font-bold text-green-600">مجاني (استلام من المكتبة)</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between font-bold text-lg">
                  <span>الإجمالي</span>
                  <span className="text-primary">{totalPrice.toFixed(3)} د.أ</span>
                </div>
              </div>
              <Button
                className="w-full h-12 font-bold rounded-xl text-base shadow-lg shadow-primary/20"
                onClick={handleCheckout}
                disabled={createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>إتمام الطلب</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">الدفع عند الاستلام من المكتبة</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
