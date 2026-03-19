import React, { useState } from "react";
import { AdminLayout } from "@/components/layouts";
import { useListTenants, useCreateTenant, useToggleTenantStatus, useUpdateTenant } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Building2, Search, ExternalLink,
  ToggleLeft, ToggleRight, Pencil
} from "lucide-react";

interface Tenant {
  id: number;
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  ownerName?: string;
  ownerEmail?: string;
  isActive: boolean;
  createdAt: string;
}

const emptyForm = { name: "", slug: "", address: "", phone: "", ownerName: "", ownerEmail: "", ownerPassword: "" };
const emptyEditForm = { name: "", address: "", phone: "" };

export default function AdminLibraries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tenants, isLoading } = useListTenants();
  const createMutation = useCreateTenant();
  const toggleMutation = useToggleTenantStatus();
  const updateMutation = useUpdateTenant();

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const filtered = (tenants as Tenant[] | undefined)?.filter(t =>
    t.name.includes(search) || t.slug.includes(search) || (t.ownerEmail ?? "").includes(search)
  ) ?? [];

  const handleCreate = async () => {
    if (!form.name || !form.slug || !form.ownerEmail || !form.ownerPassword) {
      toast({ title: "خطأ", description: "يرجى تعبئة جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({ data: form });
      toast({ title: "تمت الإضافة", description: `تم إنشاء مكتبة "${form.name}" بنجاح` });
      setIsCreateOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleMutation.mutateAsync({ tenantId: id });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  const openEdit = (t: Tenant) => {
    setEditTarget(t);
    setEditForm({ name: t.name, address: t.address ?? "", phone: t.phone ?? "" });
  };

  const handleEdit = async () => {
    if (!editTarget || !editForm.name) return;
    try {
      await updateMutation.mutateAsync({ tenantId: editTarget.id, data: editForm });
      toast({ title: "تم التعديل", description: `تم تعديل بيانات "${editForm.name}"` });
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
    } catch (err) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : "حدث خطأ", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold">المكتبات</h2>
            <p className="text-muted-foreground mt-0.5">إدارة جميع مكتبات المنصة</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="h-11 px-6 font-bold rounded-xl shadow-md shadow-primary/20 gap-2">
            <Plus className="w-4 h-4" /> مكتبة جديدة
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث بالاسم أو Slug أو البريد..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pe-10 rounded-xl h-11"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Building2 className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-xl font-bold">لا توجد نتائج</p>
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
                  {filtered.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-bold">{t.name}</div>
                            {t.phone && <div className="text-xs text-muted-foreground">{t.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {t.ownerName && <div className="font-medium">{t.ownerName}</div>}
                        {t.ownerEmail && <div className="text-xs text-muted-foreground">{t.ownerEmail}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded-lg">{t.slug}</span>
                          <a
                            href={`/store/${t.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 transition-colors"
                            title="عرض المتجر"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">
                        {new Date(t.createdAt).toLocaleDateString("ar-JO")}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${t.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {t.isActive ? "نشطة" : "معلقة"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost" size="icon"
                            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(t)}
                            title="تعديل"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className={`rounded-lg text-xs font-bold h-8 px-3 gap-1 ${t.isActive ? "text-destructive hover:bg-destructive/10" : "text-green-700 hover:bg-green-50"}`}
                            onClick={() => handleToggle(t.id)}
                            disabled={toggleMutation.isPending}
                          >
                            {t.isActive
                              ? <><ToggleLeft className="w-3.5 h-3.5" /> تعليق</>
                              : <><ToggleRight className="w-3.5 h-3.5" /> تفعيل</>}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination hint */}
        {filtered.length > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            عرض {filtered.length} مكتبة{search ? ` من أصل ${tenants?.length ?? 0}` : ""}
          </p>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">إضافة مكتبة جديدة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">اسم المكتبة *</Label>
                <Input placeholder="مكتبة النور" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Slug *</Label>
                <Input placeholder="al-noor" value={form.slug} dir="ltr"
                  onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s/g, "-") })}
                  className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">اسم المالك</Label>
                <Input placeholder="أحمد محمود" value={form.ownerName} onChange={e => setForm({ ...form, ownerName: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">رقم الهاتف</Label>
                <Input placeholder="0791234567" dir="ltr" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">إيميل المالك *</Label>
              <Input type="email" placeholder="owner@library.jo" dir="ltr" value={form.ownerEmail} onChange={e => setForm({ ...form, ownerEmail: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">كلمة مرور المالك *</Label>
              <Input type="password" placeholder="••••••••" value={form.ownerPassword} onChange={e => setForm({ ...form, ownerPassword: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">العنوان</Label>
              <Input placeholder="عمان، الأردن" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="rounded-xl font-bold px-8">
              {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء المكتبة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">تعديل المكتبة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold">اسم المكتبة *</Label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">رقم الهاتف</Label>
              <Input dir="ltr" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">العنوان</Label>
              <Input value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setEditTarget(null)} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending} className="rounded-xl font-bold px-8">
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
