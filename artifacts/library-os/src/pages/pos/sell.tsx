import React, { useState, useEffect, useRef } from "react";
import { POSLayout } from "@/components/layouts";
import {
  useListProducts, useCreateInvoice,
  useGetCurrentShift, useOpenShift, useCloseShift, useGetShift,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Barcode, Trash2, Plus, Minus, CreditCard, Banknote,
  Receipt, CheckCircle2, Printer, ShoppingCart, PlayCircle,
  StopCircle, TrendingUp, Hash,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface CartItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  type: "product" | "card" | "print_service";
}

interface LastInvoice {
  id: number;
  items: CartItem[];
  total: number;
  paymentMethod: "cash" | "card";
}

export default function POSSell() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("50");
  const [closingBalance, setClosingBalance] = useState("");
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const { data: currentShift, refetch: refetchShift } = useGetCurrentShift();
  const { data: shiftDetails } = useGetShift(
    currentShift?.id ?? 0,
    { query: { enabled: !!currentShift?.id } } as any,
  );
  const openShiftMutation = useOpenShift();
  const closeShiftMutation = useCloseShift();
  const { data: products } = useListProducts({ search: search || undefined });
  const createInvoiceMutation = useCreateInvoice();

  useEffect(() => {
    if (currentShift) barcodeInputRef.current?.focus();
  }, [currentShift]);

  const handleOpenShift = async () => {
    try {
      await openShiftMutation.mutateAsync({ data: { openingBalance: parseFloat(openingBalance) || 0 } });
      toast({ title: "تم فتح الوردية" });
      setIsOpenShiftOpen(false);
      refetchShift();
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    try {
      await closeShiftMutation.mutateAsync({
        shiftId: currentShift.id,
        data: { closingBalance: parseFloat(closingBalance) || 0 },
      });
      toast({ title: "تم إغلاق الوردية بنجاح" });
      setIsCloseShiftOpen(false);
      refetchShift();
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id && item.type === "product");
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          toast({ title: "عذراً", description: "الكمية المطلوبة غير متوفرة في المخزون", variant: "destructive" });
          return prev;
        }
        return prev.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: Date.now(), productId: product.id,
        name: product.name, price: parseFloat(product.price),
        quantity: 1, type: "product",
      }];
    });
    setSearch("");
    barcodeInputRef.current?.focus();
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => prev.map((item) => {
      if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((item) => item.id !== id));

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!currentShift) { setIsOpenShiftOpen(true); return; }
    try {
      const inv = await createInvoiceMutation.mutateAsync({
        data: {
          shiftId: currentShift.id,
          paymentMethod,
          items: cart.map((item) => ({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            itemType: item.type,
          })),
        },
      });
      setLastInvoice({ id: inv.id, items: [...cart], total, paymentMethod });
      setIsSuccessOpen(true);
    } catch (err) {
      toast({ title: "فشل إنشاء الفاتورة", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const finishCheckout = () => {
    setCart([]);
    setIsSuccessOpen(false);
    barcodeInputRef.current?.focus();
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const posCategories = ["الكل", "قرطاسية", "دوسيات", "بطاقات", "إكسسوارات", "كتب"];
  const [activeCat, setActiveCat] = useState("الكل");

  const sd = shiftDetails as any;

  return (
    <POSLayout>
      {/* Hidden print area */}
      {lastInvoice && (
        <div id="print-receipt" className="hidden print:block print:p-6 print:text-black print:text-sm" dir="rtl">
          <div className="text-center mb-4 border-b pb-4">
            <h1 className="text-2xl font-bold">LibraryOS</h1>
            <p className="text-gray-600 mt-1">إيصال رقم #{lastInvoice.id}</p>
            <p className="text-gray-500 text-xs mt-1">{new Date().toLocaleString("ar-JO")}</p>
          </div>
          <table className="w-full mb-4">
            <thead>
              <tr className="border-b">
                <th className="text-right py-1">المنتج</th>
                <th className="text-center py-1">الكمية</th>
                <th className="text-left py-1">السعر</th>
              </tr>
            </thead>
            <tbody>
              {lastInvoice.items.map((item) => (
                <tr key={item.id} className="border-b border-dashed">
                  <td className="py-1">{item.name}</td>
                  <td className="text-center py-1">{item.quantity}</td>
                  <td className="text-left py-1">{(item.price * item.quantity).toFixed(3)} د.أ</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t pt-3 space-y-1">
            <div className="flex justify-between font-bold text-lg">
              <span>الإجمالي</span>
              <span>{lastInvoice.total.toFixed(3)} د.أ</span>
            </div>
            <div className="flex justify-between text-gray-600 text-xs">
              <span>طريقة الدفع</span>
              <span>{lastInvoice.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</span>
            </div>
          </div>
          <div className="text-center mt-6 text-gray-500 text-xs">شكراً لزيارتكم</div>
        </div>
      )}

      <div className="flex h-full w-full print:hidden">
        {/* CART PANEL */}
        <div className="w-[400px] lg:w-[480px] bg-white border-l border-border flex flex-col shadow-2xl z-10 shrink-0">
          <div className="p-4 bg-gray-50 border-b border-border flex items-center justify-between">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" /> الفاتورة الحالية
            </h2>
            <div className="flex items-center gap-2">
              {currentShift ? (
                <>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                    وردية مفتوحة
                  </span>
                  <button
                    onClick={() => { setClosingBalance(""); setIsCloseShiftOpen(true); }}
                    className="bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-xs font-bold border border-red-200 hover:bg-red-200 transition-colors flex items-center gap-1"
                    title="إغلاق الوردية"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> إغلاق
                  </button>
                </>
              ) : (
                <button onClick={() => setIsOpenShiftOpen(true)} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 hover:bg-amber-200 transition-colors flex items-center gap-1">
                  <PlayCircle className="w-3.5 h-3.5" /> فتح وردية
                </button>
              )}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold border border-primary/20">
                {cart.length} منتجات
              </span>
            </div>
          </div>

          <ScrollArea className="flex-1 p-4 bg-gray-50/50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60 mt-20">
                <Receipt className="w-20 h-20 mb-4" />
                <p className="text-xl font-bold">الفاتورة فارغة</p>
                <p className="text-sm mt-2">قم بمسح الباركود أو اختر منتجاً للبدء</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-border/60 flex flex-col gap-3 group">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-foreground text-base leading-tight">{item.name}</h4>
                      <span className="font-bold text-primary text-lg">{(item.price * item.quantity).toFixed(3)} د.أ</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white shadow-sm" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white shadow-sm" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <span className="text-sm text-muted-foreground">{item.price.toFixed(3)} د.أ/قطعة</span>
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive hover:bg-destructive/10 rounded-xl" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Checkout Section */}
          <div className="p-5 bg-white border-t border-border shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-end mb-4">
              <span className="text-lg font-bold text-muted-foreground">الإجمالي</span>
              <span className="text-4xl font-display font-bold text-primary">{total.toFixed(3)} <span className="text-lg">د.أ</span></span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Button
                variant={paymentMethod === "cash" ? "default" : "outline"}
                className={`h-14 text-lg font-bold rounded-xl ${paymentMethod === "cash" ? "shadow-md shadow-primary/20" : "border-gray-200 bg-gray-50"}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className="w-6 h-6 me-2" /> نقدي
              </Button>
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                className={`h-14 text-lg font-bold rounded-xl ${paymentMethod === "card" ? "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20" : "border-gray-200 bg-gray-50"}`}
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard className="w-6 h-6 me-2" /> بطاقة
              </Button>
            </div>
            <Button
              className={`w-full h-16 text-2xl font-bold font-display rounded-xl shadow-xl transition-all duration-200 ${cart.length === 0 ? "opacity-50" : "hover:-translate-y-1 hover:shadow-2xl"}`}
              size="lg"
              disabled={cart.length === 0 || createInvoiceMutation.isPending}
              onClick={handleCheckout}
            >
              {createInvoiceMutation.isPending ? "جاري الدفع..." : "دفع وإصدار الفاتورة"}
            </Button>
          </div>
        </div>

        {/* PRODUCTS PANEL */}
        <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden relative">
          <div className="p-4 bg-white border-b border-border shadow-sm z-10 flex gap-4">
            <div className="relative flex-1">
              <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
              <Input
                ref={barcodeInputRef}
                placeholder="امسح الباركود أو ابحث عن منتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-14 pe-14 bg-gray-50 border-gray-200 focus:border-primary focus:ring-primary/20 rounded-2xl text-xl font-bold shadow-inner"
                autoFocus
              />
            </div>
          </div>

          <div className="px-4 py-3 bg-white border-b border-border flex gap-2 overflow-x-auto hide-scrollbar">
            {posCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`px-6 py-3 rounded-xl font-bold text-base whitespace-nowrap transition-all ${activeCat === cat ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
              {products?.filter((p: any) => activeCat === "الكل" || p.category === activeCat).map((product: any) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stockQuantity <= 0}
                  className={`flex flex-col h-36 p-4 rounded-2xl border text-right transition-all duration-200 relative overflow-hidden group ${
                    product.stockQuantity > 0
                      ? "bg-white border-gray-200 hover:border-primary hover:shadow-lg hover:shadow-primary/10 active:scale-95 cursor-pointer"
                      : "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="font-bold text-foreground text-base leading-tight line-clamp-2">{product.name}</div>
                  <div className="mt-auto flex items-end justify-between w-full">
                    <div className="font-display font-bold text-xl text-primary">{parseFloat(product.price).toFixed(3)} د.أ</div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg ${product.stockQuantity > 5 ? "bg-green-100 text-green-700" : product.stockQuantity > 0 ? "bg-amber-100 text-amber-700" : "bg-destructive/10 text-destructive"}`}>
                      {product.stockQuantity} متوفر
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Open Shift Dialog */}
      <Dialog open={isOpenShiftOpen} onOpenChange={setIsOpenShiftOpen}>
        <DialogContent className="sm:max-w-[360px] text-center p-8 border-0 shadow-2xl rounded-3xl">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <PlayCircle className="w-12 h-12 text-amber-600" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold mb-2">فتح وردية جديدة</DialogTitle>
          <p className="text-muted-foreground mb-6">أدخل الرصيد الافتتاحي في الصندوق</p>
          <div className="space-y-2 mb-6">
            <Label className="font-bold text-right block">الرصيد الافتتاحي (د.أ)</Label>
            <Input
              type="number" step="0.001" value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="h-14 text-center text-2xl font-bold rounded-xl"
              placeholder="50.000"
            />
          </div>
          <div className="space-y-3">
            <Button className="w-full h-12 font-bold rounded-xl" onClick={handleOpenShift} disabled={openShiftMutation.isPending}>
              {openShiftMutation.isPending ? "جاري الفتح..." : "فتح الوردية وبدء البيع"}
            </Button>
            <Button variant="outline" className="w-full h-12 font-bold rounded-xl" onClick={() => setIsOpenShiftOpen(false)}>
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={isCloseShiftOpen} onOpenChange={setIsCloseShiftOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 border-0 shadow-2xl rounded-3xl overflow-hidden" dir="rtl">
          <div className="bg-gradient-to-br from-red-600 to-red-500 p-8 text-white text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <StopCircle className="w-9 h-9 text-white" />
            </div>
            <DialogTitle className="font-display text-2xl font-bold text-white">إغلاق الوردية</DialogTitle>
            <p className="text-red-100 text-sm mt-1">
              {currentShift && new Date(currentShift.openedAt).toLocaleString("ar-JO")}
            </p>
          </div>

          {sd && (
            <div className="p-6 grid grid-cols-3 gap-3 bg-gray-50 border-b border-border">
              <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-border/50">
                <Hash className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-2xl font-display font-bold">{sd.totalInvoices ?? 0}</p>
                <p className="text-xs text-muted-foreground font-medium">فاتورة</p>
              </div>
              <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-border/50">
                <Banknote className="w-4 h-4 text-green-600 mx-auto mb-1" />
                <p className="text-xl font-display font-bold text-green-700">{(sd.cashSales ?? 0).toFixed(3)}</p>
                <p className="text-xs text-muted-foreground font-medium">نقدي د.أ</p>
              </div>
              <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-border/50">
                <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-xl font-display font-bold text-primary">{(sd.totalSales ?? 0).toFixed(3)}</p>
                <p className="text-xs text-muted-foreground font-medium">إجمالي د.أ</p>
              </div>
            </div>
          )}

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">الرصيد الختامي في الصندوق (د.أ)</Label>
              <Input
                type="number" step="0.001"
                placeholder="0.000"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                className="h-12 text-center text-xl font-bold rounded-xl"
              />
            </div>
            <Button
              className="w-full h-12 font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={handleCloseShift}
              disabled={closeShiftMutation.isPending}
            >
              {closeShiftMutation.isPending ? "جاري الإغلاق..." : "تأكيد إغلاق الوردية"}
            </Button>
            <Button variant="outline" className="w-full h-12 font-bold rounded-xl" onClick={() => setIsCloseShiftOpen(false)}>
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="sm:max-w-[400px] text-center p-8 border-0 shadow-2xl rounded-3xl">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-14 h-14 text-green-600" />
          </div>
          <DialogTitle className="font-display text-3xl font-bold text-foreground mb-2">تم الدفع بنجاح!</DialogTitle>
          <p className="text-muted-foreground text-lg mb-2">
            تم إصدار الفاتورة رقم #{createInvoiceMutation.data?.id}
          </p>
          {lastInvoice && (
            <p className="text-2xl font-display font-bold text-primary mb-6">{lastInvoice.total.toFixed(3)} د.أ</p>
          )}
          <div className="space-y-3">
            <Button className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20" onClick={finishCheckout}>
              فاتورة جديدة
            </Button>
            <Button variant="outline" className="w-full h-14 text-lg font-bold rounded-xl border-gray-200 bg-gray-50" onClick={handlePrintReceipt}>
              <Printer className="w-5 h-5 me-2" /> طباعة إيصال
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
