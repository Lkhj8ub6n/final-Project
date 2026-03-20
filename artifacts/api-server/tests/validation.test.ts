import { describe, it, expect } from "vitest";
import { validateInvoiceItems, InvoiceItem } from "../src/lib/invoice-logic";

describe("Validation Logic", () => {
  describe("Invoice Validation", () => {
    it("should accept valid items", () => {
      const items: InvoiceItem[] = [
        { itemType: "product", quantity: 2, unitPrice: 15.0 },
        { itemType: "product", quantity: 1, unitPrice: 5.5 }
      ];
      expect(validateInvoiceItems(items)).toBeNull();
    });

    it("should reject an empty items array", () => {
      expect(validateInvoiceItems([])).toBe("Invoice must have at least one item");
    });

    it("should reject items with missing type", () => {
      const items: InvoiceItem[] = [
        { itemType: "", quantity: 1, unitPrice: 10.0 }
      ];
      expect(validateInvoiceItems(items)).toContain("Item type is required");
    });

    it("should reject items with zero or negative quantity", () => {
      const items: InvoiceItem[] = [
        { itemType: "product", quantity: 0, unitPrice: 10.0 }
      ];
      expect(validateInvoiceItems(items)).toContain("quantity must be positive");
      
      items[0].quantity = -5;
      expect(validateInvoiceItems(items)).toContain("quantity must be positive");
    });

    it("should reject items with negative price", () => {
      const items: InvoiceItem[] = [
        { itemType: "product", quantity: 2, unitPrice: -5.0 }
      ];
      expect(validateInvoiceItems(items)).toContain("cannot be negative");
    });
  });
});
