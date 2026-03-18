import React, { useState } from "react";
import { DashboardLayout } from "@/components/layouts";
import { useListPrintServices, useCreatePrintService, useDeletePrintService } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2, FileText } from "lucide-react";

export default function TenantPrintServices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: services, isLoading } = useListPrintServices();
  const createMutation = useCreatePrintService();
  const deleteMutation = useDeletePrintService();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", pricePerPage: "", colorPricePerPage: "",
    scanPricePerPage: "", lamPricePerPage: "",
  });

  const handleSave = async () => {
    if (!form.name || !form.pricePerPage) {
      toast({ title: "خطأ", description: "يرجى تعبئة الحقول المطلوبة", variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        data: {
          name: form.name, description: form.description || undefined,
          pricePerPage: parseFloat(form.pricePerPage),
          colorPricePerPage: form.colorPricePerPage ? parseFloat(form.colorPricePerPage) : undefined,
          scanPricePerPage: form.scanPricePerPage ? parseFloat(form.scanPricePerPage) : undefined,
          lamPricePerPage: form.lamPricePerPage ? parseFloat(form.lamPricePerPage) : undefined,
        }
      });
      toast({ title: "تمت الإضافة" });
      setIsOpen(false);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold">خدمات الطباعة</h2>
            <p className="text-muted-foreground mt-1">إدارة أسعار خدمات الطباعة والسكن</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="h-11 px-6 font-bold rounded-xl shadow-md shadow-primary/20">
            <Plus className="w-5 h-5 me-2" /> إضافة خدمة
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="h-40 bg-white rounded-2xl animate-pulse border border-border/50" />)
          ) : !services?.length ? (
            <div className="col-span-full flex flex-col items-center justify-center p-16 text-muted-foreground bg-white rounded-2xl border border-border/50">
              <Printer className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-xl font-bold">لا توجد خدمات طباعة</p>
            </div>
          ) : (
            services.map((s: any) => (
              <div key={s.id} className="bg-white rounded-2xl border border-border/50 shadow-sm p-5 group relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Printer className="w-5 h-5 text-primary" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <h3 className="font-bold text-foreground text-lg mb-1">{s.name}</h3>
                {s.description && <p className="text-sm text-muted-foreground mb-4">{s.description}</p>}
                <div className="space-y-2 mt-3 pt-3 border-t border-border/40">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">أبيض وأسود</span>
                    <span className="font-bold">{parseFloat(s.pricePerPage).toFixed(3)} د.أ/صفحة</span>
                  </div>
                  {s.colorPricePerPage && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ملون</span>
                      <span className="font-bold text-primary">{parseFloat(s.colorPricePerPage).toFixed(3)} د.أ/صفحة</span>
                    </div>
                  )}
                  {s.scanPricePerPage && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">سكانر</span>
                      <span className="font-bold">{parseFloat(s.scanPricePerPage).toFixed(3)} د.أ/صفحة</span>
                    </div>
                  )}
                  {s.lamPricePerPage && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">لمينيشن</span>
                      <span className="font-bold">{parseFloat(s.lamPricePerPage).toFixed(3)} د.أ/صفحة</span>
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
              <Input placeholder="طباعة عادية" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">الوصف</Label>
              <Input placeholder="وصف اختياري" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">أبيض وأسود (د.أ/صفحة) *</Label>
                <Input type="number" step="0.001" placeholder="0.050" value={form.pricePerPage} onChange={e => setForm({...form, pricePerPage: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">ملون (د.أ/صفحة)</Label>
                <Input type="number" step="0.001" placeholder="0.150" value={form.colorPricePerPage} onChange={e => setForm({...form, colorPricePerPage: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">سكانر (د.أ/صفحة)</Label>
                <Input type="number" step="0.001" placeholder="0.100" value={form.scanPricePerPage} onChange={e => setForm({...form, scanPricePerPage: e.target.value})} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">لمينيشن (د.أ/صفحة)</Label>
                <Input type="number" step="0.001" placeholder="0.200" value={form.lamPricePerPage} onChange={e => setForm({...form, lamPricePerPage: e.target.value})} className="rounded-xl" />
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
