import React, { useState, useEffect, useRef, useCallback } from "react";
import { POSLayout } from "@/components/layouts";
import {
  useListProducts, useCreateInvoice,
  useGetCurrentShift, useOpenShift, useCloseShift, useGetShift,
  useCreateReturn, useListInvoices,
} from "@workspace/api-client-react";
import type { Invoice, InvoiceItem } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Barcode, Trash2, Plus, Minus, CreditCard, Banknote,
  Receipt, CheckCircle2, Printer, ShoppingCart, PlayCircle,
  StopCircle, TrendingUp, Hash, RotateCcw, PauseCircle, ListOrdered,
  Tag, X, ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface CartItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  type: "product" | "card" | "print_service";
}

interface HeldInvoice {
  id: number;
  label: string;
  items: CartItem[];
  discountAmount: number;
  discountPercent: number;
  paymentMethod: "cash" | "card";
  heldAt: Date;
}

interface LastInvoice {
  id: number;
  items: CartItem[];
  total: number;
  discount: number;
  paymentMethod: "cash" | "card";
  paidAmount?: number;
}

export default function POSSell() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("50");
  const [closingBalance, setClosingBalance] = useState("");
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Discount
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountInput, setDiscountInput] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);

  // Hold/Resume
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [isHoldOpen, setIsHoldOpen] = useState(false);

  // Returns
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnInvoiceId, setReturnInvoiceId] = useState("");
  const [fetchedInvoice, setFetchedInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnMethod, setReturnMethod] = useState<"cash" | "credit">("cash");
  const [isFetchingInvoice, setIsFetchingInvoice] = useState(false);

  // Shift invoice log
  const [isShiftLogOpen, setIsShiftLogOpen] = useState(false);

  const [activeCat, setActiveCat] = useState("الكل");

  const { data: currentShift, refetch: refetchShift } = useGetCurrentShift();
  const { data: shiftDetails, refetch: refetchShiftDetails } = useGetShift(
    currentShift?.id ?? 0,
  );
  const openShiftMutation = useOpenShift();
  const closeShiftMutation = useCloseShift();
  const { data: products } = useListProducts({ search: search || undefined });
  const createInvoiceMutation = useCreateInvoice();
  const createReturnMutation = useCreateReturn();

  const { data: shiftInvoices, refetch: refetchShiftInvoices } = useListInvoices(
    currentShift?.id ? { shiftId: currentShift.id } : undefined,
  );

  useEffect(() => {
    if (currentShift) barcodeInputRef.current?.focus();
  }, [currentShift]);

  // ─── Totals ────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const effectiveDiscount = Math.min(discountAmount, subtotal);
  const total = Math.max(0, subtotal - effectiveDiscount);
  const change = paymentMethod === "cash" && paidAmount
    ? Math.max(0, parseFloat(paidAmount) - total)
    : 0;

  // ─── Shift ─────────────────────────────────────────────────────────────────
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

  // ─── Cart ──────────────────────────────────────────────────────────────────
  const addToCart = (product: { id: number; name: string; price: string; stockQuantity: number; category?: string }) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id && item.type === "product");
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          toast({ title: "عذراً", description: "الكمية المطلوبة غير متوفرة", variant: "destructive" });
          return prev;
        }
        return prev.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: Date.now(), productId: product.id, name: product.name, price: parseFloat(product.price), quantity: 1, type: "product" }];
    });
    setSearch("");
    barcodeInputRef.current?.focus();
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => prev.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((item) => item.id !== id));

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountPercent(0);
    setDiscountInput("");
    setPaidAmount("");
  }, []);

  // ─── Discount ──────────────────────────────────────────────────────────────
  const applyDiscount = () => {
    const val = parseFloat(discountInput) || 0;
    if (discountType === "percent") {
      const pct = Math.min(100, Math.max(0, val));
      const amt = (subtotal * pct) / 100;
      setDiscountPercent(pct);
      setDiscountAmount(amt);
    } else {
      setDiscountAmount(Math.min(subtotal, Math.max(0, val)));
      setDiscountPercent(0);
    }
    setIsDiscountOpen(false);
  };

  const removeDiscount = () => {
    setDiscountAmount(0);
    setDiscountPercent(0);
    setDiscountInput("");
  };

  // ─── Checkout ──────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!currentShift) { setIsOpenShiftOpen(true); return; }
    if (paymentMethod === "cash" && !paidAmount) {
      toast({ title: "أدخل المبلغ المدفوع من العميل", variant: "destructive" });
      return;
    }
    if (paymentMethod === "cash" && parseFloat(paidAmount) < total) {
      toast({ title: "المبلغ المدفوع أقل من الإجمالي", variant: "destructive" });
      return;
    }
    try {
      const inv = await createInvoiceMutation.mutateAsync({
        data: {
          shiftId: currentShift.id,
          paymentMethod,
          discountAmount: effectiveDiscount || undefined,
          discountPercent: discountPercent || undefined,
          items: cart.map((item) => ({
            productId: item.productId,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            itemType: item.type,
          })),
        },
      });
      setLastInvoice({
        id: inv.id,
        items: [...cart],
        total,
        discount: effectiveDiscount,
        paymentMethod,
        paidAmount: paymentMethod === "cash" && paidAmount ? parseFloat(paidAmount) : undefined,
      });
      setIsSuccessOpen(true);
      refetchShiftDetails();
    } catch (err) {
      toast({ title: "فشل إنشاء الفاتورة", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const finishCheckout = () => {
    clearCart();
    setIsSuccessOpen(false);
    barcodeInputRef.current?.focus();
  };

  // ─── Hold / Resume ─────────────────────────────────────────────────────────
  const holdInvoice = () => {
    if (cart.length === 0) return;
    const held: HeldInvoice = {
      id: Date.now(),
      label: `فاتورة معلقة ${heldInvoices.length + 1}`,
      items: [...cart],
      discountAmount,
      discountPercent,
      paymentMethod,
      heldAt: new Date(),
    };
    setHeldInvoices((prev) => [...prev, held]);
    clearCart();
    toast({ title: "تم تعليق الفاتورة", description: `يمكنك استدعاؤها عند الحاجة` });
  };

  const resumeHeld = (held: HeldInvoice) => {
    if (cart.length > 0) {
      toast({ title: "يوجد فاتورة حالية. قم بتعليقها أو إنهائها أولاً", variant: "destructive" });
      return;
    }
    setCart(held.items);
    setDiscountAmount(held.discountAmount);
    setDiscountPercent(held.discountPercent);
    setPaymentMethod(held.paymentMethod);
    setHeldInvoices((prev) => prev.filter((h) => h.id !== held.id));
    setIsHoldOpen(false);
    toast({ title: "تم استدعاء الفاتورة المعلقة" });
  };

  const deleteHeld = (id: number) => {
    setHeldInvoices((prev) => prev.filter((h) => h.id !== id));
  };

  // ─── Returns ───────────────────────────────────────────────────────────────
  // Direct fetch is used here (rather than useGetInvoice hook) because
  // the invoice ID is not known at render time — it's entered by the cashier
  // on demand. React hooks cannot be called conditionally inside event handlers.
  const fetchInvoiceForReturn = async () => {
    const id = parseInt(returnInvoiceId, 10);
    if (!id) return;
    setIsFetchingInvoice(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("library_token")}` },
      });
      if (!res.ok) { toast({ title: "الفاتورة غير موجودة", variant: "destructive" }); return; }
      const inv = (await res.json()) as Invoice;
      setFetchedInvoice(inv);
      const initial: Record<number, number> = {};
      inv.items.forEach((item, idx) => { initial[idx] = 0; });
      setReturnItems(initial);
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setIsFetchingInvoice(false);
    }
  };

  const handleReturn = async () => {
    if (!fetchedInvoice || !returnReason) return;
    const itemsToReturn = fetchedInvoice.items
      .map((item, idx) => ({ item, qty: returnItems[idx] ?? 0 }))
      .filter(({ qty }) => qty > 0)
      .map(({ item, qty }) => ({
        productId: item.productId ?? undefined,
        productName: item.productName,
        quantity: qty,
        unitPrice: item.unitPrice,
      }));
    if (itemsToReturn.length === 0) {
      toast({ title: "اختر منتجاً واحداً على الأقل للإرجاع", variant: "destructive" });
      return;
    }
    try {
      await createReturnMutation.mutateAsync({
        data: {
          invoiceId: fetchedInvoice.id,
          items: itemsToReturn,
          refundMethod: returnMethod,
          reason: returnReason,
        },
      });
      toast({ title: "تم تسجيل المرتجع بنجاح" });
      setIsReturnOpen(false);
      setFetchedInvoice(null);
      setReturnInvoiceId("");
      setReturnReason("");
      setReturnItems({});
    } catch (err) {
      toast({ title: "فشل تسجيل المرتجع", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const openReturnDialog = () => {
    setFetchedInvoice(null);
    setReturnInvoiceId("");
    setReturnReason("");
    setReturnItems({});
    setIsReturnOpen(true);
  };

  // ─── Print helpers ─────────────────────────────────────────────────────────
  const buildReceiptHtml = (inv: LastInvoice | null, pid?: number, piTitle?: string, piItems?: InvoiceItem[], piTotal?: number) => {
    if (inv) {
      return `
        <div style="font-family:sans-serif;direction:rtl;padding:24px;max-width:320px;margin:auto;color:#000">
          <h1 style="text-align:center;font-size:20px;border-bottom:2px solid #000;padding-bottom:8px">LibraryOS</h1>
          <p style="text-align:center;color:#555;margin:4px 0">إيصال رقم #${inv.id}</p>
          <p style="text-align:center;color:#888;font-size:12px">${new Date().toLocaleString("ar-JO")}</p>
          <table style="width:100%;margin:12px 0;border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid #000"><th style="text-align:right;padding:4px">المنتج</th><th style="text-align:center;padding:4px">الكمية</th><th style="text-align:left;padding:4px">السعر</th></tr></thead>
            <tbody>${inv.items.map((i) => `<tr style="border-bottom:1px dashed #ccc"><td style="padding:4px">${i.name}</td><td style="text-align:center;padding:4px">${i.quantity}</td><td style="text-align:left;padding:4px">${(i.price * i.quantity).toFixed(3)} د.أ</td></tr>`).join("")}</tbody>
          </table>
          <div style="border-top:2px solid #000;padding-top:8px">
            ${inv.discount > 0 ? `<div style="display:flex;justify-content:space-between;color:#888"><span>المجموع</span><span>${(inv.total + inv.discount).toFixed(3)} د.أ</span></div><div style="display:flex;justify-content:space-between;color:#e53"><span>خصم</span><span>-${inv.discount.toFixed(3)} د.أ</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px"><span>الإجمالي</span><span>${inv.total.toFixed(3)} د.أ</span></div>
            ${inv.paidAmount !== undefined ? `<div style="display:flex;justify-content:space-between;color:#555"><span>المدفوع</span><span>${inv.paidAmount.toFixed(3)} د.أ</span></div><div style="display:flex;justify-content:space-between;color:#2a2"><span>الباقي</span><span>${(inv.paidAmount - inv.total).toFixed(3)} د.أ</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;color:#555;font-size:13px"><span>طريقة الدفع</span><span>${inv.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</span></div>
          </div>
          <div style="text-align:center;margin-top:20px;color:#888;font-size:12px">شكراً لزيارتكم</div>
        </div>`;
    }
    if (pid && piItems && piTotal !== undefined) {
      return `
        <div style="font-family:sans-serif;direction:rtl;padding:24px;max-width:320px;margin:auto;color:#000">
          <h1 style="text-align:center;font-size:20px;border-bottom:2px solid #000;padding-bottom:8px">LibraryOS</h1>
          <p style="text-align:center;color:#555;margin:4px 0">إيصال رقم #${pid} ${piTitle ? `— ${piTitle}` : ""}</p>
          <table style="width:100%;margin:12px 0;border-collapse:collapse">
            <thead><tr style="border-bottom:1px solid #000"><th style="text-align:right;padding:4px">المنتج</th><th style="text-align:center;padding:4px">الكمية</th><th style="text-align:left;padding:4px">السعر</th></tr></thead>
            <tbody>${piItems.map((i) => `<tr style="border-bottom:1px dashed #ccc"><td style="padding:4px">${i.productName}</td><td style="text-align:center;padding:4px">${i.quantity}</td><td style="text-align:left;padding:4px">${(i.unitPrice * i.quantity).toFixed(3)} د.أ</td></tr>`).join("")}</tbody>
          </table>
          <div style="border-top:2px solid #000;padding-top:8px;display:flex;justify-content:space-between;font-weight:bold;font-size:18px"><span>الإجمالي</span><span>${piTotal.toFixed(3)} د.أ</span></div>
          <div style="text-align:center;margin-top:20px;color:#888;font-size:12px">شكراً لزيارتكم</div>
        </div>`;
    }
    return "";
  };

  const printHtml = (html: string) => {
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`<html><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const posCategories = ["الكل", "قرطاسية", "دوسيات", "بطاقات", "إكسسوارات", "كتب"];
  const sd = shiftDetails as { totalInvoices?: number; cashSales?: number; totalSales?: number } | undefined;

  return (
    <POSLayout>
      {/* Hidden print area for window.print() fallback */}
      {lastInvoice && (
        <div id="print-receipt" className="hidden print:block" dir="rtl"
          dangerouslySetInnerHTML={{ __html: buildReceiptHtml(lastInvoice) }}
        />
      )}

      <div className="flex h-full w-full print:hidden">
        {/* ─── CART PANEL ─────────────────────────────────────────────────── */}
        <div className="w-[400px] lg:w-[480px] bg-white border-l border-border flex flex-col shadow-2xl z-10 shrink-0">
          {/* Cart Header */}
          <div className="p-4 bg-gray-50 border-b border-border flex items-center justify-between">
            <h2 className="font-display font-bold text-xl flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" /> الفاتورة الحالية
            </h2>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {currentShift ? (
                <>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    وردية مفتوحة
                  </span>
                  <button
                    onClick={() => { setClosingBalance(""); setIsCloseShiftOpen(true); }}
                    className="bg-red-100 text-red-700 px-2 py-1.5 rounded-full text-xs font-bold border border-red-200 hover:bg-red-200 transition-colors flex items-center gap-1"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> إغلاق
                  </button>
                </>
              ) : (
                <button onClick={() => setIsOpenShiftOpen(true)} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 hover:bg-amber-200 transition-colors flex items-center gap-1">
                  <PlayCircle className="w-3.5 h-3.5" /> فتح وردية
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="px-4 py-2 bg-gray-50 border-b border-border flex gap-2">
            <button
              onClick={holdInvoice}
              disabled={cart.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PauseCircle className="w-3.5 h-3.5" /> تعليق
            </button>
            <button
              onClick={() => setIsHoldOpen(true)}
              className="relative flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              <ListOrdered className="w-3.5 h-3.5" /> المعلقة
              {heldInvoices.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">{heldInvoices.length}</span>
              )}
            </button>
            <button
              onClick={openReturnDialog}
              className="flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> مرتجع
            </button>
            <button
              onClick={() => { setIsShiftLogOpen(true); refetchShiftInvoices(); }}
              disabled={!currentShift}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-200 hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Receipt className="w-3.5 h-3.5" /> سجل الوردية
            </button>
          </div>

          {/* Cart Items */}
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
                  <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-border/60 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-foreground text-base leading-tight">{item.name}</h4>
                      <span className="font-bold text-primary text-lg">{(item.price * item.quantity).toFixed(3)} د.أ</span>
                    </div>
                    <div className="flex items-center justify-between">
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
            {/* Totals */}
            <div className="mb-3 space-y-1">
              {effectiveDiscount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">المجموع</span>
                  <span className="text-muted-foreground">{subtotal.toFixed(3)} د.أ</span>
                </div>
              )}
              {effectiveDiscount > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    خصم {discountPercent > 0 ? `(${discountPercent.toFixed(0)}%)` : ""}
                    <button onClick={removeDiscount} className="text-red-500 hover:text-red-700">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                  <span className="text-green-600">−{effectiveDiscount.toFixed(3)} د.أ</span>
                </div>
              )}
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-muted-foreground">الإجمالي</span>
                  {/* Quick Discount Popover */}
                  <Popover open={isDiscountOpen} onOpenChange={setIsDiscountOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-200 hover:bg-green-100 transition-colors">
                        <Tag className="w-3 h-3" /> خصم
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-4" align="start" dir="rtl">
                      <p className="font-bold text-sm mb-3">تطبيق خصم سريع</p>
                      <div className="flex gap-2 mb-3">
                        <button
                          onClick={() => setDiscountType("percent")}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${discountType === "percent" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}
                        >
                          نسبة %
                        </button>
                        <button
                          onClick={() => setDiscountType("amount")}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors ${discountType === "amount" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}
                        >
                          مبلغ د.أ
                        </button>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        max={discountType === "percent" ? "100" : subtotal.toString()}
                        step={discountType === "percent" ? "1" : "0.001"}
                        placeholder={discountType === "percent" ? "مثال: 10" : "مثال: 1.500"}
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        className="h-10 text-center font-bold rounded-lg mb-3"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") applyDiscount(); }}
                      />
                      {discountInput && (
                        <p className="text-xs text-muted-foreground mb-2 text-center">
                          الخصم: {discountType === "percent"
                            ? `${(subtotal * (parseFloat(discountInput) || 0) / 100).toFixed(3)} د.أ`
                            : `${parseFloat(discountInput || "0").toFixed(3)} د.أ`}
                        </p>
                      )}
                      <Button onClick={applyDiscount} className="w-full h-9 font-bold rounded-lg">
                        تطبيق الخصم
                      </Button>
                    </PopoverContent>
                  </Popover>
                </div>
                <span className="text-4xl font-display font-bold text-primary">{total.toFixed(3)} <span className="text-lg">د.أ</span></span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Button
                variant={paymentMethod === "cash" ? "default" : "outline"}
                className={`h-12 text-base font-bold rounded-xl ${paymentMethod === "cash" ? "shadow-md shadow-primary/20" : "border-gray-200 bg-gray-50"}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className="w-5 h-5 me-2" /> نقدي
              </Button>
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                className={`h-12 text-base font-bold rounded-xl ${paymentMethod === "card" ? "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20" : "border-gray-200 bg-gray-50"}`}
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard className="w-5 h-5 me-2" /> بطاقة
              </Button>
            </div>

            {/* Cash Payment: Paid Amount + Change */}
            {paymentMethod === "cash" && (
              <div className="mb-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div className="flex gap-3 items-center">
                  <div className="flex-1">
                    <Label className="text-xs font-bold text-amber-800 mb-1 block">المبلغ المدفوع (د.أ)</Label>
                    <Input
                      type="number"
                      min={total}
                      step="0.001"
                      placeholder={total.toFixed(3)}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="h-10 text-center text-lg font-bold rounded-lg border-amber-300 focus:border-amber-500 bg-white"
                    />
                  </div>
                  {paidAmount && parseFloat(paidAmount) >= total && (
                    <div className="text-center">
                      <p className="text-xs font-bold text-green-700 mb-1">الباقي</p>
                      <p className="text-2xl font-display font-bold text-green-700">{change.toFixed(3)}</p>
                      <p className="text-xs text-green-600">د.أ</p>
                    </div>
                  )}
                </div>
                {paidAmount && parseFloat(paidAmount) < total && (
                  <p className="text-xs text-red-600 font-bold mt-1.5">⚠ المبلغ المدفوع أقل من الإجمالي</p>
                )}
              </div>
            )}

            {/* Checkout Button */}
            <Button
              className={`w-full h-14 text-xl font-bold font-display rounded-xl shadow-xl transition-all duration-200 ${cart.length === 0 ? "opacity-50" : "hover:-translate-y-0.5 hover:shadow-2xl"}`}
              size="lg"
              disabled={cart.length === 0 || createInvoiceMutation.isPending}
              onClick={handleCheckout}
            >
              {createInvoiceMutation.isPending ? "جاري الدفع..." : "دفع وإصدار الفاتورة"}
            </Button>
          </div>
        </div>

        {/* ─── PRODUCTS PANEL ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden relative">
          <div className="p-4 bg-white border-b border-border shadow-sm z-10">
            <div className="relative">
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
              {(products as Array<{ id: number; name: string; price: string; stockQuantity: number; category?: string }> | undefined)
                ?.filter((p) => activeCat === "الكل" || p.category === activeCat)
                .map((product) => (
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
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </button>
                ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ═══════════════════════════════ DIALOGS ══════════════════════════════ */}

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
            <Input type="number" step="0.001" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="h-14 text-center text-2xl font-bold rounded-xl" placeholder="50.000" />
          </div>
          <div className="space-y-3">
            <Button className="w-full h-12 font-bold rounded-xl" onClick={handleOpenShift} disabled={openShiftMutation.isPending}>
              {openShiftMutation.isPending ? "جاري الفتح..." : "فتح الوردية وبدء البيع"}
            </Button>
            <Button variant="outline" className="w-full h-12 font-bold rounded-xl" onClick={() => setIsOpenShiftOpen(false)}>إلغاء</Button>
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
            <p className="text-red-100 text-sm mt-1">{currentShift && new Date(currentShift.openedAt).toLocaleString("ar-JO")}</p>
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
                <p className="text-xl font-display font-bold text-green-700">{((sd.cashSales ?? 0) as number).toFixed(3)}</p>
                <p className="text-xs text-muted-foreground font-medium">نقدي د.أ</p>
              </div>
              <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-border/50">
                <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-xl font-display font-bold text-primary">{((sd.totalSales ?? 0) as number).toFixed(3)}</p>
                <p className="text-xs text-muted-foreground font-medium">إجمالي د.أ</p>
              </div>
            </div>
          )}
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold">الرصيد الختامي في الصندوق (د.أ)</Label>
              <Input type="number" step="0.001" placeholder="0.000" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} className="h-12 text-center text-xl font-bold rounded-xl" />
            </div>
            <Button className="w-full h-12 font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white" onClick={handleCloseShift} disabled={closeShiftMutation.isPending}>
              {closeShiftMutation.isPending ? "جاري الإغلاق..." : "تأكيد إغلاق الوردية"}
            </Button>
            <Button variant="outline" className="w-full h-12 font-bold rounded-xl" onClick={() => setIsCloseShiftOpen(false)}>إلغاء</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen}>
        <DialogContent className="sm:max-w-[400px] text-center p-8 border-0 shadow-2xl rounded-3xl" dir="rtl">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-14 h-14 text-green-600" />
          </div>
          <DialogTitle className="font-display text-3xl font-bold mb-2">تم الدفع بنجاح!</DialogTitle>
          <p className="text-muted-foreground text-lg mb-1">فاتورة رقم #{lastInvoice?.id}</p>
          {lastInvoice && (
            <>
              <p className="text-3xl font-display font-bold text-primary mb-1">{lastInvoice.total.toFixed(3)} د.أ</p>
              {lastInvoice.discount > 0 && (
                <p className="text-sm text-green-600 mb-1">وُفّر: {lastInvoice.discount.toFixed(3)} د.أ</p>
              )}
              {lastInvoice.paidAmount !== undefined && (
                <div className="bg-amber-50 rounded-xl p-3 mb-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-amber-800">الباقي للعميل</span>
                  <span className="text-2xl font-display font-bold text-amber-700">{(lastInvoice.paidAmount - lastInvoice.total).toFixed(3)} د.أ</span>
                </div>
              )}
            </>
          )}
          <div className="space-y-3 mt-4">
            <Button className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20" onClick={finishCheckout}>فاتورة جديدة</Button>
            <Button variant="outline" className="w-full h-14 text-lg font-bold rounded-xl border-gray-200" onClick={() => { printHtml(buildReceiptHtml(lastInvoice)); }}>
              <Printer className="w-5 h-5 me-2" /> طباعة إيصال
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Held Invoices Dialog */}
      <Dialog open={isHoldOpen} onOpenChange={setIsHoldOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 border-0 shadow-2xl rounded-3xl overflow-hidden" dir="rtl">
          <div className="p-6 border-b border-border bg-gray-50">
            <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
              <PauseCircle className="w-6 h-6 text-amber-600" /> الفواتير المعلقة
            </DialogTitle>
          </div>
          <ScrollArea className="max-h-[420px]">
            {heldInvoices.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <PauseCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-bold">لا توجد فواتير معلقة</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {heldInvoices.map((held) => (
                  <div key={held.id} className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="font-bold">{held.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {held.items.length} منتج — {held.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(3)} د.أ
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{held.heldAt.toLocaleTimeString("ar-JO")}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-9 font-bold rounded-xl" onClick={() => resumeHeld(held)}>استدعاء</Button>
                      <Button size="sm" variant="ghost" className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10" onClick={() => deleteHeld(held.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-4 border-t border-border">
            <Button variant="outline" className="w-full font-bold rounded-xl" onClick={() => setIsHoldOpen(false)}>إغلاق</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Returns Dialog */}
      <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DialogContent className="sm:max-w-[560px] p-0 border-0 shadow-2xl rounded-3xl overflow-hidden" dir="rtl">
          <div className="p-6 border-b border-border bg-orange-50">
            <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-orange-600" /> تسجيل مرتجع
            </DialogTitle>
          </div>
          <div className="p-6">
            {/* Step 1: Find invoice */}
            {!fetchedInvoice ? (
              <div className="space-y-4">
                <div>
                  <Label className="font-bold block mb-2">رقم الفاتورة</Label>
                  <div className="flex gap-3">
                    <Input
                      type="number"
                      placeholder="أدخل رقم الفاتورة..."
                      value={returnInvoiceId}
                      onChange={(e) => setReturnInvoiceId(e.target.value)}
                      className="h-12 text-lg font-bold rounded-xl"
                      onKeyDown={(e) => { if (e.key === "Enter") fetchInvoiceForReturn(); }}
                    />
                    <Button className="h-12 px-6 font-bold rounded-xl" onClick={fetchInvoiceForReturn} disabled={!returnInvoiceId || isFetchingInvoice}>
                      {isFetchingInvoice ? "..." : <Search className="w-5 h-5" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              /* Step 2: Select items to return */
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center border border-border">
                  <div>
                    <p className="font-bold">فاتورة #{fetchedInvoice.id}</p>
                    <p className="text-sm text-muted-foreground">{fetchedInvoice.staffName} — {new Date(fetchedInvoice.createdAt).toLocaleString("ar-JO")}</p>
                  </div>
                  <button onClick={() => setFetchedInvoice(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <ScrollArea className="max-h-48">
                  <div className="space-y-2">
                    {fetchedInvoice.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white rounded-xl p-3 border border-border">
                        <div>
                          <p className="font-bold text-sm">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">{item.unitPrice.toFixed(3)} د.أ × {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">الكمية المُرجعة:</span>
                          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                            <button
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white font-bold"
                              onClick={() => setReturnItems((p) => ({ ...p, [idx]: Math.max(0, (p[idx] ?? 0) - 1) }))}
                            >−</button>
                            <span className="w-8 text-center font-bold text-sm">{returnItems[idx] ?? 0}</span>
                            <button
                              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white font-bold"
                              onClick={() => setReturnItems((p) => ({ ...p, [idx]: Math.min(item.quantity, (p[idx] ?? 0) + 1) }))}
                            >+</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div>
                  <Label className="font-bold block mb-2">سبب الإرجاع</Label>
                  <Input
                    placeholder="مثال: المنتج معيب / طلب العميل..."
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div>
                  <Label className="font-bold block mb-2">طريقة الاسترداد</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setReturnMethod("cash")}
                      className={`py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors border ${returnMethod === "cash" ? "bg-primary text-white border-primary" : "bg-gray-50 border-gray-200 text-gray-700"}`}
                    >
                      <Banknote className="w-4 h-4" /> نقدي
                    </button>
                    <button
                      onClick={() => setReturnMethod("credit")}
                      className={`py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors border ${returnMethod === "credit" ? "bg-primary text-white border-primary" : "bg-gray-50 border-gray-200 text-gray-700"}`}
                    >
                      <CreditCard className="w-4 h-4" /> رصيد
                    </button>
                  </div>
                </div>

                {/* Return total */}
                {Object.values(returnItems).some((v) => v > 0) && (
                  <div className="bg-orange-50 rounded-xl p-3 border border-orange-200 flex justify-between items-center">
                    <span className="font-bold text-orange-800">إجمالي المرتجع</span>
                    <span className="text-xl font-display font-bold text-orange-700">
                      {fetchedInvoice.items.reduce((s, item, idx) => s + (returnItems[idx] ?? 0) * item.unitPrice, 0).toFixed(3)} د.أ
                    </span>
                  </div>
                )}

                <Button
                  className="w-full h-12 font-bold rounded-xl bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleReturn}
                  disabled={createReturnMutation.isPending || !returnReason}
                >
                  {createReturnMutation.isPending ? "جاري التسجيل..." : "تأكيد الإرجاع"}
                </Button>
              </div>
            )}
          </div>
          {!fetchedInvoice && (
            <div className="p-4 border-t border-border">
              <Button variant="outline" className="w-full font-bold rounded-xl" onClick={() => setIsReturnOpen(false)}>إلغاء</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Shift Invoice Log Dialog */}
      <Dialog open={isShiftLogOpen} onOpenChange={setIsShiftLogOpen}>
        <DialogContent className="sm:max-w-[640px] p-0 border-0 shadow-2xl rounded-3xl overflow-hidden" dir="rtl">
          <div className="p-6 border-b border-border bg-purple-50 flex items-center justify-between">
            <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
              <Receipt className="w-6 h-6 text-purple-600" /> سجل فواتير الوردية
            </DialogTitle>
            {sd && (
              <div className="flex gap-4 text-sm">
                <span className="font-bold text-green-700">{sd.totalInvoices ?? 0} فاتورة</span>
                <span className="font-bold text-primary">{((sd.totalSales ?? 0) as number).toFixed(3)} د.أ</span>
              </div>
            )}
          </div>
          <ScrollArea className="max-h-[480px]">
            {!shiftInvoices || (shiftInvoices as Invoice[]).length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-bold">لا توجد فواتير في هذه الوردية بعد</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {(shiftInvoices as Invoice[]).map((inv) => (
                  <div key={inv.id} className="bg-white rounded-2xl border border-border p-4 flex items-center justify-between shadow-sm">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold text-lg">#{inv.id}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${inv.paymentMethod === "cash" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                          {inv.paymentMethod === "cash" ? "نقدي" : "بطاقة"}
                        </span>
                        {inv.discountAmount > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            خصم {inv.discountAmount.toFixed(3)} د.أ
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {new Date(inv.createdAt).toLocaleTimeString("ar-JO")} — {inv.items.length} منتجات
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-lg text-primary">{inv.total.toFixed(3)} د.أ</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 w-9 rounded-xl p-0"
                        title="إعادة طباعة"
                        onClick={() => {
                          printHtml(buildReceiptHtml(
                            null, inv.id,
                            inv.staffName,
                            inv.items,
                            inv.total,
                          ));
                        }}
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="p-4 border-t border-border">
            <Button variant="outline" className="w-full font-bold rounded-xl" onClick={() => setIsShiftLogOpen(false)}>إغلاق</Button>
          </div>
        </DialogContent>
      </Dialog>
    </POSLayout>
  );
}
