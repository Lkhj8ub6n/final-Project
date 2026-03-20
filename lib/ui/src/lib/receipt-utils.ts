import { type CartItem } from "../hooks/use-pos-cart";

export interface ReceiptData {
  id: number | string;
  items: Array<{
    name?: string;
    productName?: string;
    quantity: number;
    price?: number;
    unitPrice?: number;
  }>;
  total: number;
  discount?: number;
  paymentMethod?: "cash" | "card";
  paidAmount?: number;
  title?: string;
}

export function buildReceiptHtml(data: ReceiptData): string {
  const { id, items, total, discount = 0, paymentMethod, paidAmount, title } = data;
  
  return `
    <div style="font-family:sans-serif;direction:rtl;padding:24px;max-width:320px;margin:auto;color:#000">
      <h1 style="text-align:center;font-size:20px;border-bottom:2px solid #000;padding-bottom:8px">LibraryOS</h1>
      <p style="text-align:center;color:#555;margin:4px 0">إيصال رقم #${id} ${title ? `— ${title}` : ""}</p>
      <p style="text-align:center;color:#888;font-size:12px">${new Date().toLocaleString("ar-JO")}</p>
      <table style="width:100%;margin:12px 0;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid #000">
            <th style="text-align:right;padding:4px">المنتج</th>
            <th style="text-align:center;padding:4px">الكمية</th>
            <th style="text-align:left;padding:4px">السعر</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((i) => {
            const name = i.name || i.productName || "منتج";
            const price = i.price || i.unitPrice || 0;
            return `
              <tr style="border-bottom:1px dashed #ccc">
                <td style="padding:4px">${name}</td>
                <td style="text-align:center;padding:4px">${i.quantity}</td>
                <td style="text-align:left;padding:4px">${(price * i.quantity).toFixed(3)} د.أ</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      <div style="border-top:2px solid #000;padding-top:8px">
        ${discount > 0 ? `
          <div style="display:flex;justify-content:space-between;color:#888">
            <span>المجموع</span>
            <span>${(total + discount).toFixed(3)} د.أ</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#e53">
            <span>خصم</span>
            <span>-${discount.toFixed(3)} د.أ</span>
          </div>
        ` : ""}
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px">
          <span>الإجمالي</span>
          <span>${total.toFixed(3)} د.أ</span>
        </div>
        ${paidAmount !== undefined ? `
          <div style="display:flex;justify-content:space-between;color:#555">
            <span>المدفوع</span>
            <span>${paidAmount.toFixed(3)} د.أ</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#2a2">
            <span>الباقي</span>
            <span>${(paidAmount - total).toFixed(3)} د.أ</span>
          </div>
        ` : ""}
        ${paymentMethod ? `
          <div style="display:flex;justify-content:space-between;color:#555;font-size:13px">
            <span>طريقة الدفع</span>
            <span>${paymentMethod === "cash" ? "نقدي" : "بطاقة"}</span>
          </div>
        ` : ""}
      </div>
      <div style="text-align:center;margin-top:20px;color:#888;font-size:12px">شكراً لزيارتكم</div>
    </div>`;
}
