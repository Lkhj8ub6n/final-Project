import React, { useState, useEffect, useRef, useCallback } from "react";
import type { Product, Shift } from "../lib/electron-api";
import { useAuth } from "../lib/auth-context";
import { useConnectivity } from "../lib/connectivity";
import {
  Barcode, Trash2, Plus, Minus, CreditCard, Banknote,
  Receipt, CheckCircle2, Printer, ShoppingCart, PlayCircle,
  StopCircle, TrendingUp, Hash, RefreshCw, Cloud, CloudOff,
} from "lucide-react";

interface CartItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

interface LastInvoice {
  id: number | string;
  items: CartItem[];
  total: number;
  paymentMethod: "cash" | "card";
}

export default function POS() {
  const { user, logout } = useAuth();
  const { isOnline, pendingCount, syncStatus, triggerSync } = useConnectivity();

  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
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
  const barcodeRef = useRef<HTMLInputElement>(null);

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
        const det = await window.electronAPI.getShiftDetails((s as Shift).id, !(s as any).isSynced === false);
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
    const remove = window.electronAPI.onUpdateStatus((status) => {
      if (status === "downloaded") setUpdateAvailable(true);
    });
    return remove;
  }, []);

  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) { showToast("المنتج غير متوفر في المخزون", "error"); return; }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) { showToast("الكمية المطلوبة غير متوفرة", "error"); return prev; }
        return prev.map((i) => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: Date.now(), productId: product.id, name: product.name, price: product.price, quantity: 1 }];
    });
    setSearch("");
    barcodeRef.current?.focus();
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };

  const removeFromCart = (id: number) => setCart((prev) => prev.filter((i) => i.id !== id));

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

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
      const isRemote = !!(currentShift as any).staffId;
      await window.electronAPI.closeShift(currentShift.id, parseFloat(closingBalance) || 0, isRemote);
      setCurrentShift(null);
      setShiftDetails(null);
      setIsCloseShiftOpen(false);
      showToast("تم إغلاق الوردية بنجاح");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل إغلاق الوردية", "error");
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!currentShift) { setIsOpenShiftOpen(true); return; }
    setLoadingCheckout(true);
    try {
      const inv = await window.electronAPI.createInvoice({
        shiftId: currentShift.id,
        paymentMethod,
        items: cart.map((i) => ({
          productId: i.productId,
          productName: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          itemType: "product",
        })),
      });
      const result = inv as { id: number | string; total: number; offline?: boolean };
      setLastInvoice({ id: result.id, items: [...cart], total, paymentMethod });
      setIsSuccessOpen(true);
      if (result.offline) showToast("تم حفظ الفاتورة محلياً (أوفلاين)", "success");
      await loadProducts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل إنشاء الفاتورة", "error");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const finishCheckout = () => {
    setCart([]);
    setIsSuccessOpen(false);
    barcodeRef.current?.focus();
  };

  const handlePrint = async () => {
    if (!lastInvoice) return;
    const html = buildReceiptHtml(lastInvoice);
    await window.electronAPI.printReceipt(html);
  };

  const posCategories = ["الكل", "قرطاسية", "دوسيات", "بطاقات", "إكسسوارات", "كتب"];

  const sd = shiftDetails;

  return (
    <div className="flex h-screen flex-col bg-gray-50 overflow-hidden" dir="rtl">
      {/* Top bar */}
      <div className="h-10 bg-gray-900 flex items-center justify-between px-4 shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-sm">LibraryOS POS</span>
          <span className="text-gray-400 text-xs">| {user?.name}</span>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <button onClick={triggerSync} className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-amber-500/30 transition-colors">
              <RefreshCw className={`w-3 h-3 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
              {pendingCount} فاتورة معلقة
            </button>
          )}
          {updateAvailable && (
            <button onClick={() => window.electronAPI.installUpdate()} className="flex items-center gap-1.5 bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-blue-500/30 transition-colors">
              تحديث متوفر — تثبيت الآن
            </button>
          )}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${isOnline ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
            {isOnline ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
            {isOnline ? "متصل" : "غير متصل"}
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-white text-xs transition-colors">خروج</button>
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
        <div className="w-[400px] lg:w-[480px] bg-white border-l border-border flex flex-col shadow-2xl z-10 shrink-0">
          <div className="p-4 bg-gray-50 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-xl flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-teal-600" /> الفاتورة الحالية
            </h2>
            <div className="flex items-center gap-2">
              {loadingShift ? (
                <span className="text-xs text-gray-400">...</span>
              ) : currentShift ? (
                <>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    وردية مفتوحة
                  </span>
                  <button
                    onClick={() => { setClosingBalance(""); setIsCloseShiftOpen(true); }}
                    className="bg-red-100 text-red-700 px-3 py-1.5 rounded-full text-xs font-bold border border-red-200 hover:bg-red-200 transition-colors flex items-center gap-1"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> إغلاق
                  </button>
                </>
              ) : (
                <button onClick={() => setIsOpenShiftOpen(true)} className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200 hover:bg-amber-200 transition-colors flex items-center gap-1">
                  <PlayCircle className="w-3.5 h-3.5" /> فتح وردية
                </button>
              )}
              <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-sm font-bold border border-teal-100">
                {cart.length} منتجات
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 mt-20">
                <Receipt className="w-20 h-20 mb-4" />
                <p className="text-xl font-bold">الفاتورة فارغة</p>
                <p className="text-sm mt-2">قم بمسح الباركود أو اختر منتجاً للبدء</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-border/60 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-base leading-tight">{item.name}</h4>
                      <span className="font-bold text-teal-600 text-lg">{(item.price * item.quantity).toFixed(3)} د.أ</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                        <button className="h-8 w-8 rounded-lg hover:bg-white flex items-center justify-center" onClick={() => updateQuantity(item.id, -1)}>
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-10 text-center font-bold text-lg">{item.quantity}</span>
                        <button className="h-8 w-8 rounded-lg hover:bg-white flex items-center justify-center" onClick={() => updateQuantity(item.id, 1)}>
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-sm text-gray-500">{item.price.toFixed(3)} د.أ/قطعة</span>
                      <button className="h-10 w-10 text-red-500 hover:bg-red-50 rounded-xl flex items-center justify-center" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 bg-white border-t border-border shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-end mb-4">
              <span className="text-lg font-bold text-gray-500">الإجمالي</span>
              <span className="text-4xl font-bold text-teal-600">{total.toFixed(3)} <span className="text-lg">د.أ</span></span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                className={`h-14 text-lg font-bold rounded-xl border-2 transition-all ${paymentMethod === "cash" ? "bg-teal-600 text-white border-teal-600 shadow-md" : "bg-gray-50 text-gray-700 border-gray-200"}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className="w-6 h-6 inline me-2" /> نقدي
              </button>
              <button
                className={`h-14 text-lg font-bold rounded-xl border-2 transition-all ${paymentMethod === "card" ? "bg-blue-600 text-white border-blue-600 shadow-md" : "bg-gray-50 text-gray-700 border-gray-200"}`}
                onClick={() => setPaymentMethod("card")}
              >
                <CreditCard className="w-6 h-6 inline me-2" /> بطاقة
              </button>
            </div>
            <button
              className={`w-full h-16 text-2xl font-bold rounded-xl shadow-xl transition-all duration-200 ${cart.length === 0 ? "opacity-50 bg-teal-400 text-white cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700 text-white hover:-translate-y-1 hover:shadow-2xl"}`}
              disabled={cart.length === 0 || loadingCheckout}
              onClick={handleCheckout}
            >
              {loadingCheckout ? "جاري الدفع..." : "دفع وإصدار الفاتورة"}
            </button>
          </div>
        </div>

        {/* PRODUCTS PANEL */}
        <div className="flex-1 flex flex-col bg-gray-100 overflow-hidden">
          <div className="p-4 bg-white border-b border-border shadow-sm z-10 flex gap-4">
            <div className="relative flex-1">
              <Barcode className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-teal-600" />
              <input
                ref={barcodeRef}
                placeholder="امسح الباركود أو ابحث عن منتج..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-14 pe-14 ps-4 bg-gray-50 border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-2xl text-xl font-bold outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={() => { loadProducts(); showToast("تم تحديث المنتجات"); }}
              className="h-14 px-4 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-2xl transition-colors flex items-center gap-2 text-gray-600"
              title="تحديث المنتجات"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-3 bg-white border-b border-border flex gap-2 overflow-x-auto">
            {posCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={`px-6 py-3 rounded-xl font-bold text-base whitespace-nowrap transition-all ${activeCat === cat ? "bg-teal-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
              {products.filter((p) => activeCat === "الكل" || p.category === activeCat).map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stockQuantity <= 0}
                  className={`flex flex-col h-36 p-4 rounded-2xl border text-right transition-all duration-200 relative overflow-hidden group ${
                    product.stockQuantity > 0
                      ? "bg-white border-gray-200 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/10 active:scale-95"
                      : "bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="font-bold text-base leading-tight line-clamp-2">{product.name}</div>
                  <div className="mt-auto flex items-end justify-between w-full">
                    <div className="font-bold text-xl text-teal-600">{product.price.toFixed(3)} د.أ</div>
                    <div className={`text-xs font-bold px-2 py-1 rounded-lg ${product.stockQuantity > 5 ? "bg-green-100 text-green-700" : product.stockQuantity > 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                      {product.stockQuantity} متوفر
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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
          <div className="text-center p-8">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-14 h-14 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold mb-2">تم الدفع بنجاح!</h2>
            <p className="text-gray-500 text-lg mb-2">
              الفاتورة رقم #{lastInvoice?.id}
              {(lastInvoice?.id?.toString() ?? "").startsWith("LOCAL-") && <span className="text-amber-600 text-sm"> (محفوظة محلياً)</span>}
            </p>
            {lastInvoice && <p className="text-2xl font-bold text-teal-600 mb-6">{lastInvoice.total.toFixed(3)} د.أ</p>}
            <div className="space-y-3">
              <button className="w-full h-14 text-lg font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-lg transition-colors" onClick={finishCheckout}>
                فاتورة جديدة
              </button>
              <button className="w-full h-14 text-lg font-bold rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700" onClick={handlePrint}>
                <Printer className="w-5 h-5 inline me-2" /> طباعة إيصال
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />
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
        <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:16px;">
          <span>الإجمالي</span>
          <span>${invoice.total.toFixed(3)} د.أ</span>
        </div>
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
