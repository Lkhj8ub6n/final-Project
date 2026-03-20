/**
 * Invoice business logic — pure functions extracted for testing.
 * These can be unit tested without a database.
 */

export interface InvoiceItem {
  productId?: number;
  itemType: string;
  quantity: number;
  unitPrice: number;
  productName?: string;
}

export interface InvoiceCalculation {
  subtotal: number;
  discountAmount: number;
  total: number;
}

/**
 * Calculate invoice totals from items and optional discount.
 */
export function calculateInvoice(
  items: InvoiceItem[],
  discountAmount?: number,
  discountPercent?: number,
): InvoiceCalculation {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  let discAmt = discountAmount ?? 0;

  // If discount percent is specified and no flat amount, calculate from percent
  if (discountPercent && !discountAmount) {
    discAmt = subtotal * (discountPercent / 100);
  }

  const total = Math.max(0, subtotal - discAmt);

  return { subtotal, discountAmount: discAmt, total };
}

/**
 * Validate invoice items — returns error message or null if valid.
 */
export function validateInvoiceItems(items: InvoiceItem[]): string | null {
  if (!items || items.length === 0) {
    return "Invoice must have at least one item";
  }

  for (const item of items) {
    if (item.quantity <= 0) {
      return `Item quantity must be positive: ${item.productName || item.productId}`;
    }
    if (item.unitPrice < 0) {
      return `Item price cannot be negative: ${item.productName || item.productId}`;
    }
    if (!item.itemType) {
      return "Item type is required";
    }
  }

  return null;
}

/**
 * Calculate new stock quantity after sale, with alert check.
 */
export function calculateStockAfterSale(
  currentStock: number,
  soldQuantity: number,
  alertThreshold: number,
): { newStock: number; isLowStock: boolean } {
  const newStock = Math.max(0, currentStock - soldQuantity);
  return {
    newStock,
    isLowStock: newStock <= alertThreshold,
  };
}
