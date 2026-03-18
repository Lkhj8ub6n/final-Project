import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useListDiscounts, useCreateDiscount, useDeleteDiscount } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Tag, Trash2, Percent, BadgeDollarSign } from "lucide-react";

export default function TenantDiscounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: discounts, isLoading } = useListDiscounts();
  const createMutation = useCreateDiscount();
  const deleteMutation = useDeleteDiscount();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", code: "", type: "percentage", value: "",
    minOrderAmount: "", maxUses: "", expiresAt: "",
  });

  const handleSave = async () => {
    if (!form.name || !form.value) {
      toast({ title: "خطأ", description: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name, code: form.code || undefined, type: form.type,
          value: parseFloat(form.value),
          minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
          maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
          expiresAt: form.expiresAt || undefined,
        }
      });
      toast({ title: "تم إنشاء الخصم" });
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الخصم؟")) return;
    try {
      await deleteMutation.mutateAsync({ discountId: id });
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/discounts"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold">العروض والخصومات</h2>
            <p className="text-muted-foreground mt-1">إنشاء كودات الخصم للطلاب</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="h-11 px-6 font-bold rounded-xl shadow-md shadow-primary/20">
            <Plus className="w-5 h-5 me-2" /> خصم جديد
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-36 bg-white rounded-2xl border border-border/50 animate-pulse" />
            ))
          ) : !discounts?.length ? (
            <div className="col-span-full flex flex-col items-center justify-center p-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
              <Tag className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-xl font-bold">لا توجد خصومات</p>
            </div>
          ) : (
            discounts.map((d: any) => (
              <div key={d.id} className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 relative group">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${d.type === 'percentage' ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700'}`}>
                    {d.type === 'percentage' ? <Percent className="w-6 h-6" /> : <BadgeDollarSign className="w-6 h-6" />}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(d.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <h3 className="font-bold text-foreground mb-1">{d.name}</h3>
                {d.code && (
                  <div className="inline-block bg-gray-100 border border-dashed border-gray-300 px-3 py-1 rounded-lg font-mono text-sm font-bold text-gray-700 mb-2">
                    {d.code}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                  <span className="text-2xl font-display font-bold text-primary">
                    {d.type === 'percentage' ? `${d.value}%` : `${d.value} د.أ`}
                  </span>
                  <div className="text-right">
                    {d.usedCount !== undefined && <p className="text-xs text-muted-foreground">استُخدم {d.usedCount} مرة</p>}
                    {d.expiresAt && <p className="text-xs text-destructive font-bold">{new Date(d.expiresAt).toLocaleDateString("ar-JO")}</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">إنشاء خصم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">اسم الخصم *</Label>
                <Input placeholder="خصم العودة للمدارس" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">كود الخصم</Label>
                <Input placeholder="BACK2SCHOOL" value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} className="rounded-xl font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">نوع الخصم</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">نسبة مئوية %</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">قيمة الخصم *</Label>
                <Input type="number" step="0.01" placeholder={form.type === "percentage" ? "10" : "1.500"} value={form.value} onChange={e => setForm({...form, value: e.target.value})} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">أقل مبلغ للطلب</Label>
                <Input type="number" step="0.01" placeholder="0" value={form.minOrderAmount} onChange={e => setForm({...form, minOrderAmount: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">أقصى عدد استخدامات</Label>
                <Input type="number" placeholder="غير محدود" value={form.maxUses} onChange={e => setForm({...form, maxUses: e.target.value})} className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-bold">تاريخ الانتهاء</Label>
              <Input type="date" value={form.expiresAt} onChange={e => setForm({...form, expiresAt: e.target.value})} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending} className="rounded-xl font-bold px-8">
              {createMutation.isPending ? "جاري الحفظ..." : "إنشاء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
