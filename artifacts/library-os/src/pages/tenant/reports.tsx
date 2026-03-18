import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useGetSalesReport, useGetTopProducts, useGetPaymentMethodsReport, GetSalesReportPeriod } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, Package } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981"];

const periodMap = {
  daily: { label: "يومي", value: GetSalesReportPeriod.daily },
  weekly: { label: "أسبوعي", value: GetSalesReportPeriod.weekly },
  monthly: { label: "شهري", value: GetSalesReportPeriod.monthly },
} as const;

export default function TenantReports() {
  const [period, setPeriod] = useState<typeof GetSalesReportPeriod[keyof typeof GetSalesReportPeriod]>(GetSalesReportPeriod.monthly);

  const { data: salesReport } = useGetSalesReport({ period });
  const { data: topProducts } = useGetTopProducts({ limit: 5 });
  const { data: paymentReport } = useGetPaymentMethodsReport();

  const paymentChartData = paymentReport
    ? [
        { name: "نقدي", value: paymentReport.cashTotal || 0 },
        { name: "بطاقة", value: paymentReport.cardTotal || 0 },
      ]
    : [];

  const topProductsChartData = topProducts?.map(p => ({
    name: p.productName.slice(0, 20),
    quantity: p.quantitySold,
  })) ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold">التقارير والإحصائيات</h2>
            <p className="text-muted-foreground mt-1">تحليل مبيعات وأداء المكتبة</p>
          </div>
          <div className="flex gap-2 bg-white rounded-xl border border-border/50 p-1 shadow-sm">
            {Object.entries(periodMap).map(([key, { label, value }]) => (
              <button
                key={key}
                onClick={() => setPeriod(value)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  period === value ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: "إجمالي المبيعات", value: `${salesReport?.totalSales?.toFixed(3) ?? "0.000"} د.أ`, icon: DollarSign, color: "bg-primary/10 text-primary" },
            { title: "عدد الفواتير", value: salesReport?.totalInvoices?.toString() ?? "0", icon: ShoppingBag, color: "bg-blue-100 text-blue-600" },
            { title: "الدفع النقدي", value: `${paymentReport?.cashTotal?.toFixed(3) ?? "0.000"} د.أ`, icon: TrendingUp, color: "bg-purple-100 text-purple-600" },
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
                  <AreaChart
                    data={salesReport?.data ?? []}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
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
                    <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
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
                    <Tooltip formatter={(val: number) => `${val.toFixed(3)} د.أ`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {paymentReport && (
                <div className="grid grid-cols-2 gap-3 w-full mt-3">
                  <div className="text-center p-2 bg-primary/5 rounded-xl">
                    <p className="text-xs text-muted-foreground">نقدي</p>
                    <p className="font-bold text-primary">{paymentReport.cashPercent?.toFixed(1)}%</p>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-xl">
                    <p className="text-xs text-muted-foreground">بطاقة</p>
                    <p className="font-bold text-blue-600">{paymentReport.cardPercent?.toFixed(1)}%</p>
                  </div>
                </div>
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
            {!topProductsChartData.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mb-3 opacity-30" />
                <p>لا توجد بيانات للفترة المحددة</p>
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsChartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600 }} width={160} />
                    <Tooltip contentStyle={{ borderRadius: "8px" }} />
                    <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        {salesReport?.categoryBreakdown && salesReport.categoryBreakdown.length > 0 && (
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader className="border-b border-border/50 pb-4">
              <CardTitle className="font-display text-lg">المبيعات حسب الفئة</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {salesReport.categoryBreakdown.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-4">
                    <span className="text-sm font-bold w-32 shrink-0">{cat.category}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-primary w-20 text-left">{cat.sales.toFixed(3)} د.أ</span>
                    <span className="text-xs text-muted-foreground w-12 text-left">{cat.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
