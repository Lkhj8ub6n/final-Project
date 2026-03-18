import React, { useState } from "react";
import { useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, useToggleProductStore } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/layouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Edit2, Trash2, Store, UploadCloud, DownloadCloud, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const categories = ["قرطاسية", "دوسيات", "ألعاب", "هدايا", "إكسسوارات", "كتب", "بطاقات"];

const productSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب"),
  category: z.string().min(2, "الفئة مطلوبة"),
  barcode: z.string().optional(),
  price: z.coerce.number().min(0.01, "السعر يجب أن يكون أكبر من صفر"),
  stockQuantity: z.coerce.number().min(0, "الكمية يجب أن تكون صفر أو أكثر"),
  stockAlertThreshold: z.coerce.number().min(0, "الحد يجب أن يكون صفر أو أكثر"),
  showInStore: z.boolean().default(false),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function TenantProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: products, isLoading } = useListProducts({ 
    search: search || undefined, 
    category: categoryFilter !== 'all' ? categoryFilter : undefined 
  });
  
  const createMutation = useCreateProduct({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/products'] });
        toast({ title: "تمت الإضافة بنجاح" });
        setIsAddOpen(false);
      },
      onError: (error) => toast({ title: "خطأ", description: error.message, variant: "destructive" })
    }
  });

  const toggleStoreMutation = useToggleProductStore({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/products'] })
    }
  });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: { showInStore: false, stockAlertThreshold: 5, stockQuantity: 0, price: 0 }
  });

  const onSubmit = (data: ProductFormData) => {
    createMutation.mutate({ data });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-border">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">إدارة المنتجات</h1>
            <p className="text-muted-foreground mt-1">أضف منتجاتك، تتبع المخزون، وحدد المعروض في المتجر الإلكتروني.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="rounded-xl border-gray-200 shadow-sm font-bold h-11">
              <UploadCloud className="w-4 h-4 me-2" />
              استيراد Excel
            </Button>
            <Dialog open={isAddOpen} onOpenChange={(o) => { setIsAddOpen(o); if(!o) reset(); }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-primary/20 font-bold h-11 px-6">
                  <Plus className="w-5 h-5 me-2" />
                  إضافة منتج
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
                <div className="bg-primary/5 p-6 border-b border-primary/10">
                  <DialogTitle className="font-display text-2xl font-bold text-primary">منتج جديد</DialogTitle>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                  <div className="space-y-2">
                    <Label className="font-bold">اسم المنتج <span className="text-destructive">*</span></Label>
                    <Input {...register("name")} className="h-11 bg-gray-50 border-gray-200 focus:bg-white rounded-xl" placeholder="مثال: قلم رصاص أزرق" />
                    {errors.name && <span className="text-sm text-destructive">{errors.name.message}</span>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bold">الفئة <span className="text-destructive">*</span></Label>
                      <Select onValueChange={(v) => setValue("category", v)} defaultValue={watch("category")}>
                        <SelectTrigger className="h-11 bg-gray-50 border-gray-200 focus:bg-white rounded-xl">
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {errors.category && <span className="text-sm text-destructive">{errors.category.message}</span>}
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">الباركود</Label>
                      <Input {...register("barcode")} className="h-11 bg-gray-50 border-gray-200 focus:bg-white rounded-xl" placeholder="اختياري" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-t border-b border-gray-100 py-4 my-2">
                    <div className="space-y-2">
                      <Label className="font-bold">السعر (د.أ) <span className="text-destructive">*</span></Label>
                      <Input type="number" step="0.01" {...register("price")} className="h-11 font-bold text-lg bg-gray-50 border-gray-200 focus:bg-white rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold">الكمية <span className="text-destructive">*</span></Label>
                      <Input type="number" {...register("stockQuantity")} className="h-11 font-bold text-lg bg-gray-50 border-gray-200 focus:bg-white rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5"/> التنبيه عند</Label>
                      <Input type="number" {...register("stockAlertThreshold")} className="h-11 font-bold text-lg bg-destructive/5 border-destructive/20 focus:bg-white rounded-xl text-destructive" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold text-blue-900 flex items-center gap-2">
                        <Store className="w-4 h-4" />
                        عرض في المتجر الإلكتروني
                      </Label>
                      <p className="text-sm text-blue-700/70">سيتمكن الطلاب من طلبه أونلاين</p>
                    </div>
                    <Switch 
                      checked={watch("showInStore")}
                      onCheckedChange={(c) => setValue("showInStore", c)}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </div>

                  <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full h-12 text-lg font-bold rounded-xl shadow-lg shadow-primary/20" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "جاري الحفظ..." : "حفظ المنتج"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="ابحث بالاسم أو الباركود..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 pe-12 bg-white border-gray-200 rounded-xl text-lg shadow-sm"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[200px] h-12 bg-white border-gray-200 rounded-xl font-bold shadow-sm">
              <SelectValue placeholder="كل الفئات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50/80 border-b border-gray-100 text-sm font-bold text-gray-600">
                <tr>
                  <th className="px-6 py-4">المنتج</th>
                  <th className="px-6 py-4">الفئة</th>
                  <th className="px-6 py-4">السعر</th>
                  <th className="px-6 py-4">المخزون</th>
                  <th className="px-6 py-4 text-center">المتجر</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div></td></tr>
                ) : products?.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground font-medium text-lg">لا توجد منتجات مطابقة للبحث</td></tr>
                ) : (
                  products?.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground text-base">{p.name}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">{p.barcode || 'بدون باركود'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-lg text-xs font-bold border border-gray-200">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-primary text-lg">{p.price.toFixed(2)} د.أ</td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold border ${p.stockQuantity <= p.stockAlertThreshold ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-green-50 text-green-700 border-green-100'}`}>
                          {p.stockQuantity <= p.stockAlertThreshold && <AlertCircle className="w-3.5 h-3.5" />}
                          {p.stockQuantity} حبة
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Switch 
                          checked={p.showInStore} 
                          onCheckedChange={() => toggleStoreMutation.mutate({ productId: p.id })}
                          disabled={toggleStoreMutation.isPending}
                          className="data-[state=checked]:bg-blue-500 shadow-sm"
                        />
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-gray-50 hover:bg-primary/10 hover:text-primary text-gray-500 border border-gray-200">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-gray-50 hover:bg-destructive/10 hover:text-destructive text-gray-500 border border-gray-200">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
