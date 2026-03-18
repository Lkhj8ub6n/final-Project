import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useListStaff, useCreateStaff } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, User } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function TenantStaff() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: staff, isLoading } = useListStaff();
  const createMutation = useCreateStaff();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "cashier" });

  const handleSave = async () => {
    if (!form.name || !form.username || !form.password) {
      toast({ title: "خطأ", description: "يرجى تعبئة جميع الحقول", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({ data: form });
      toast({ title: "تمت الإضافة", description: "تم إضافة الموظف بنجاح" });
      setIsOpen(false);
      setForm({ name: "", username: "", password: "", role: "cashier" });
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const roleLabel = (role: string) => {
    if (role === "tenant_admin") return "مدير المكتبة";
    if (role === "cashier") return "كاشير";
    if (role === "student") return "طالب";
    return role;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold">إدارة الموظفين</h2>
            <p className="text-muted-foreground mt-1">إضافة وإدارة حسابات الكاشيرين</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="h-11 px-6 font-bold rounded-xl shadow-md shadow-primary/20">
            <Plus className="w-5 h-5 me-2" /> إضافة موظف
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center p-16">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !staff?.length ? (
            <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
              <Users className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-xl font-bold">لا يوجد موظفون</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {staff.map((s: any) => (
                <div key={s.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-foreground">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.username}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                    s.role === "tenant_admin"
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-blue-100 text-blue-700 border-blue-200"
                  }`}>
                    {roleLabel(s.role)}
                  </span>
                  <span className={`w-2.5 h-2.5 rounded-full ${s.isActive ? "bg-green-500" : "bg-gray-400"}`}></span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">إضافة موظف جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold">الاسم الكامل *</Label>
              <Input placeholder="محمد أحمد" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">اسم المستخدم *</Label>
              <Input placeholder="cashier2" value={form.username} onChange={e => setForm({...form, username: e.target.value})} className="rounded-xl" dir="ltr" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">كلمة المرور *</Label>
              <Input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending} className="rounded-xl font-bold px-8">
              {createMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
