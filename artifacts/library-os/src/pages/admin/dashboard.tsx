import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useListTenants, useCreateTenant, useToggleTenantStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Store, LogOut, ToggleLeft, ToggleRight, Users } from "lucide-react";

export default function SuperAdminDashboard() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tenants, isLoading } = useListTenants();
  const createMutation = useCreateTenant();
  const toggleMutation = useToggleTenantStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", address: "", phone: "",
    ownerName: "", ownerEmail: "", ownerPassword: "",
  });

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.ownerEmail || !form.ownerPassword) {
      toast({ title: "خطأ", description: "يرجى تعبئة جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({ data: form });
      toast({ title: "تمت الإضافة", description: `تم إنشاء مكتبة "${form.name}" بنجاح` });
      setIsOpen(false);
      setForm({ name: "", slug: "", address: "", phone: "", ownerName: "", ownerEmail: "", ownerPassword: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleMutation.mutateAsync({ tenantId: id });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-border shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl leading-none">LibraryOS Admin</h1>
              <p className="text-xs text-muted-foreground mt-0.5">لوحة تحكم المنصة</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-muted-foreground hidden sm:block">{user?.name}</span>
            <Button variant="ghost" size="icon" onClick={logout} className="rounded-full text-muted-foreground hover:text-destructive">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "إجمالي المكتبات", value: tenants?.length || 0, icon: Store, color: "bg-primary/10 text-primary" },
            { label: "المكتبات النشطة", value: tenants?.filter((t: any) => t.isActive).length || 0, icon: ToggleRight, color: "bg-green-100 text-green-700" },
            { label: "المكتبات المعلقة", value: tenants?.filter((t: any) => !t.isActive).length || 0, icon: ToggleLeft, color: "bg-amber-100 text-amber-700" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-border/50 shadow-sm p-5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color} mb-4`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <h3 className="text-3xl font-display font-bold mt-1">{s.value}</h3>
            </div>
          ))}
        </div>

        {/* Tenants Table */}
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-border/50">
            <div>
              <h2 className="font-display font-bold text-xl">المكتبات المسجلة</h2>
              <p className="text-sm text-muted-foreground mt-0.5">إدارة جميع مكتبات المنصة</p>
            </div>
            <Button onClick={() => setIsOpen(true)} className="h-10 px-5 font-bold rounded-xl shadow-md shadow-primary/20">
              <Plus className="w-4 h-4 me-2" /> مكتبة جديدة
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !tenants?.length ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Store className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-xl font-bold">لا توجد مكتبات مسجلة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-muted-foreground bg-gray-50/70 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-bold">المكتبة</th>
                    <th className="px-6 py-4 font-bold">المالك</th>
                    <th className="px-6 py-4 font-bold">Slug</th>
                    <th className="px-6 py-4 font-bold">تاريخ التسجيل</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {tenants.map((t: any) => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">{t.ownerName}</div>
                        <div className="text-xs text-muted-foreground">{t.ownerEmail}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{t.slug}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("ar-JO")}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${t.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {t.isActive ? "نشط" : "معلق"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost" size="sm"
                          className={`rounded-lg text-xs font-bold h-8 ${t.isActive ? "text-destructive hover:bg-destructive/10" : "text-green-700 hover:bg-green-50"}`}
                          onClick={() => handleToggle(t.id)}
                          disabled={toggleMutation.isPending}
                        >
                          {t.isActive ? "تعليق" : "تفعيل"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">إضافة مكتبة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">اسم المكتبة *</Label>
                <Input placeholder="مكتبة النور" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Slug (رابط المتجر) *</Label>
                <Input placeholder="al-noor" value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/\s/g, "-")})} className="rounded-xl" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">اسم المالك</Label>
                <Input placeholder="أحمد محمود" value={form.ownerName} onChange={e => setForm({...form, ownerName: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">رقم الهاتف</Label>
                <Input placeholder="0791234567" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="rounded-xl" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">إيميل المالك *</Label>
              <Input type="email" placeholder="owner@library.jo" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail: e.target.value})} className="rounded-xl" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">كلمة مرور المالك *</Label>
              <Input type="password" placeholder="••••••••" value={form.ownerPassword} onChange={e => setForm({...form, ownerPassword: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">العنوان</Label>
              <Input placeholder="عمان، الأردن" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending} className="rounded-xl font-bold px-8">
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء المكتبة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
