import React from "react";
import { DashboardLayout } from "@/components/layouts";
import {
  useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, BellOff, ShoppingBag, AlertCircle, CheckCircle2,
  Package, Info, CheckCheck,
} from "lucide-react";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  referenceId?: number | null;
  createdAt: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  new_order:       { icon: ShoppingBag, color: "bg-blue-100 text-blue-700" },
  order_delivered: { icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  low_stock:       { icon: AlertCircle, color: "bg-amber-100 text-amber-700" },
  out_of_stock:    { icon: Package, color: "bg-red-100 text-red-700" },
  system:          { icon: Info, color: "bg-gray-100 text-gray-700" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

export default function TenantNotifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useListNotifications();
  const readMutation = useMarkNotificationRead();
  const readAllMutation = useMarkAllNotificationsRead();

  const notifs = (notifications as Notification[] | undefined) ?? [];
  const unreadCount = notifs.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: number) => {
    try {
      await readMutation.mutateAsync({ notificationId: id });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await readAllMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "تم تحديد الكل كمقروء" });
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold flex items-center gap-3">
              الإشعارات
              {unreadCount > 0 && (
                <span className="bg-primary text-primary-foreground text-sm font-bold px-2.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h2>
            <p className="text-muted-foreground mt-1">جميع تنبيهات المكتبة والطلبات</p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              className="h-10 px-5 rounded-xl font-bold gap-2"
              onClick={handleMarkAllRead}
              disabled={readAllMutation.isPending}
            >
              <CheckCheck className="w-4 h-4" />
              {readAllMutation.isPending ? "جاري..." : "تحديد الكل كمقروء"}
            </Button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <BellOff className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-xl font-bold">لا توجد إشعارات</p>
              <p className="text-sm mt-2">ستظهر هنا الإشعارات المتعلقة بمكتبتك</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifs.map((n) => {
                const cfg = typeConfig[n.type] ?? typeConfig.system;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && handleMarkRead(n.id)}
                    className={`flex items-start gap-4 px-6 py-5 transition-all ${n.isRead ? "bg-white" : "bg-primary/[0.02] hover:bg-primary/[0.04] cursor-pointer"}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`font-bold text-sm ${n.isRead ? "text-foreground" : "text-foreground"}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 bg-primary rounded-full shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{n.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
