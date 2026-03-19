import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface CartItem {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  stockQuantity: number;
  imageUrl?: string | null;
  category: string;
}

interface AddableProduct {
  id: number;
  name: string;
  price: number;
  discountedPrice?: number | null;
  imageUrl?: string | null;
  category: string;
  stockQuantity: number;
}

interface CartContextType {
  items: CartItem[];
  tenantSlug: string | null;
  addItem: (product: AddableProduct, slug: string) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);

  const addItem = useCallback((product: AddableProduct, slug: string) => {
    setItems(prev => {
      if (tenantSlug !== null && tenantSlug !== slug) {
        return [
          {
            productId: product.id,
            name: product.name,
            price: product.discountedPrice ?? product.price,
            quantity: 1,
            stockQuantity: product.stockQuantity,
            imageUrl: product.imageUrl,
            category: product.category,
          },
        ];
      }

      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) return prev;
        return prev.map(i =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.discountedPrice ?? product.price,
          quantity: 1,
          stockQuantity: product.stockQuantity,
          imageUrl: product.imageUrl,
          category: product.category,
        },
      ];
    });
    setTenantSlug(slug);
  }, [tenantSlug]);

  const removeItem = useCallback((productId: number) => {
    setItems(prev => {
      const next = prev.filter(i => i.productId !== productId);
      if (next.length === 0) setTenantSlug(null);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => {
        const next = prev.filter(i => i.productId !== productId);
        if (next.length === 0) setTenantSlug(null);
        return next;
      });
    } else {
      setItems(prev =>
        prev.map(i => {
          if (i.productId !== productId) return i;
          return { ...i, quantity: Math.min(quantity, i.stockQuantity) };
        })
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setTenantSlug(null);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, tenantSlug, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
