import { useState, useCallback } from "react";

export interface CartItem {
  id: number;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  type: "product" | "card" | "print_service";
}

export interface HeldInvoice {
  id: number;
  label: string;
  items: CartItem[];
  discountAmount: number;
  discountPercent: number;
  paymentMethod: "cash" | "card";
  heldAt: Date;
}

export function usePosCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountInput, setDiscountInput] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [heldInvoices, setHeldInvoices] = useState<HeldInvoice[]>([]);
  const [isHoldOpen, setIsHoldOpen] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const effectiveDiscount = Math.min(discountAmount, subtotal);
  const total = Math.max(0, subtotal - effectiveDiscount);
  const change = paymentMethod === "cash" && paidAmount
    ? Math.max(0, parseFloat(paidAmount) - total)
    : 0;

  const updateQuantity = useCallback((id: number, delta: number) => {
    setCart((prev) => prev.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  }, []);

  const removeFromCart = useCallback((id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountPercent(0);
    setDiscountInput("");
    setPaidAmount("");
  }, []);

  const applyDiscount = useCallback(() => {
    const val = Math.max(0, parseFloat(discountInput) || 0);
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
  }, [discountInput, discountType, subtotal]);

  const removeDiscount = useCallback(() => {
    setDiscountAmount(0);
    setDiscountPercent(0);
    setDiscountInput("");
  }, []);

  const holdInvoice = useCallback((onHold?: () => void) => {
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
    if (onHold) onHold();
  }, [cart, discountAmount, discountPercent, paymentMethod, heldInvoices.length, clearCart]);

  const resumeHeld = useCallback((held: HeldInvoice, onFail?: (msg: string) => void, onSuccess?: () => void) => {
    if (cart.length > 0) {
      if (onFail) onFail("يوجد فاتورة حالية. قم بتعليقها أو إنهائها أولاً");
      return;
    }
    setCart(held.items);
    setDiscountAmount(held.discountAmount);
    setDiscountPercent(held.discountPercent);
    setPaymentMethod(held.paymentMethod);
    setHeldInvoices((prev) => prev.filter((h) => h.id !== held.id));
    setIsHoldOpen(false);
    if (onSuccess) onSuccess();
  }, [cart.length]);

  const deleteHeld = useCallback((id: number) => {
    setHeldInvoices((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const addToCart = useCallback((
    product: { id: number; name: string; price: number | string; stockQuantity: number; category?: string }, 
    onFail?: (msg: string) => void, 
    onSuccess?: () => void
  ) => {
    let quantityExceeded = false;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id && item.type === "product");
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          quantityExceeded = true;
          return prev;
        }
        return prev.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { 
        id: Date.now(), 
        productId: product.id, 
        name: product.name, 
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price, 
        quantity: 1, 
        type: "product" 
      }];
    });
    if (quantityExceeded) {
      if (onFail) onFail("الكمية المطلوبة غير متوفرة");
    } else {
      if (onSuccess) onSuccess();
    }
  }, []);

  return {
    cart, setCart,
    discountType, setDiscountType,
    discountInput, setDiscountInput,
    discountAmount, setDiscountAmount,
    discountPercent, setDiscountPercent,
    isDiscountOpen, setIsDiscountOpen,
    paymentMethod, setPaymentMethod,
    paidAmount, setPaidAmount,
    heldInvoices, setHeldInvoices,
    isHoldOpen, setIsHoldOpen,
    subtotal, effectiveDiscount, total, change,
    updateQuantity, removeFromCart, clearCart,
    applyDiscount, removeDiscount,
    holdInvoice, resumeHeld, deleteHeld, addToCart
  };
}
