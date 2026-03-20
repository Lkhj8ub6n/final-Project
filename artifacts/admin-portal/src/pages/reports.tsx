import React, { useState } from "react";
import { AdminLayout } from "@/components/layout";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Banknote, Calendar, BarChart3, Receipt, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/auth-context";

interface PlatformStats {
  totalLibraries: number;
  activeLibraries: number;
  suspendedLibraries: number;
  totalRevenue: number;
  totalStoreOrders: number;
  pendingStoreOrders: number;
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-6">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
      <p className="text-3xl font-display font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function apiBase() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return base.replace(/\/admin-portal$/, "");
}

export default function AdminReports() {
  const [period, setPeriod] = useState("all");

  const { data: stats, isLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/super/stats", period],
    queryFn: async () => {
      const token = getAdminToken();
      // Added period param just for future proofing if backend supports it
      const res = await fetch(`${apiBase()}/api/super/stats?period=${period}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("فشل تحميل الإحصائيات");
      return res.json() as Promise<PlatformStats>;
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold">التقارير المالية</h2>
            <p className="text-muted-foreground mt-0.5">ملخص الأرباح والمبيعات للمنصة بالكامل</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              className="h-11 px-4 border border-input rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="today">اليوم</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
              <option value="all">كل الأوقات</option>
            </select>
            <Button variant="outline" className="h-11 px-4 font-bold rounded-xl gap-2">
              <Download className="w-4 h-4" /> تصدير PDF
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center p-32">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                label="إجمالي الإيرادات"
                value={stats ? `${stats.totalRevenue.toFixed(3)} ד.أ` : "0.000 ד.أ"}
                sub="إجمالي مبيعات جميع المكتبات"
                icon={TrendingUp}
                color="bg-primary/10 text-primary"
              />
              <StatCard
                label="طلبات المتجر"
                value={stats?.totalStoreOrders ?? 0}
                sub="مكتملة ومعلقة"
                icon={ShoppingCart}
                color="bg-blue-100 text-blue-700"
              />
              <StatCard
                label="المكاتب النشطة"
                value={stats?.activeLibraries ?? 0}
                sub="تحقق مبيعات"
                icon={BarChart3}
                color="bg-green-100 text-green-700"
              />
              <StatCard
                label="متوسط مبيعات المكتبة"
                value={stats?.activeLibraries ? `${(stats.totalRevenue / stats.activeLibraries).toFixed(3)} ד.أ` : "0.000 ד.أ"}
                sub="للنشطة فقط"
                icon={Banknote}
                color="bg-purple-100 text-purple-700"
              />
            </div>

            <div className="bg-white rounded-2xl border border-border/50 shadow-sm p-8 flex flex-col items-center justify-center min-h-[400px]">
              <Receipt className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold text-gray-700 mb-2">رسم بياني للإيرادات (قريباً)</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                جاري العمل على إضافة الرسوم البيانية التفصيلية للمبيعات والأرباح اليومية لجميع المكتبات.
              </p>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

// Just a dummy icon for the file since ShoppingCart is not imported at top
function ShoppingCart(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
