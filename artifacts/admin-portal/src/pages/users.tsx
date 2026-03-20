import React, { useState } from "react";
import { AdminLayout } from "@/components/layout";
import { useListStaff, useCreateStaff, useToggleStaffStatus, useUpdateStaff } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus, Users, Search, ToggleLeft, ToggleRight, Pencil
} from "lucide-react";

const emptyForm = { name: "", username: "", email: "", password: "", role: "admin", status: "active" as const };
const emptyEditForm = { name: "", username: "", email: "", role: "admin" };

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: staffData, isLoading } = useListStaff();
  const createMutation = useCreateStaff();
  const toggleMutation = useToggleStaffStatus();
  const updateMutation = useUpdateStaff();

  const staff = (staffData as any[]) ?? [];

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyEditForm);

  const filtered = staff.filter((s: any) =>
    s.name.includes(search) || s.email.includes(search) || s.role.includes(search)
  );

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.username || !form.password) {
      toast({ title: "خطأ", description: "يرجى تعبئة جميع الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({ data: form });
      toast({ title: "تمت الإضافة", description: `تم إنشاء المستخدم "${form.name}" بنجاح` });
      setIsCreateOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
    } catch (err: any) {
      toast({ title: "خطأ", description: err instanceof Error ? err.message : err.response?.data?.error || "حدث خطأ", variant: "destructive" });
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleMutation.mutateAsync({ staffId: id });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
    } catch (err) {
      toast({ title: "خطأ", description: "حدث خطأ أثناء تعديل الحالة", variant: "destructive" });
    }
  };

  const openEdit = (s: any) => {
    setEditTarget(s);
    setEditForm({ name: s.name, username: s.username, email: s.email, role: s.role });
  };

  const handleEdit = async () => {
    if (!editTarget || !editForm.name || !editForm.email || !editForm.username) return;
    try {
      await updateMutation.mutateAsync({ staffId: editTarget.id, data: editForm });
      toast({ title: "تم التعديل", description: `تم حفظ بيانات "${editForm.name}"` });
      setEditTarget(null);
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
    } catch (err) {
      toast({ title: "خطأ", description: "فشل التعديل", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6" dir="rtl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold">المستخدمين</h2>
            <p className="text-muted-foreground mt-0.5">إدارة حسابات النظام (المشرفين والصيادلة)</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="h-11 px-6 font-bold rounded-xl shadow-md shadow-primary/20 gap-2">
            <Plus className="w-4 h-4" /> إضافة مستخدم
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="ابحث بالاسم، البريد، أو الصلاحية..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pe-10 rounded-xl h-11"
          />
        </div>

        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center items-center p-16">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Users className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-xl font-bold">لا توجد نتائج</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="text-xs text-muted-foreground bg-gray-50/70 border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4 font-bold">المستخدم</th>
                    <th className="px-6 py-4 font-bold">البريد الإلكتروني</th>
                    <th className="px-6 py-4 font-bold">الصلاحية</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div className="font-bold">{s.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4" dir="ltr">{s.email}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded-lg">
                          {s.role === 'super_admin' ? 'إدارة عليا' : s.role === 'admin' ? 'مدير المكتبة' : 'صراف'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${s.status === 'active' ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                          {s.status === 'active' ? "فعال" : "معلق"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            variant="ghost" size="icon"
                            className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(s)}
                            title="تعديل"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className={`rounded-lg text-xs font-bold h-8 px-3 gap-1 ${s.status === 'active' ? "text-destructive hover:bg-destructive/10" : "text-green-700 hover:bg-green-50"}`}
                            onClick={() => handleToggle(s.id)}
                            disabled={toggleMutation.isPending}
                          >
                            {s.status === 'active'
                              ? <><ToggleLeft className="w-3.5 h-3.5" /> إيقاف</>
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
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl" dir="rtl">
          <DialogHeader><DialogTitle className="font-display text-xl">إضافة مستخدم</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold">اسم المستخدم *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">اسم المستخدم لدخول النظام (Username) *</Label>
              <Input dir="ltr" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">البريد الإلكتروني *</Label>
              <Input type="email" dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">كلمة المرور *</Label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">الصلاحية *</Label>
              <select 
                value={form.role} 
                onChange={(e) => setForm({...form, role: e.target.value as any})}
                className="w-full h-10 px-3 border border-input rounded-xl bg-background"
              >
                <option value="super_admin">إدارة عليا</option>
                <option value="admin">مدير المكتبة</option>
                <option value="cashier">صراف</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} className="rounded-xl font-bold px-8">إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl" dir="rtl">
          <DialogHeader><DialogTitle className="font-display text-xl">تعديل مستخدم</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold">الاسم *</Label>
              <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">اسم المستخدم (Username) *</Label>
              <Input dir="ltr" value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">البريد الإلكتروني *</Label>
              <Input dir="ltr" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">الصلاحية *</Label>
              <select 
                value={editForm.role} 
                onChange={(e) => setEditForm({...editForm, role: e.target.value as any})}
                className="w-full h-10 px-3 border border-input rounded-xl bg-background"
              >
                <option value="super_admin">إدارة عليا</option>
                <option value="admin">مدير المكتبة</option>
                <option value="cashier">صراف</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setEditTarget(null)} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending} className="rounded-xl font-bold px-8">حفظ التعديلات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
