import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import {
  useListOrders, useGetOrder, useUpdateOrderStatus, useCancelOrder,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Eye, Clock, CheckCircle2, XCircle, Truck, Package, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type OrderStatus = "new" | "preparing" | "ready" | "delivered" | "cancelled";

const statusMap: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  new:        { label: "جديد",            color: "bg-amber-100 text-amber-700 border-amber-200",   icon: Clock },
  preparing:  { label: "قيد التجهيز",    color: "bg-blue-100 text-blue-700 border-blue-200",      icon: Package },
  ready:      { label: "جاهز للاستلام",  color: "bg-purple-100 text-purple-700 border-purple-200", icon: CheckCircle2 },
  delivered:  { label: "تم التسليم",     color: "bg-green-100 text-green-700 border-green-200",   icon: Truck },
  cancelled:  { label: "ملغى",           color: "bg-gray-100 text-gray-600 border-gray-200",      icon: XCircle },
};

const statusFlow: Record<OrderStatus, OrderStatus | null> = {
  new:       "preparing",
  preparing: "ready",
  ready:     "delivered",
  delivered: null,
  cancelled: null,
};

const nextLabel: Record<string, string> = {
  preparing: "بدء التجهيز",
  ready:     "تحديد كجاهز",
  delivered: "تأكيد التسليم",
};

export default function TenantOrders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useListOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { data: selectedOrder, refetch: refetchOrder } = useGetOrder(selectedOrderId!, {
    query: { enabled: !!selectedOrderId } as any,
  });
  const updateStatusMutation = useUpdateOrderStatus();
  const cancelMutation = useCancelOrder();

  const handleUpdateStatus = async (orderId: number, status: OrderStatus) => {
    try {
      await updateStatusMutation.mutateAsync({ orderId, data: { status } });
      toast({ title: "تم تحديث حالة الطلب" });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      refetchOrder();
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const handleCancel = async (orderId: number) => {
    if (!confirm("هل أنت متأكد من إلغاء هذا الطلب؟")) return;
    try {
      await cancelMutation.mutateAsync({ orderId });
      toast({ title: "تم إلغاء الطلب" });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      refetchOrder();
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const order = selectedOrder as any;
  const currentStatus = order?.status as OrderStatus | undefined;
  const nextStatus = currentStatus ? statusFlow[currentStatus] : null;

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <div>
          <h2 className="text-2xl font-display font-bold">طلبات المتجر الإلكتروني</h2>
          <p className="text-muted-foreground mt-1">إدارة وتتبع طلبات الطلاب</p>
        </div>

        {/* Summary chips */}
        {orders && orders.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(statusMap) as OrderStatus[]).map(status => {
              const count = (orders as any[]).filter((o: any) => o.status === status).length;
              if (count === 0) return null;
              const cfg = statusMap[status];
              return (
                <span key={status} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border ${cfg.color}`}>
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !(orders as any[])?.length ? (
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
                  {(orders as any[]).map((o: any) => {
                    const status = statusMap[o.status as OrderStatus] ?? statusMap.new;
                    const StatusIcon = status.icon;
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground">#{o.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold">{o.studentName}</div>
                          <div className="text-xs text-muted-foreground">{o.studentPhone}</div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString("ar-JO")}
                        </td>
                        <td className="px-6 py-4 font-bold text-primary">
                          {Number(o.total).toFixed(3)} د.أ
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${status.color}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setSelectedOrderId(o.id)}>
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

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrderId} onOpenChange={(open) => { if (!open) setSelectedOrderId(null); }}>
        <DialogContent className="sm:max-w-[540px] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">تفاصيل الطلب #{selectedOrderId}</DialogTitle>
          </DialogHeader>
          {order && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground font-bold mb-1">الطالب</p>
                  <p className="font-bold">{order.studentName}</p>
                  <p className="text-sm text-muted-foreground">{order.studentPhone}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-border/50">
                  <p className="text-xs text-muted-foreground font-bold mb-1">الحالة الحالية</p>
                  {currentStatus && (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${statusMap[currentStatus].color}`}>
                      {statusMap[currentStatus].label}
                    </span>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(order.createdAt).toLocaleDateString("ar-JO")}</p>
                </div>
              </div>

              {/* Status flow progress */}
              {currentStatus && currentStatus !== "cancelled" && (
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  {(["new", "preparing", "ready", "delivered"] as OrderStatus[]).map((s, idx, arr) => {
                    const statuses: OrderStatus[] = ["new", "preparing", "ready", "delivered"];
                    const currentIdx = statuses.indexOf(currentStatus);
                    const isCompleted = statuses.indexOf(s) <= currentIdx;
                    const isLast = idx === arr.length - 1;
                    return (
                      <React.Fragment key={s}>
                        <div className={`flex flex-col items-center gap-1 ${isCompleted ? "text-primary" : "text-muted-foreground/40"}`}>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${isCompleted ? "border-primary bg-primary text-white" : "border-muted-foreground/30 bg-white"}`}>
                            {isCompleted ? "✓" : idx + 1}
                          </div>
                          <span className="text-[10px] font-bold whitespace-nowrap">{statusMap[s].label}</span>
                        </div>
                        {!isLast && <div className={`flex-1 h-0.5 min-w-4 mb-4 ${statuses.indexOf(s) < currentIdx ? "bg-primary" : "bg-gray-200"}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {order.notes && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-700 mb-1">ملاحظات الطالب</p>
                  <p className="text-sm">{order.notes}</p>
                </div>
              )}

              <div className="border border-border/50 rounded-xl overflow-hidden">
                <div className="bg-gray-50/70 px-4 py-2.5 border-b border-border/50">
                  <p className="text-xs font-bold text-muted-foreground">المنتجات</p>
                </div>
                <div className="divide-y divide-border/40">
                  {order.items?.map((item: any, i: number) => (
                    <div key={i} className="px-4 py-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">الكمية: {item.quantity}</p>
                      </div>
                      <p className="font-bold text-primary">{Number(item.total).toFixed(3)} د.أ</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-gray-50/70 border-t border-border/50 flex justify-between items-center">
                  <p className="font-bold">الإجمالي</p>
                  <p className="font-bold text-lg text-primary">{Number(order.total).toFixed(3)} د.أ</p>
                </div>
              </div>

              {/* Action Buttons */}
              {currentStatus && currentStatus !== "delivered" && currentStatus !== "cancelled" && (
                <div className="flex gap-3 pt-2">
                  {nextStatus && (
                    <Button
                      className="flex-1 h-11 font-bold rounded-xl gap-2"
                      onClick={() => handleUpdateStatus(order.id, nextStatus)}
                      disabled={updateStatusMutation.isPending}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {nextLabel[nextStatus] ?? nextStatus}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="h-11 px-4 rounded-xl font-bold text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => handleCancel(order.id)}
                    disabled={cancelMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 me-1" /> إلغاء
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
