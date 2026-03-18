import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Save, Settings2, Store, Bell, CreditCard } from "lucide-react";

export default function TenantSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();

  const [form, setForm] = useState({
    libraryName: "", address: "", phone: "", whatsappNumber: "",
    defaultStockAlertThreshold: 5, acceptCashPayment: true,
    acceptCardPayment: true, allowStudentRegistration: false,
    requireOrderApproval: false, lowStockNotificationEnabled: true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        libraryName: settings.libraryName || "",
        address: (settings as any).address || "",
        phone: (settings as any).phone || "",
        whatsappNumber: (settings as any).whatsappNumber || "",
        defaultStockAlertThreshold: settings.defaultStockAlertThreshold ?? 5,
        acceptCashPayment: settings.acceptCashPayment ?? true,
        acceptCardPayment: settings.acceptCardPayment ?? true,
        allowStudentRegistration: (settings as any).allowStudentRegistration ?? false,
        requireOrderApproval: (settings as any).requireOrderApproval ?? false,
        lowStockNotificationEnabled: (settings as any).lowStockNotificationEnabled ?? true,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ data: form });
      toast({ title: "تم الحفظ", description: "تم تحديث إعدادات المكتبة بنجاح" });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h2 className="text-2xl font-display font-bold">إعدادات المكتبة</h2>
          <p className="text-muted-foreground mt-1">تخصيص إعدادات مكتبتك والمتجر الإلكتروني</p>
        </div>

        {/* Basic Info */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-display text-lg">معلومات المكتبة</CardTitle>
                <CardDescription>البيانات الأساسية التي تظهر للطلاب</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">اسم المكتبة</Label>
                <Input value={form.libraryName} onChange={e => setForm({...form, libraryName: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">رقم الهاتف</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="rounded-xl" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">واتساب</Label>
                <Input value={form.whatsappNumber} onChange={e => setForm({...form, whatsappNumber: e.target.value})} placeholder="962791234567" className="rounded-xl" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">حد تنبيه المخزون الافتراضي</Label>
                <Input type="number" value={form.defaultStockAlertThreshold} onChange={e => setForm({...form, defaultStockAlertThreshold: parseInt(e.target.value) || 0})} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">العنوان</Label>
              <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="rounded-xl" />
            </div>
          </CardContent>
        </Card>

        {/* Payment Settings */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="font-display text-lg">طرق الدفع</CardTitle>
                <CardDescription>إعدادات الدفع في نقطة البيع</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {[
              { key: "acceptCashPayment", label: "قبول الدفع النقدي", desc: "قبول المدفوعات النقدية في الكاشير" },
              { key: "acceptCardPayment", label: "قبول البطاقات البنكية", desc: "قبول الدفع بالبطاقة الائتمانية/الخصم" },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-border/50">
                <div>
                  <p className="font-bold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <Switch
                  checked={(form as any)[item.key]}
                  onCheckedChange={v => setForm({...form, [item.key]: v})}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Store Settings */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="font-display text-lg">إعدادات المتجر</CardTitle>
                <CardDescription>تحكم في سلوك المتجر الإلكتروني</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {[
              { key: "allowStudentRegistration", label: "السماح بتسجيل الطلاب", desc: "يمكن للطلاب الجدد إنشاء حسابات" },
              { key: "requireOrderApproval", label: "تأكيد الطلبات يدوياً", desc: "مراجعة وتأكيد كل طلب قبل التجهيز" },
              { key: "lowStockNotificationEnabled", label: "تنبيهات نقص المخزون", desc: "إشعار تلقائي عند وصول المخزون للحد الأدنى" },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-border/50">
                <div>
                  <p className="font-bold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <Switch
                  checked={(form as any)[item.key]}
                  onCheckedChange={v => setForm({...form, [item.key]: v})}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={updateMutation.isPending} className="h-12 px-8 font-bold rounded-xl shadow-md shadow-primary/20 text-base">
          <Save className="w-5 h-5 me-2" />
          {updateMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </Button>
      </div>
    </DashboardLayout>
  );
}
