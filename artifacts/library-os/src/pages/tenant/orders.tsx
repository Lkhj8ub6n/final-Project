import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useListOrders, useGetOrder } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Eye, Clock, CheckCircle2, XCircle, Truck, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const statusMap: Record<string, { label: string; color: string; icon: any }> = {
  pending:    { label: "قيد الانتظار", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  confirmed:  { label: "مؤكد", color: "bg-blue-100 text-blue-700 border-blue-200", icon: CheckCircle2 },
  ready:      { label: "جاهز للاستلام", color: "bg-purple-100 text-purple-700 border-purple-200", icon: Package },
  delivered:  { label: "تم التسليم", color: "bg-green-100 text-green-700 border-green-200", icon: Truck },
  cancelled:  { label: "ملغى", color: "bg-gray-100 text-gray-600 border-gray-200", icon: XCircle },
};

export default function TenantOrders() {
  const { data: orders, isLoading } = useListOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { data: selectedOrder } = useGetOrder(selectedOrderId!, { query: { enabled: !!selectedOrderId } });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold">طلبات المتجر الإلكتروني</h2>
          <p className="text-muted-foreground mt-1">إدارة وتتبع طلبات الطلاب</p>
        </div>

        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !orders?.length ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <ShoppingBag className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-xl font-bold">لا توجد طلبات بعد</p>
              <p className="text-sm mt-2">ستظهر هنا طلبات الطلاب من المتجر الإلكتروني</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-muted-foreground bg-gray-50/70 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-bold">رقم الطلب</th>
                    <th className="px-6 py-4 font-bold">الطالب</th>
                    <th className="px-6 py-4 font-bold">التاريخ</th>
                    <th className="px-6 py-4 font-bold">الإجمالي</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {orders.map((order: any) => {
                    const status = statusMap[order.status] || statusMap.pending;
                    const StatusIcon = status.icon;
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground">#{order.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground">{order.customerPhone}</div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("ar-JO")}
                        </td>
                        <td className="px-6 py-4 font-bold text-primary">
                          {parseFloat(order.total).toFixed(3)} د.أ
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${status.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSelectedOrderId(order.id)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selectedOrderId} onOpenChange={(o) => !o && setSelectedOrderId(null)}>
        <DialogContent className="sm:max-w-[520px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">تفاصيل الطلب #{selectedOrderId}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground font-bold mb-1">الطالب</p>
                  <p className="font-bold">{selectedOrder.customerName}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customerPhone}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground font-bold mb-1">الحالة</p>
                  <p className="font-bold">{statusMap[selectedOrder.status]?.label}</p>
                  <p className="text-sm text-muted-foreground">{new Date(selectedOrder.createdAt).toLocaleDateString("ar-JO")}</p>
                </div>
              </div>
              {selectedOrder.notes && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-700 mb-1">ملاحظات</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
                </div>
              )}
              <div className="border border-border/50 rounded-xl overflow-hidden">
                <div className="bg-gray-50/70 px-4 py-2.5 border-b border-border/50">
                  <p className="text-xs font-bold text-muted-foreground">المنتجات</p>
                </div>
                <div className="divide-y divide-border/40">
                  {selectedOrder.items?.map((item: any, i: number) => (
                    <div key={i} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">الكمية: {item.quantity}</p>
                      </div>
                      <p className="font-bold text-primary">{parseFloat(item.subtotal).toFixed(3)} د.أ</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-gray-50/70 border-t border-border/50 flex justify-between items-center">
                  <p className="font-bold">الإجمالي</p>
                  <p className="font-bold text-lg text-primary">{parseFloat(selectedOrder.total).toFixed(3)} د.أ</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
