import React from "react";
import { Link } from "wouter";
import { AdminLayout } from "@/components/layouts";
import { useListTenants } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, CheckCircle2, XCircle, TrendingUp,
  ShoppingBag, Clock, ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlatformStats {
  totalLibraries: number;
  activeLibraries: number;
  suspendedLibraries: number;
  totalRevenue: number;
  totalStoreOrders: number;
  pendingStoreOrders: number;
}

interface Tenant {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  ownerName?: string;
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
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

export default function SuperAdminDashboard() {
  const { data: tenants } = useListTenants();
  const { data: stats } = useQuery<PlatformStats>({
    queryKey: ["/api/super/stats"],
    queryFn: async () => {
      const token = localStorage.getItem("library_token");
      const res = await fetch("/api/super/stats", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("فشل تحميل الإحصائيات");
      return res.json() as Promise<PlatformStats>;
    },
  });

  const recentTenants: Tenant[] = tenants
    ? [...(tenants as Tenant[])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)
    : [];

  return (
    <AdminLayout>
      <div className="space-y-8" dir="rtl">
        <div>
          <h2 className="text-3xl font-display font-bold">مرحباً 👋</h2>
          <p className="text-muted-foreground mt-1 text-lg">إليك ملخص أداء المنصة</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard
            label="إجمالي المكتبات"
            value={stats?.totalLibraries ?? tenants?.length ?? 0}
            icon={Building2}
            color="bg-primary/10 text-primary"
          />
          <StatCard
            label="المكتبات النشطة"
            value={stats?.activeLibraries ?? 0}
            icon={CheckCircle2}
            color="bg-green-100 text-green-700"
          />
          <StatCard
            label="المكتبات المعلقة"
            value={stats?.suspendedLibraries ?? 0}
            icon={XCircle}
            color="bg-amber-100 text-amber-700"
          />
          <StatCard
            label="إجمالي الإيرادات"
            value={stats ? `${stats.totalRevenue.toFixed(3)} د.أ` : "—"}
            sub="مجموع فواتير POS كل المكتبات"
            icon={TrendingUp}
            color="bg-blue-100 text-blue-700"
          />
          <StatCard
            label="طلبات المتجر الإلكتروني"
            value={stats?.totalStoreOrders ?? 0}
            sub="من جميع المكتبات"
            icon={ShoppingBag}
            color="bg-violet-100 text-violet-700"
          />
          <StatCard
            label="طلبات معلقة"
            value={stats?.pendingStoreOrders ?? 0}
            sub="بانتظار المعالجة"
            icon={Clock}
            color="bg-rose-100 text-rose-700"
          />
        </div>

        {/* Recent Libraries */}
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div>
              <h3 className="font-display font-bold text-xl">آخر المكتبات المنضمة</h3>
              <p className="text-sm text-muted-foreground mt-0.5">أحدث المكتبات المسجلة على المنصة</p>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl font-bold gap-2">
              <Link href="/admin/libraries">
                عرض الكل <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
          </div>

          {recentTenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-bold">لا توجد مكتبات بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {recentTenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">{t.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{t.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${t.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                      {t.isActive ? "نشطة" : "معلقة"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString("ar-JO")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
