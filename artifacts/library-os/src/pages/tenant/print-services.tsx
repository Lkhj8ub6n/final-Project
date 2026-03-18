import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import {
  useListPrintServices, useCreatePrintService, useDeletePrintService,
  CreatePrintServiceRequestPricingType,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2 } from "lucide-react";

export default function TenantPrintServices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: services, isLoading } = useListPrintServices();
  const createMutation = useCreatePrintService();
  const deleteMutation = useDeletePrintService();

  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    pricingType: CreatePrintServiceRequestPricingType.per_page as string,
    price: "",
    paperSize: "",
    colorType: "",
  });

  const handleSave = async () => {
    if (!form.name || !form.price) {
      toast({ title: "خطأ", description: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name,
          pricingType: form.pricingType as typeof CreatePrintServiceRequestPricingType[keyof typeof CreatePrintServiceRequestPricingType],
          price: parseFloat(form.price),
          paperSize: form.paperSize || undefined,
          colorType: form.colorType || undefined,
        },
      });
      toast({ title: "تمت الإضافة" });
      setIsOpen(false);
      setForm({ name: "", pricingType: CreatePrintServiceRequestPricingType.per_page, price: "", paperSize: "", colorType: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/print-services"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد؟")) return;
    try {
      await deleteMutation.mutateAsync({ serviceId: id });
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/print-services"] });
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    }
  };

  const pricingLabel = (type: string) =>
    type === CreatePrintServiceRequestPricingType.per_page ? "لكل صفحة" : "سعر ثابت";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold">خدمات الطباعة</h2>
            <p className="text-muted-foreground mt-1">إدارة أسعار خدمات الطباعة والسكانر</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="h-11 px-6 font-bold rounded-xl shadow-md shadow-primary/20">
            <Plus className="w-5 h-5 me-2" /> إضافة خدمة
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="h-40 bg-white rounded-2xl animate-pulse border border-border/50" />
            ))
          ) : !services?.length ? (
            <div className="col-span-full flex flex-col items-center justify-center p-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
              <Printer className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-xl font-bold">لا توجد خدمات طباعة</p>
              <p className="text-sm mt-2">أضف خدمات الطباعة لتظهر في نقطة البيع</p>
            </div>
          ) : (
            services.map((s) => (
              <div key={s.id} className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 group relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Printer className="w-5 h-5 text-primary" />
                  </div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(s.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <h3 className="font-bold text-foreground text-lg mb-1">{s.name}</h3>
                <div className="space-y-2 mt-3 pt-3 border-t border-border/40">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">طريقة التسعير</span>
                    <span className="font-bold">{pricingLabel(s.pricingType)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">السعر</span>
                    <span className="font-bold text-primary">{s.price.toFixed(3)} د.أ</span>
                  </div>
                  {s.paperSize && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">حجم الورق</span>
                      <span className="font-bold">{s.paperSize}</span>
                    </div>
                  )}
                  {s.colorType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">نوع الطباعة</span>
                      <span className="font-bold">{s.colorType}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">إضافة خدمة طباعة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-bold">اسم الخدمة *</Label>
              <Input placeholder="طباعة أبيض وأسود" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">طريقة التسعير</Label>
                <Select value={form.pricingType} onValueChange={v => setForm({ ...form, pricingType: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CreatePrintServiceRequestPricingType.per_page}>لكل صفحة</SelectItem>
                    <SelectItem value={CreatePrintServiceRequestPricingType.fixed}>سعر ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">السعر (د.أ) *</Label>
                <Input
                  type="number" step="0.001" placeholder="0.050"
                  value={form.price}
                  onChange={e => setForm({ ...form, price: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">حجم الورق</Label>
                <Input placeholder="A4, A3..." value={form.paperSize} onChange={e => setForm({ ...form, paperSize: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">نوع الطباعة</Label>
                <Input placeholder="أبيض وأسود، ملون" value={form.colorType} onChange={e => setForm({ ...form, colorType: e.target.value })} className="rounded-xl" />
              </div>
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
