import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useGetSalesReport, useGetTopProducts, useGetPaymentMethodsReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, Package } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981"];

export default function TenantReports() {
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year">("month");
  const { data: salesReport } = useGetSalesReport({ period });
  const { data: topProducts } = useGetTopProducts({ period, limit: 5 });
  const { data: paymentReport } = useGetPaymentMethodsReport({ period });

  const periodLabels = { day: "اليوم", week: "الأسبوع", month: "الشهر", year: "السنة" };

  const paymentChartData = paymentReport ? [
    { name: "نقدي", value: paymentReport.cashCount || 0 },
    { name: "بطاقة", value: paymentReport.cardCount || 0 },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold">التقارير والإحصائيات</h2>
            <p className="text-muted-foreground mt-1">تحليل مبيعات وأداء المكتبة</p>
          </div>
          <div className="flex gap-2 bg-white rounded-xl border border-border/50 p-1 shadow-sm">
            {(["day", "week", "month", "year"] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${period === p ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"}`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "إجمالي المبيعات", value: `${salesReport?.totalSales?.toFixed(3) || "0.000"} د.أ`, icon: DollarSign, color: "bg-primary/10 text-primary" },
            { title: "عدد الفواتير", value: salesReport?.totalInvoices?.toString() || "0", icon: ShoppingBag, color: "bg-blue-100 text-blue-600" },
            { title: "متوسط الفاتورة", value: `${salesReport?.averageInvoice?.toFixed(3) || "0.000"} د.أ`, icon: TrendingUp, color: "bg-purple-100 text-purple-600" },
            { title: "إجمالي المبيعات بالكمية", value: salesReport?.totalItemsSold?.toString() || "0", icon: Package, color: "bg-amber-100 text-amber-600" },
          ].map(s => (
            <Card key={s.title} className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color} mb-4`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">{s.title}</p>
                <h3 className="text-2xl font-display font-bold mt-1">{s.value}</h3>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Over Time */}
          <Card className="lg:col-span-2 border-0 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="font-display text-lg">المبيعات عبر الزمن</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesReport?.salesByPeriod || []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="font-display text-lg">طرق الدفع</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center justify-center h-[290px]">
              {paymentChartData.every(d => d.value === 0) ? (
                <p className="text-muted-foreground text-sm">لا توجد بيانات</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                      {paymentChartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="font-display text-lg">أكثر المنتجات مبيعاً</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {!topProducts?.length ? (
              <p className="text-muted-foreground text-center py-8">لا توجد بيانات للفترة المحددة</p>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} width={150} />
                    <Tooltip contentStyle={{ borderRadius: "8px" }} />
                    <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
