import { describe, test, expect } from "vitest";
import {
  calculateInvoice,
  validateInvoiceItems,
  calculateStockAfterSale,
  type InvoiceItem,
} from "../src/lib/invoice-logic";

describe("calculateInvoice", () => {
  test("calculates subtotal from item quantities × prices", () => {
    const items: InvoiceItem[] = [
      { itemType: "product", quantity: 2, unitPrice: 5.0, productName: "Notebook" },
      { itemType: "product", quantity: 1, unitPrice: 3.5, productName: "Pen" },
    ];
    const result = calculateInvoice(items);
    expect(result.subtotal).toBe(13.5);
    expect(result.total).toBe(13.5);
    expect(result.discountAmount).toBe(0);
  });

  test("applies flat discount amount", () => {
    const items: InvoiceItem[] = [
      { itemType: "product", quantity: 3, unitPrice: 10.0 },
    ];
    const result = calculateInvoice(items, 5);
    expect(result.subtotal).toBe(30);
    expect(result.discountAmount).toBe(5);
    expect(result.total).toBe(25);
  });

  test("applies percentage discount when no flat amount", () => {
    const items: InvoiceItem[] = [
      { itemType: "product", quantity: 1, unitPrice: 100.0 },
    ];
    const result = calculateInvoice(items, undefined, 10); // 10%
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(10);
    expect(result.total).toBe(90);
  });

  test("total never goes below zero with excessive discount", () => {
    const items: InvoiceItem[] = [
      { itemType: "product", quantity: 1, unitPrice: 5.0 },
    ];
    const result = calculateInvoice(items, 100); // $100 discount on $5 item
    expect(result.total).toBe(0);
  });

  test("handles empty items array (zero total)", () => {
    const result = calculateInvoice([]);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe("validateInvoiceItems", () => {
  test("returns null for valid items", () => {
    const items: InvoiceItem[] = [
      { itemType: "product", quantity: 1, unitPrice: 10 },
    ];
    expect(validateInvoiceItems(items)).toBeNull();
  });

  test("rejects empty items array", () => {
    expect(validateInvoiceItems([])).toBe("Invoice must have at least one item");
  });

  test("rejects zero quantity", () => {
    const items: InvoiceItem[] = [
      { itemType: "product", quantity: 0, unitPrice: 10, productName: "Test" },
    ];
    expect(validateInvoiceItems(items)).toContain("must be positive");
  });

  test("rejects negative price", () => {
    const items: InvoiceItem[] = [
      { itemType: "product", quantity: 1, unitPrice: -5, productName: "Bad" },
    ];
    expect(validateInvoiceItems(items)).toContain("cannot be negative");
  });

  test("rejects missing item type", () => {
    const items: InvoiceItem[] = [
      { itemType: "", quantity: 1, unitPrice: 10 },
    ];
    expect(validateInvoiceItems(items)).toContain("Item type is required");
  });
});

describe("calculateStockAfterSale", () => {
  test("decrements stock correctly", () => {
    const result = calculateStockAfterSale(50, 3, 10);
    expect(result.newStock).toBe(47);
    expect(result.isLowStock).toBe(false);
  });

  test("flags low stock when at threshold", () => {
    const result = calculateStockAfterSale(15, 5, 10);
    expect(result.newStock).toBe(10);
    expect(result.isLowStock).toBe(true);
  });

  test("flags low stock when below threshold", () => {
    const result = calculateStockAfterSale(15, 10, 10);
    expect(result.newStock).toBe(5);
    expect(result.isLowStock).toBe(true);
  });

  test("never goes below zero", () => {
    const result = calculateStockAfterSale(2, 10, 5);
    expect(result.newStock).toBe(0);
    expect(result.isLowStock).toBe(true);
  });
});
