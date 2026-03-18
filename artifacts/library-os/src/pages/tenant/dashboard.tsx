import React from "react";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, Receipt, ShoppingBag, AlertTriangle, ArrowUpRight, TrendingUp } from "lucide-react";
import { DashboardLayout } from "@/components/layouts";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

// Mock chart data since API only returns top-level stats in this schema
const salesData = [
  { name: 'السبت', total: 120 },
  { name: 'الأحد', total: 150 },
  { name: 'الاثنين', total: 180 },
  { name: 'الثلاثاء', total: 130 },
  { name: 'الأربعاء', total: 210 },
  { name: 'الخميس', total: 250 },
  { name: 'الجمعة', total: 320 },
];

export default function TenantDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        
        {/* Header Section */}
        <div>
          <h2 className="text-3xl font-display font-bold text-foreground">مرحباً بعودتك 👋</h2>
          <p className="text-muted-foreground mt-1 text-lg">إليك ملخص أداء مكتبتك لهذا اليوم.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="مبيعات اليوم" 
            value={stats?.todaySales ? `${stats.todaySales} د.أ` : "0 د.أ"} 
            icon={DollarSign} 
            trend="+12%" 
            color="bg-primary/10 text-primary"
          />
          <StatCard 
            title="الفواتير" 
            value={stats?.todayInvoices?.toString() || "0"} 
            icon={Receipt} 
            trend="+5%" 
            color="bg-blue-500/10 text-blue-600"
          />
          <StatCard 
            title="طلبات المتجر" 
            value={stats?.newOrders?.toString() || "0"} 
            icon={ShoppingBag} 
            trend="جديد" 
            trendUp={true}
            color="bg-amber-500/10 text-amber-600"
          />
          <StatCard 
            title="نواقص المخزون" 
            value={stats?.lowStockProducts?.toString() || "0"} 
            icon={AlertTriangle} 
            trend="تحذير" 
            trendUp={false}
            color="bg-destructive/10 text-destructive"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-0 shadow-lg shadow-black/5 rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-gray-50/50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl text-foreground">المبيعات الأسبوعية</CardTitle>
                  <CardDescription className="text-sm mt-1">إجمالي المبيعات لآخر 7 أيام</CardDescription>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">
                  <TrendingUp className="w-4 h-4" />
                  <span>+18% عن الأسبوع الماضي</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} dx={-10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                      itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                    />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg shadow-black/5 rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="border-b border-border/50 bg-gray-50/50 pb-4">
              <CardTitle className="font-display text-xl text-foreground">المبيعات حسب الفئة</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-center">
              {stats?.salesByCategory && stats.salesByCategory.length > 0 ? (
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.salesByCategory} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="category" type="category" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--foreground))', fontSize: 13, fontWeight: 600}} width={80} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                      <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                    <BarChart className="w-8 h-8 opacity-40" />
                  </div>
                  <p>لا توجد بيانات كافية</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Invoices Table */}
        <Card className="border-0 shadow-lg shadow-black/5 rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-gray-50/50 pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display text-xl text-foreground">أحدث الفواتير</CardTitle>
              <CardDescription className="mt-1">آخر عمليات البيع المسجلة اليوم</CardDescription>
            </div>
            <div className="p-2 bg-white rounded-lg shadow-sm border border-border">
              <Receipt className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="text-xs text-muted-foreground bg-white border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-bold">رقم الفاتورة</th>
                  <th className="px-6 py-4 font-bold">الوقت</th>
                  <th className="px-6 py-4 font-bold">الكاشير</th>
                  <th className="px-6 py-4 font-bold">طريقة الدفع</th>
                  <th className="px-6 py-4 font-bold">القيمة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 bg-white">
                {stats?.recentInvoices?.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">#{inv.id}</td>
                    <td className="px-6 py-4 text-muted-foreground">{new Date(inv.createdAt).toLocaleTimeString('ar-JO')}</td>
                    <td className="px-6 py-4 font-medium">{inv.staffName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${inv.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {inv.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">{inv.total.toFixed(2)} د.أ</td>
                  </tr>
                ))}
                {!stats?.recentInvoices?.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">لا توجد فواتير اليوم بعد</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, icon: Icon, trend, trendUp = true, color }: any) {
  return (
    <Card className="border-0 shadow-lg shadow-black/5 rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-7 h-7" />
          </div>
          <div className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${trendUp ? 'text-green-600 bg-green-50' : 'text-destructive bg-destructive/10'}`}>
            {trend}
            <ArrowUpRight className={`w-3.5 h-3.5 ${!trendUp && 'rotate-90'}`} />
          </div>
        </div>
        <div className="mt-6">
          <p className="text-muted-foreground font-medium text-sm">{title}</p>
          <h3 className="text-3xl font-display font-bold text-foreground mt-1">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
