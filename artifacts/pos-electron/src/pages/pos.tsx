import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Product, Shift, Invoice } from "../lib/electron-api";
import { useAuth } from "../lib/auth-context";
import { useConnectivity } from "../lib/connectivity";
import {
  Barcode, Trash2, Plus, Minus, CreditCard, Banknote,
  Receipt, CheckCircle2, Printer, ShoppingCart, PlayCircle,
  StopCircle, TrendingUp, Hash, RefreshCw,
  PauseCircle, ListOrdered, RotateCcw, Tag, X
} from "lucide-react";

interface CartItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  type: "product";
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
  id: number | string;
  items: CartItem[];
  total: number;
  discount: number;
  paymentMethod: "cash" | "card";
  paidAmount?: number;
}

export default function POS() {
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, syncStatus, triggerSync } = useConnectivity();

  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("50");
  const [closingBalance, setClosingBalance] = useState("");
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [shiftDetails, setShiftDetails] = useState<Shift | null>(null);
  const [activeCat, setActiveCat] = useState("الكل");
  const [loadingShift, setLoadingShift] = useState(true);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateProgress, setUpdateProgress] = useState<number | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Discount state
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountInput, setDiscountInput] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);

  // Hold/Resume state
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [isHoldOpen, setIsHoldOpen] = useState(false);

  // Returns state
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnInvoiceId, setReturnInvoiceId] = useState("");
  const [fetchedInvoice, setFetchedInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});
  const [returnReason, setReturnReason] = useState("");
  const [returnMethod, setReturnMethod] = useState<"cash" | "credit">("cash");
  const [isFetchingInvoice, setIsFetchingInvoice] = useState(false);

  // Shift log state
  const [isShiftLogOpen, setIsShiftLogOpen] = useState(false);
  const [shiftInvoices, setShiftInvoices] = useState<Invoice[]>([]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadProducts = useCallback(async (q?: string) => {
    const result = await window.electronAPI.getProducts(q);
    setProducts(result);
  }, []);

  const loadShift = useCallback(async () => {
    setLoadingShift(true);
    try {
      const s = await window.electronAPI.getCurrentShift();
      setCurrentShift(s as Shift | null);
      if (s) {
        const det = await window.electronAPI.getShiftDetails((s as Shift).id, (s as Shift).source === "remote");
        setShiftDetails(det as Shift | null);
      }
    } finally {
      setLoadingShift(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadShift();
  }, [loadProducts, loadShift]);

  useEffect(() => {
    const t = setTimeout(() => loadProducts(search || undefined), 300);
    return () => clearTimeout(t);
  }, [search, loadProducts]);

  useEffect(() => {
    if (currentShift) barcodeRef.current?.focus();
  }, [currentShift]);

  useEffect(() => {
    const remove = window.electronAPI.onUpdateStatus((status, data: any) => {
      if (status === "available") {
        showToast("تحديث جديد متاح للصراف، جاري التنزيل...", "success");
      } else if (status === "progress" && data && typeof data.percent === "number") {
        setUpdateProgress(data.percent);
      } else if (status === "downloaded") {
        setUpdateProgress(null);
        setUpdateAvailable(true);
        showToast("اكتمل تنزيل التحديث، يرجى التثبيت لإعادة التشغيل", "success");
      } else if (status === "error") {
        setUpdateProgress(null);
        // showToast("حدث خطأ أثناء تنزيل التحديث", "error"); // Optional: supress error toasts to not annoy cashier
      }
    });
    return remove;
  }, [showToast]);

  // ─── Totals ──────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const effectiveDiscount = Math.min(discountAmount, subtotal);
  const total = Math.max(0, subtotal - effectiveDiscount);
  const change = paymentMethod === "cash" && paidAmount
    ? Math.max(0, parseFloat(paidAmount) - total)
    : 0;

  // ─── Cart Functions ──────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) { showToast("المنتج غير متوفر في المخزون", "error"); return; }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) { showToast("الكمية المطلوبة غير متوفرة", "error"); return prev; }
        return prev.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: Date.now(), productId: product.id, name: product.name, price: product.price, quantity: 1, type: "product" }];
    });
    setSearch("");
    barcodeRef.current?.focus();
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((i) => i.id !== id));

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountPercent(0);
    setDiscountInput("");
    setPaidAmount("");
  }, []);

  // ─── Shift Functions ─────────────────────────────────────────────────────────
  const handleOpenShift = async () => {
    try {
      const s = await window.electronAPI.openShift(parseFloat(openingBalance) || 0);
      setCurrentShift(s as Shift);
      setIsOpenShiftOpen(false);
      showToast("تم فتح الوردية بنجاح");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل فتح الوردية", "error");
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    try {
      const isRemote = currentShift.source === "remote";
      await window.electronAPI.closeShift(currentShift.id, parseFloat(closingBalance) || 0, isRemote);
      setCurrentShift(null);
      setShiftDetails(null);
      setIsCloseShiftOpen(false);
      showToast("تم إغلاق الوردية بنجاح");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل إغلاق الوردية", "error");
    }
  };

  // ─── Discount ────────────────────────────────────────────────────────────────
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

  // ─── Checkout ────────────────────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!currentShift) { setIsOpenShiftOpen(true); return; }
    if (paymentMethod === "cash" && !paidAmount) {
      showToast("أدخل المبلغ المدفوع من العميل", "error");
      return;
    }
    if (paymentMethod === "cash" && parseFloat(paidAmount) < total) {
      showToast("المبلغ المدفوع أقل من الإجمالي", "error");
      return;
    }

    setLoadingCheckout(true);
    try {
      const inv = await window.electronAPI.createInvoice({
        shiftId: currentShift.id,
        paymentMethod,
        discountAmount: effectiveDiscount || undefined,
        discountPercent: discountPercent || undefined,
        items: cart.map((i) => ({
          productId: i.productId,
          productName: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          itemType: "product",
        })),
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
      if (inv.offline) showToast("تم حفظ الفاتورة محلياً (أوفلاين)", "success");
      await loadProducts();

      // Refresh shift details after new invoice
      const det = await window.electronAPI.getShiftDetails(currentShift.id, currentShift.source === "remote");
      setShiftDetails(det as Shift | null);

    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل إنشاء الفاتورة", "error");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const finishCheckout = () => {
    clearCart();
    setIsSuccessOpen(false);
    barcodeRef.current?.focus();
  };

  const handlePrint = async () => {
    if (!lastInvoice) return;
    const html = buildReceiptHtml(lastInvoice);
    await window.electronAPI.printReceipt(html);
  };

  // ─── Hold / Resume Invoices ──────────────────────────────────────────────────
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
    showToast(`تم تعليق الفاتورة — ${held.label}`);
  };

  const resumeHeld = (held: HeldInvoice) => {
    if (cart.length > 0) {
      showToast("يوجد فاتورة حالية. قم بتعليقها أو إنهائها أولاً", "error");
      return;
    }
    setCart(held.items);
    setDiscountAmount(held.discountAmount);
    setDiscountPercent(held.discountPercent);
    setPaymentMethod(held.paymentMethod);
    setHeldInvoices((prev) => prev.filter((h) => h.id !== held.id));
    setIsHoldOpen(false);
    showToast("تم استدعاء الفاتورة المعلقة");
  };

  // ─── Returns ─────────────────────────────────────────────────────────────────
  const fetchInvoiceForReturn = async () => {
    const id = parseInt(returnInvoiceId, 10);
    if (!id) return;
    setIsFetchingInvoice(true);
    try {
      const inv = await window.electronAPI.getInvoice(id);
      if (!inv) {
        showToast("الفاتورة غير موجودة", "error");
        return;
      }
      setFetchedInvoice(inv);
      const initial: Record<number, number> = {};
      inv.items.forEach((_, idx) => { initial[idx] = 0; });
      setReturnItems(initial);
    } catch {
      showToast("خطأ في الاتصال", "error");
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
      showToast("اختر منتجاً واحداً على الأقل للإرجاع", "error");
      return;
    }
    try {
      await window.electronAPI.createReturn({
        invoiceId: fetchedInvoice.id as number,
        items: itemsToReturn,
        refundMethod: returnMethod,
        reason: returnReason,
      });
      showToast("تم تسجيل المرتجع بنجاح");
      setIsReturnOpen(false);
      setFetchedInvoice(null);
      setReturnInvoiceId("");
      setReturnReason("");
      setReturnItems({});
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل تسجيل المرتجع", "error");
    }
  };

  const openReturnDialog = () => {
    setFetchedInvoice(null);
    setReturnInvoiceId("");
    setReturnReason("");
    setReturnItems({});
    setIsReturnOpen(true);
  };

  // ─── Shift Log ───────────────────────────────────────────────────────────────
  const openShiftLog = async () => {
    if (!currentShift) return;
    setIsShiftLogOpen(true);
    if (isOnline) {
      try {
        const invs = await window.electronAPI.listInvoices(currentShift.id);
        setShiftInvoices(invs);
      } catch {
        showToast("تعذر جلب فواتير الوردية", "error");
      }
    } else {
      showToast("لا يمكن جلب سجل الفواتير في وضع الأوفلاين", "error");
    }
  };

  const catTranslate = (dbCat: string | null, uiCat: string) => {
    if (uiCat === "الكل") return true;
    return dbCat === uiCat;
  };

  const posCategories = ["الكل", "قرطاسية", "دوسيات", "بطاقات", "إكسسوارات", "كتب"];
  const sd = shiftDetails;

  return (
    <div className="flex h-screen flex-col bg-gray-50 overflow-hidden" dir="rtl">
      {/* Top bar */}
      <div className="h-12 bg-gray-900/95 backdrop-blur-md flex items-center justify-between px-6 shrink-0 border-b border-white/5 shadow-lg z-50 select-none">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-black text-lg tracking-tight">LibraryOS <span className="text-teal-400">POS</span></span>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <span className="text-gray-400 text-sm font-medium">{user?.name}</span>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <button onClick={triggerSync} className="flex items-center gap-2 bg-amber-500/10 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-500/20 border border-amber-500/20 transition-all active:scale-95">
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
              {pendingCount} فواتير معلقة
            </button>
          )}
          {updateProgress !== null && (
            <div className="flex items-center gap-3 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-xl text-xs font-bold w-48 border border-blue-500/20">
              <span className="shrink-0">تحديث</span>
              <div className="flex-1 bg-blue-900/30 rounded-full h-2 flex overflow-hidden">
                <div className="bg-blue-400 h-2 rounded-full transition-all duration-300" style={{ width: `${updateProgress}%` }}></div>
              </div>
              <span className="shrink-0 text-[10px]">{Math.round(updateProgress)}%</span>
            </div>
          )}
          {updateAvailable && (
            <button onClick={() => window.electronAPI.installUpdate()} className="flex items-center gap-2 bg-teal-500 text-white px-4 py-1.5 rounded-xl text-xs font-black shadow-lg shadow-teal-500/20 hover:bg-teal-400 transition-all active:scale-95 animate-pulse">
              تثبيت التحديث الآن
            </button>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black border ${isOnline ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
            <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            {isOnline ? "متصل" : "غير متصل"}
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-white text-xs font-bold transition-colors">خروج</button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg font-bold text-white text-sm transition-all ${toast.type === "error" ? "bg-red-600" : "bg-green-600"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* CART PANEL */}
        <div className="w-[420px] lg:w-[480px] bg-white border-l border-gray-200 flex flex-col shadow-2xl z-10 shrink-0">
          <div className="p-5 bg-white border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-black text-2xl flex items-center gap-3 text-gray-800">
              <div className="p-2 bg-teal-50 rounded-xl text-teal-600">
                <ShoppingCart className="w-6 h-6" />
              </div>
              الفاتورة الحالية
            </h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {loadingShift ? (
                <div className="w-20 h-8 bg-gray-100 animate-pulse rounded-full" />
              ) : currentShift ? (
                <>
                  <div className="bg-green-50 text-green-600 px-4 py-1.5 rounded-full text-[11px] font-black border border-green-100 flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    وردية مفتوحة
                  </div>
                  <button
                    onClick={() => { setClosingBalance(""); setIsCloseShiftOpen(true); }}
                    className="p-2 bg-red-50 text-red-600 rounded-xl border border-red-100 hover:bg-red-100 transition-all hover:scale-105 active:scale-95 shadow-sm"
                    title="إغلاق الوردية"
                  >
                    <StopCircle className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button onClick={() => setIsOpenShiftOpen(true)} className="gradient-accent text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                  <PlayCircle className="w-4 h-4" /> فتح وردية
                </button>
              )}
            </div>
          </div>

          {/* Actions Row */}
          <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100 flex gap-2 overflow-x-auto custom-scrollbar">
            <button
              onClick={holdInvoice}
              disabled={cart.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white text-amber-600 rounded-xl text-xs font-black border border-gray-200 hover:border-amber-500/30 hover:bg-amber-50/30 disabled:opacity-40 transition-all shadow-sm active:scale-95"
            >
              <PauseCircle className="w-4 h-4" /> تعليق
            </button>
            <button
              onClick={() => setIsHoldOpen(true)}
              className="relative flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-xl text-xs font-black border border-gray-200 hover:border-blue-500/30 hover:bg-blue-50/30 transition-all shadow-sm active:scale-95"
            >
              <ListOrdered className="w-4 h-4" /> المعلقة
              {heldInvoices.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center font-black ring-2 ring-white ring-inset">{heldInvoices.length}</span>
              )}
            </button>
            <button
              onClick={openReturnDialog}
              className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 rounded-xl text-xs font-black border border-gray-200 hover:border-orange-500/30 hover:bg-orange-50/30 transition-all shadow-sm active:scale-95"
            >
              <RotateCcw className="w-4 h-4" /> مرتجع
            </button>
            <button
              onClick={openShiftLog}
              disabled={!currentShift || !isOnline}
              className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-xl text-xs font-black border border-gray-200 hover:border-purple-500/30 hover:bg-purple-50/30 disabled:opacity-40 transition-all shadow-sm active:scale-95"
            >
              <Receipt className="w-4 h-4" /> سجل
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 mt-10">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-premium mb-6">
                  <Receipt className="w-16 h-16 text-gray-200" />
                </div>
                <p className="text-2xl font-black text-gray-300">الفاتورة فارغة</p>
                <p className="text-sm mt-2 text-gray-400 bg-white px-4 py-1 rounded-full shadow-sm">امسح الباركود للبدء</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.id} className="bg-white p-5 rounded-2xl shadow-premium border border-white hover:border-teal-500/20 transition-all group animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-black text-lg text-gray-800 leading-snug">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">قطعة واحدة: {item.price.toFixed(3)} د.أ</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="font-black text-teal-600 text-xl tracking-tight">{(item.price * item.quantity).toFixed(3)}</span>
                        <span className="text-[10px] font-black text-teal-600 block">د.أ</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                        <button className="h-10 w-10 rounded-lg hover:bg-white hover:shadow-sm flex items-center justify-center text-gray-500 transition-all active:scale-90" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center font-black text-xl text-gray-700">{item.quantity}</span>
                        <button className="h-10 w-10 rounded-lg hover:bg-white hover:shadow-sm flex items-center justify-center text-gray-500 transition-all active:scale-90" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button className="h-10 w-10 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl flex items-center justify-center transition-all active:scale-90" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.08)] z-20">
            <div className="mb-4 space-y-2">
              {effectiveDiscount > 0 && (
                <div className="flex justify-between items-center text-sm px-1">
                  <span className="text-gray-400 font-bold">المجموع الفرعي</span>
                  <span className="text-gray-400 font-bold">{subtotal.toFixed(3)} د.أ</span>
                </div>
              )}
              {effectiveDiscount > 0 && (
                <div className="flex justify-between items-center text-sm px-1 bg-green-50 py-2 rounded-lg">
                  <span className="text-green-600 font-black flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    خصم {discountPercent > 0 ? `${discountPercent.toFixed(0)}%` : ""}
                    <button onClick={removeDiscount} className="text-red-400 hover:text-red-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                  <span className="text-green-600 font-black">−{effectiveDiscount.toFixed(3)} د.أ</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-gray-800">الإجمالي</span>
                  <button onClick={() => setIsDiscountOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-600 rounded-xl text-xs font-black border border-teal-100 hover:bg-teal-100 transition-all active:scale-95">
                    <Tag className="w-4 h-4" /> إدراج خصم
                  </button>
                </div>
                <div className="text-left">
                  <span className="text-5xl font-black text-teal-600 tracking-tighter">{total.toFixed(3)}</span>
                  <span className="text-sm font-black text-teal-600 block mt-[-4px]">دينار أردني</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <button
                className={`h-14 text-lg font-black rounded-2xl border-2 transition-all flex items-center justify-center gap-2 ${paymentMethod === "cash" ? "bg-gray-900 border-gray-900 text-white shadow-xl shadow-gray-900/10 scale-[1.02]" : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className={`w-6 h-6 ${paymentMethod === "cash" ? "text-amber-400" : ""}`} /> نقدي
              </button>
              <button
                className={`h-14 text-lg font-black rounded-2xl border-2 transition-all flex items-center justify-center gap-2 ${paymentMethod === "card" ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/10 scale-[1.02]" : "bg-white text-gray-400 border-gray-100 hover:border-gray-300"}`}
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard className={`w-6 h-6 ${paymentMethod === "card" ? "text-blue-200" : ""}`} /> بطاقة
              </button>
            </div>

            {paymentMethod === "cash" && (
              <div className="mb-5 p-4 bg-teal-50/50 rounded-2xl border border-teal-100 flex gap-4 items-center animate-in zoom-in-95 duration-200">
                <div className="flex-1">
                  <label className="text-[10px] font-black text-teal-700 mb-1 block uppercase tracking-wider">المبلغ المدفوع</label>
                  <input
                    type="number" min={total} step="0.001"
                    placeholder={total.toFixed(3)}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-full h-12 text-center text-2xl font-black rounded-xl border border-teal-200 focus:border-teal-500 bg-white outline-none shadow-inner"
                  />
                </div>
                {paidAmount && parseFloat(paidAmount) >= total && (
                  <div className="text-center w-28 bg-white p-2 rounded-xl border border-teal-100 shadow-sm">
                    <p className="text-[10px] font-black text-green-600 mb-0.5 uppercase">الباقي</p>
                    <p className="text-2xl font-black text-green-600 tabular-nums">{change.toFixed(3)}</p>
                  </div>
                )}
              </div>
            )}

            <button
              className={`w-full h-16 text-2xl font-black rounded-2xl shadow-xl transition-all duration-300 transform ${cart.length === 0 ? "opacity-50 bg-gray-200 text-gray-400 cursor-not-allowed" : "gradient-primary text-white hover:scale-[1.02] hover:shadow-teal-500/20 active:scale-95"}`}
              disabled={cart.length === 0 || loadingCheckout}
              onClick={handleCheckout}
            >
              {loadingCheckout ? "جاري المعالجة..." : "دفع وإصدار الفاتورة"}
            </button>
          </div>
        </div>

        {/* PRODUCTS PANEL */}
        <div className="flex-1 flex flex-col bg-gray-50/50 overflow-hidden relative">
          <div className="p-6 bg-white border-b border-gray-100 shadow-sm z-20 flex gap-4">
            <div className="relative flex-1 group">
              <Barcode className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-teal-600 transition-transform group-focus-within:scale-110" />
              <input
                ref={barcodeRef}
                placeholder="امسح الباركود أو ابحث عن منتج بالاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-16 pe-16 ps-6 bg-gray-50 border border-gray-100 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 rounded-2xl text-xl font-black outline-none transition-all placeholder:text-gray-300 shadow-inner"
                autoFocus
              />
            </div>
            <button
              onClick={() => { loadProducts(); showToast("تم تحديث قائمة المنتجات"); }}
              className="h-16 w-16 bg-white hover:bg-teal-50 border border-gray-100 rounded-2xl transition-all flex items-center justify-center text-teal-600 shadow-sm active:scale-90 group"
              title="تحديث المنتجات"
            >
              <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
            </button>
          </div>

          <div className="px-6 py-4 bg-white/60 backdrop-blur-sm border-b border-gray-100 flex gap-3 overflow-x-auto custom-scrollbar z-10">
            {posCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`px-8 py-3.5 rounded-2xl font-black text-sm whitespace-nowrap transition-all duration-300 ${activeCat === cat ? "gradient-primary text-white shadow-lg shadow-teal-500/30 scale-105" : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-100 shadow-sm"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-32">
              {products.filter((p) => catTranslate(p.category, activeCat)).map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stockQuantity <= 0}
                  className={`flex flex-col h-44 p-5 rounded-3xl border text-right transition-all duration-300 relative overflow-hidden group shadow-sm ${
                    product.stockQuantity > 0
                      ? "bg-white border-white hover:border-teal-500/30 hover:shadow-elevated active:scale-95 premium-card"
                      : "bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="font-black text-lg text-gray-800 leading-tight line-clamp-2 h-14">{product.name}</div>
                  <div className="mt-auto flex items-end justify-between w-full">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-400 leading-none">السعر</span>
                      <div className="font-black text-2xl text-teal-600 tabular-nums">{product.price.toFixed(3)}</div>
                    </div>
                    <div className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${product.stockQuantity > 10 ? "bg-green-50 text-green-600" : product.stockQuantity > 0 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>
                      {product.stockQuantity} متوفر
                    </div>
                  </div>
                  {/* Decorative glow on hover */}
                  <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-teal-500/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Discount Modal */}
      {isDiscountOpen && (
        <Modal onClose={() => setIsDiscountOpen(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">تطبيق خصم</h2>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setDiscountType("percent")}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${discountType === "percent" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                نسبة %
              </button>
              <button
                onClick={() => setDiscountType("amount")}
                className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${discountType === "amount" ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                مبلغ د.أ
              </button>
            </div>
            <input
              type="number" min="0" max={discountType === "percent" ? "100" : subtotal.toString()} step={discountType === "percent" ? "1" : "0.001"}
              placeholder={discountType === "percent" ? "مثال: 10" : "مثال: 1.500"}
              value={discountInput} onChange={(e) => setDiscountInput(e.target.value)}
              className="w-full h-12 text-center text-xl font-bold rounded-xl border border-gray-200 mb-4 outline-none focus:border-teal-500"
              autoFocus onKeyDown={(e) => { if (e.key === "Enter") applyDiscount(); }}
            />
            {discountInput && (
              <p className="text-center mb-4 text-sm font-bold text-green-600">
                قيمة الخصم: {discountType === "percent" ? `${(subtotal * (parseFloat(discountInput) || 0) / 100).toFixed(3)} ד.أ` : `${parseFloat(discountInput || "0").toFixed(3)} ד.أ`}
              </p>
            )}
            <div className="flex gap-2">
              <button className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors" onClick={applyDiscount}>تطبيق</button>
              <button className="flex-1 h-12 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50" onClick={() => setIsDiscountOpen(false)}>إلغاء</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Held Invoices Modal */}
      {isHoldOpen && (
        <Modal onClose={() => setIsHoldOpen(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">الفواتير المعلقة</h2>
            {heldInvoices.length === 0 ? (
              <p className="text-center text-gray-500 py-8">لا يوجد فواتير معلقة</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {heldInvoices.map((h) => (
                  <div key={h.id} className="p-3 border border-gray-200 rounded-xl flex justify-between items-center bg-gray-50">
                    <div>
                      <p className="font-bold text-teal-700">{h.label}</p>
                      <p className="text-xs text-gray-500">{h.items.length} منتجات | {h.heldAt.toLocaleTimeString("ar-JO")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => resumeHeld(h)} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700">استدعاء</button>
                      <button onClick={() => setHeldInvoices(prev => prev.filter(x => x.id !== h.id))} className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm font-bold hover:bg-red-200">حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="w-full mt-4 h-12 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50" onClick={() => setIsHoldOpen(false)}>إغلاق</button>
          </div>
        </Modal>
      )}

      {/* Returns Modal */}
      {isReturnOpen && (
        <Modal onClose={() => setIsReturnOpen(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">تسجيل مرتجع</h2>
            {!fetchedInvoice ? (
              <div>
                <label className="block text-sm font-bold mb-2">رقم الفاتورة</label>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text" value={returnInvoiceId} onChange={(e) => setReturnInvoiceId(e.target.value)}
                    className="flex-1 h-10 px-3 border border-gray-200 rounded-lg outline-none focus:border-teal-500"
                    placeholder="أدخل رقم الفاتورة..."
                  />
                  <button onClick={fetchInvoiceForReturn} disabled={isFetchingInvoice || !returnInvoiceId} className="px-4 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50">
                    {isFetchingInvoice ? "جاري البحث..." : "بحث"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="bg-teal-50 p-3 rounded-lg border border-teal-100">
                  <p className="font-bold text-teal-800">فاتورة #{fetchedInvoice.id}</p>
                  <p className="text-sm text-teal-600">{new Date(fetchedInvoice.createdAt).toLocaleString("ar-JO")}</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-sm">حدد الكميات المرتجعة:</p>
                  {fetchedInvoice.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border border-gray-200 rounded-lg bg-gray-50">
                      <div>
                        <p className="font-bold text-sm">{item.productName}</p>
                        <p className="text-xs text-gray-500">السعر: {item.unitPrice.toFixed(3)} — الكمية: {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setReturnItems(p => ({ ...p, [idx]: Math.max(0, (p[idx] || 0) - 1)}))} className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-md font-bold">-</button>
                        <span className="font-bold">{returnItems[idx] || 0}</span>
                        <button onClick={() => setReturnItems(p => ({ ...p, [idx]: Math.min(item.quantity, (p[idx] || 0) + 1)}))} className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded-md font-bold">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">سبب الإرجاع</label>
                  <input
                    type="text" value={returnReason} onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-200 rounded-lg outline-none focus:border-teal-500"
                    placeholder="مثال: منتج تالف، العميل غيّر رأيه..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">طريقة الاسترداد</label>
                  <div className="flex gap-2">
                    <button onClick={() => setReturnMethod("cash")} className={`flex-1 py-2 font-bold rounded-lg border ${returnMethod === "cash" ? "bg-teal-50 border-teal-500 text-teal-700" : "bg-white border-gray-200"}`}>نقدي</button>
                    <button onClick={() => setReturnMethod("credit")} className={`flex-1 py-2 font-bold rounded-lg border ${returnMethod === "credit" ? "bg-teal-50 border-teal-500 text-teal-700" : "bg-white border-gray-200"}`}>رصيد/بطاقة</button>
                  </div>
                </div>
                <button onClick={handleReturn} disabled={!returnReason} className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 mt-4">
                  تأكيد وتسجيل المرتجع
                </button>
              </div>
            )}
            <button className="w-full mt-4 h-10 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50" onClick={() => setIsReturnOpen(false)}>إغلاق</button>
          </div>
        </Modal>
      )}

      {/* Shift Log Modal */}
      {isShiftLogOpen && (
        <Modal onClose={() => setIsShiftLogOpen(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">سجل فواتير الوردية</h2>
            {shiftInvoices.length === 0 ? (
              <p className="text-center text-gray-500 py-8">لا يوجد فواتير حتى الآن أو أنك غير متصل</p>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {shiftInvoices.map((inv) => (
                  <div key={inv.id} className="p-3 border border-gray-200 rounded-xl bg-gray-50 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-teal-800">فاتورة #{inv.id}</p>
                      <p className="text-xs text-gray-500">{new Date(inv.createdAt).toLocaleTimeString("ar-JO")} | {inv.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</p>
                    </div>
                    <p className="font-bold text-teal-600 text-lg">{inv.total.toFixed(3)} د.أ</p>
                  </div>
                ))}
              </div>
            )}
            <button className="w-full mt-4 h-12 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50" onClick={() => setIsShiftLogOpen(false)}>إغلاق</button>
          </div>
        </Modal>
      )}

      {/* Open Shift Modal */}
      {isOpenShiftOpen && (
        <Modal onClose={() => setIsOpenShiftOpen(false)}>
          <div className="text-center p-8">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PlayCircle className="w-12 h-12 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">فتح وردية جديدة</h2>
            <p className="text-gray-500 mb-6">أدخل الرصيد الافتتاحي في الصندوق</p>
            <label className="block text-sm font-bold text-right mb-2">الرصيد الافتتاحي (د.أ)</label>
            <input
              type="number" step="0.001" value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-full h-14 text-center text-2xl font-bold rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-teal-500 mb-6"
              placeholder="50.000"
            />
            <div className="space-y-3">
              <button className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl transition-colors" onClick={handleOpenShift}>
                فتح الوردية وبدء البيع
              </button>
              <button className="w-full h-12 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50" onClick={() => setIsOpenShiftOpen(false)}>
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Close Shift Modal */}
      {isCloseShiftOpen && (
        <Modal onClose={() => setIsCloseShiftOpen(false)}>
          <div className="bg-gradient-to-br from-red-600 to-red-500 p-8 text-white text-center rounded-t-2xl">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <StopCircle className="w-9 h-9 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">إغلاق الوردية</h2>
          </div>
          {sd && (
            <div className="p-6 grid grid-cols-3 gap-3 bg-gray-50 border-b border-gray-200">
              <StatBox icon={<Hash className="w-4 h-4 text-gray-400 mx-auto mb-1" />} value={sd.totalInvoices ?? 0} label="فاتورة" />
              <StatBox icon={<Banknote className="w-4 h-4 text-green-600 mx-auto mb-1" />} value={`${(sd.cashSales ?? 0).toFixed(3)}`} label="نقدي د.أ" color="text-green-700" />
              <StatBox icon={<TrendingUp className="w-4 h-4 text-teal-600 mx-auto mb-1" />} value={`${(sd.totalSales ?? 0).toFixed(3)}`} label="إجمالي د.أ" color="text-teal-700" />
            </div>
          )}
          <div className="p-6 space-y-4">
            <div>
              <label className="block font-bold mb-2">الرصيد الختامي في الصندوق (د.أ)</label>
              <input
                type="number" step="0.001" placeholder="0.000"
                value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)}
                className="w-full h-12 text-center text-xl font-bold rounded-xl border border-gray-200 bg-gray-50 outline-none focus:border-teal-500"
              />
            </div>
            <button className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors" onClick={handleCloseShift}>
              تأكيد إغلاق الوردية
            </button>
            <button className="w-full h-12 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50" onClick={() => setIsCloseShiftOpen(false)}>
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {/* Success Modal */}
      {isSuccessOpen && (
        <Modal onClose={finishCheckout}>
          <div className="text-center p-10">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-green-200/50">
              <CheckCircle2 className="w-14 h-14 text-green-500 animate-in zoom-in-50 duration-500" />
            </div>
            <h2 className="text-3xl font-black mb-2 text-gray-800 tracking-tight">تم الدفع بنجاح!</h2>
            <p className="text-gray-400 font-bold mb-6">
              رقم الفاتورة <span className="text-gray-600 font-black">#{lastInvoice?.id}</span>
              {(lastInvoice?.id?.toString() ?? "").startsWith("LOCAL-") && <span className="text-amber-500 text-xs block mt-1"> (محفوظة محلياً للرفع التلقائي)</span>}
            </p>
            {lastInvoice && (
              <div className="bg-gray-50 rounded-3xl p-6 mb-8 border border-gray-100 shadow-inner">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-400 font-bold">المبلغ الإجمالي</span>
                  <span className="text-3xl font-black text-teal-600 tracking-tighter tabular-nums">{lastInvoice.total.toFixed(3)} <span className="text-sm">د.أ</span></span>
                </div>
                {lastInvoice.discount > 0 && (
                  <div className="flex justify-between items-center text-sm font-black text-green-600 mb-4 bg-green-100/50 py-1.5 px-3 rounded-lg">
                    <span>توفير خصم</span>
                    <span>{lastInvoice.discount.toFixed(3)} د.أ</span>
                  </div>
                )}
                {lastInvoice.paidAmount !== undefined && (
                  <div className="pt-4 border-t border-gray-200/50 flex justify-between items-center">
                    <span className="text-xs font-black text-amber-700">الباقي للعميل</span>
                    <span className="text-2xl font-black text-amber-600 tabular-nums">{(lastInvoice.paidAmount - lastInvoice.total).toFixed(3)} <span className="text-xs">د.أ</span></span>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4">
              <button className="h-16 text-xl font-black rounded-2xl gradient-primary text-white shadow-xl shadow-teal-500/20 hover:scale-[1.02] active:scale-95 transition-all" onClick={finishCheckout}>
                فاتورة جديدة
              </button>
              <button className="h-14 text-lg font-black rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 text-gray-600 shadow-sm transition-all" onClick={handlePrint}>
                <Printer className="w-5 h-5 inline me-2" /> طباعة الإيصال
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white rounded-[32px] shadow-elevated w-full max-w-[440px] overflow-hidden relative z-10 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function StatBox({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
      {icon}
      <p className={`text-xl font-bold ${color ?? ""}`}>{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
  );
}

function buildReceiptHtml(invoice: LastInvoice): string {
  const itemsHtml = invoice.items.map((item) => `
    <tr>
      <td style="padding:4px 0; border-bottom: 1px dashed #eee;">${item.name}</td>
      <td style="text-align:center; padding:4px 0; border-bottom: 1px dashed #eee;">${item.quantity}</td>
      <td style="text-align:left; padding:4px 0; border-bottom: 1px dashed #eee;">${(item.price * item.quantity).toFixed(3)} د.أ</td>
    </tr>
  `).join("");

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; max-width: 300px; margin: 0 auto; font-size: 12px; color: #000; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
        h1 { margin: 0; font-size: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { text-align: right; padding: 4px 0; border-bottom: 2px solid #000; }
        .total { border-top: 2px solid #000; padding-top: 8px; }
        .footer { text-align: center; margin-top: 16px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>LibraryOS</h1>
        <p>إيصال رقم #${invoice.id}</p>
        <p style="font-size:10px; color:#666;">${new Date().toLocaleString("ar-JO")}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>المنتج</th>
            <th style="text-align:center">الكمية</th>
            <th style="text-align:left">السعر</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="total">
        ${invoice.discount > 0 ? `
          <div style="display:flex; justify-content:space-between; color:#666; margin-bottom:4px">
            <span>المجموع</span>
            <span>${(invoice.total + invoice.discount).toFixed(3)} د.أ</span>
          </div>
          <div style="display:flex; justify-content:space-between; color:#900; margin-bottom:4px">
            <span>خصم</span>
            <span>-${invoice.discount.toFixed(3)} د.أ</span>
          </div>
        ` : ""}
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:16px;">
          <span>الإجمالي</span>
          <span>${invoice.total.toFixed(3)} د.أ</span>
        </div>
        ${invoice.paidAmount !== undefined ? `
          <div style="display:flex; justify-content:space-between; font-size:11px; color:#666; margin-top:4px;">
            <span>المدفوع</span>
            <span>${invoice.paidAmount.toFixed(3)} د.أ</span>
          </div>
        ` : ""}
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#666; margin-top:4px;">
          <span>طريقة الدفع</span>
          <span>${invoice.paymentMethod === "cash" ? "نقدي" : "بطاقة"}</span>
        </div>
      </div>
      <div class="footer"><p>شكراً لزيارتكم</p></div>
    </body>
    </html>
  `;
}
