export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  price: number;
  stockQuantity: number;
  stockAlertThreshold: number;
  category: string | null;
  isActive: boolean;
}

export type ShiftSource = "remote" | "local";

export interface Shift {
  id: number;
  source: ShiftSource;
  openingBalance: number;
  closingBalance?: number | null;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string | null;
  staffName?: string;
  totalInvoices?: number;
  totalSales?: number;
  cashSales?: number;
  cardSales?: number;
}

export interface InvoiceItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  itemType: string;
}

export interface Invoice {
  id: number | string;
  total: number;
  discountAmount?: number;
  discountPercent?: number;
  paymentMethod: "cash" | "card";
  items: InvoiceItem[];
  createdAt: string;
  offline?: boolean;
}

export type UpdateStatus = "checking" | "available" | "not-available" | "progress" | "downloaded" | "error";

export interface ElectronAPI {
  isOnline(): Promise<boolean>;
  onConnectivityChange(cb: (online: boolean) => void): () => void;
  getConfig(key: string): Promise<string | null>;
  setConfig(key: string, value: string): Promise<void>;
  login(username: string, password: string, serverUrl: string): Promise<{ user?: User; token?: string; error?: string }>;
  logout(): Promise<void>;
  getProducts(search?: string): Promise<Product[]>;
  syncProducts(): Promise<{ count?: number; error?: string }>;
  getCurrentShift(): Promise<Shift | null>;
  openShift(openingBalance: number): Promise<Shift>;
  closeShift(shiftId: number, closingBalance: number, isRemote: boolean): Promise<Shift>;
  getShiftDetails(shiftId: number, isRemote: boolean): Promise<Shift | null>;
  createInvoice(data: { shiftId: number; items: InvoiceItem[]; discountAmount?: number; discountPercent?: number; paymentMethod: "cash" | "card" }): Promise<Invoice>;
  getInvoice(invoiceId: number): Promise<Invoice | null>;
  listInvoices(shiftId: number): Promise<Invoice[]>;
  createReturn(data: { invoiceId: number; items: Array<{ productId?: number; productName?: string; quantity: number; unitPrice: number }>; reason: string; refundMethod: "cash" | "credit" }): Promise<void>;
  getPendingCount(): Promise<number>;
  printReceipt(receiptHtml: string): Promise<void>;
  triggerSync(): Promise<{ ok?: boolean; error?: string }>;
  onSyncStatus(cb: (status: string, pendingCount: number) => void): () => void;
  installUpdate(): void;
  onUpdateStatus(cb: (status: UpdateStatus, data?: unknown) => void): () => void;
}

export interface User {
  id: number;
  name: string;
  username: string;
  role: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
