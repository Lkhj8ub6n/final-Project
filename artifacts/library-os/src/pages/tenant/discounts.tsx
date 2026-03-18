import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import {
  useListDiscounts, useCreateDiscount, useDeleteDiscount,
  CreateDiscountRequestType, CreateDiscountRequestDiscountType,
} from "@workspace/api-client-react";
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

  const today = new Date().toISOString().split("T")[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: CreateDiscountRequestType.invoice as string,
    discountType: CreateDiscountRequestDiscountType.percent as string,
    discountValue: "",
    minInvoiceAmount: "",
    startDate: today,
    endDate: nextMonth,
  });

  const handleSave = async () => {
    if (!form.name || !form.discountValue || !form.startDate || !form.endDate) {
      toast({ title: "خطأ", description: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name,
          type: form.type as typeof CreateDiscountRequestType[keyof typeof CreateDiscountRequestType],
          discountType: form.discountType as typeof CreateDiscountRequestDiscountType[keyof typeof CreateDiscountRequestDiscountType],
          discountValue: parseFloat(form.discountValue),
          minInvoiceAmount: form.minInvoiceAmount ? parseFloat(form.minInvoiceAmount) : undefined,
          startDate: form.startDate,
          endDate: form.endDate,
          isActive: true,
        },
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

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      product: "منتج محدد",
      category: "فئة",
      buy_x_get_y: "اشترِ X احصل على Y",
      invoice: "على الفاتورة",
    };
    return map[type] ?? type;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold">العروض والخصومات</h2>
            <p className="text-muted-foreground mt-1">إنشاء وإدارة الخصومات على الفواتير</p>
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
              <p className="text-sm mt-2">أنشئ خصوماً لتشجيع الطلاب على الشراء</p>
            </div>
          ) : (
            discounts.map((d: any) => (
              <div key={d.id} className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 relative group">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${d.discountType === "percent" ? "bg-primary/10 text-primary" : "bg-green-100 text-green-700"}`}>
                    {d.discountType === "percent" ? <Percent className="w-6 h-6" /> : <BadgeDollarSign className="w-6 h-6" />}
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(d.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <h3 className="font-bold text-foreground mb-1">{d.name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{typeLabel(d.type)}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                  <span className="text-2xl font-display font-bold text-primary">
                    {d.discountType === "percent" ? `${d.discountValue}%` : `${d.discountValue} د.أ`}
                  </span>
                  <div className="text-left text-xs text-muted-foreground">
                    <p>{new Date(d.startDate).toLocaleDateString("ar-JO")}</p>
                    <p>← {new Date(d.endDate).toLocaleDateString("ar-JO")}</p>
                  </div>
                </div>
                {!d.isActive && (
                  <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center">
                    <span className="bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold">غير نشط</span>
                  </div>
                )}
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
            <div className="space-y-2">
              <Label className="font-bold">اسم الخصم *</Label>
              <Input placeholder="خصم العودة للمدارس" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">نوع الخصم</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CreateDiscountRequestType.invoice}>على الفاتورة</SelectItem>
                    <SelectItem value={CreateDiscountRequestType.category}>على فئة</SelectItem>
                    <SelectItem value={CreateDiscountRequestType.product}>على منتج</SelectItem>
                    <SelectItem value={CreateDiscountRequestType.buy_x_get_y}>اشترِ X احصل على Y</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">طريقة الخصم</Label>
                <Select value={form.discountType} onValueChange={v => setForm({ ...form, discountType: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CreateDiscountRequestDiscountType.percent}>نسبة مئوية %</SelectItem>
                    <SelectItem value={CreateDiscountRequestDiscountType.amount}>مبلغ ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">قيمة الخصم *</Label>
                <Input
                  type="number" step="0.01"
                  placeholder={form.discountType === "percent" ? "10" : "1.500"}
                  value={form.discountValue}
                  onChange={e => setForm({ ...form, discountValue: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">أقل مبلغ للفاتورة</Label>
                <Input
                  type="number" step="0.01" placeholder="0"
                  value={form.minInvoiceAmount}
                  onChange={e => setForm({ ...form, minInvoiceAmount: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">تاريخ البدء *</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">تاريخ الانتهاء *</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="rounded-xl" />
              </div>
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
