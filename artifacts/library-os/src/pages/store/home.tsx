import React, { useState } from "react";
import { Link, useRoute } from "wouter";
import { useListStoreProducts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingCart, BookOpen, ChevronLeft, MapPin, Phone } from "lucide-react";

export default function StoreHome() {
  const [match, params] = useRoute("/store/:tenantSlug");
  const tenantSlug = params?.tenantSlug || "";
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products, isLoading } = useListStoreProducts(tenantSlug);

  const categories = ["قرطاسية", "دوسيات", "كتب", "بطاقات", "ألعاب"];

  if (!match) return null;

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-white transform -rotate-6">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-display font-bold text-2xl text-foreground leading-tight">مكتبة الأمل</h1>
                <p className="text-xs text-primary font-bold">متجر إلكتروني</p>
              </div>
            </div>

            {/* Search - Desktop */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <Input 
                placeholder="عن ماذا تبحث؟ دوسيات، قرطاسية..." 
                className="h-12 w-full rounded-full bg-gray-100 border-transparent focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 pe-12 text-lg shadow-inner"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button size="icon" className="absolute left-1 top-1 bottom-1 rounded-full w-10 h-10 bg-primary hover:bg-primary/90 shadow-md">
                <Search className="w-5 h-5 text-white" />
              </Button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button variant="outline" className="hidden sm:flex rounded-full font-bold border-gray-200">
                تسجيل الدخول
              </Button>
              <Button className="rounded-full font-bold shadow-lg shadow-primary/20 relative w-12 h-12 p-0 md:w-auto md:px-6">
                <ShoppingCart className="w-5 h-5 md:me-2" />
                <span className="hidden md:inline">السلة</span>
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-xs font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                  0
                </span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full h-[400px] md:h-[500px] overflow-hidden">
          <img 
            src={`${import.meta.env.BASE_URL}images/store-hero.png`} 
            alt="Back to school offers" 
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-foreground/80 via-foreground/50 to-transparent"></div>
          
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
              <div className="max-w-xl animate-in" style={{ animationDuration: '0.8s' }}>
                <span className="inline-block py-1 px-3 rounded-full bg-accent text-accent-foreground font-bold text-sm mb-4 shadow-lg shadow-accent/20">
                  مهرجان العودة للمدارس 🚀
                </span>
                <h2 className="text-4xl md:text-6xl font-display font-bold text-white leading-tight mb-4 drop-shadow-lg">
                  كل ما تحتاجه للتفوق في مكان واحد.
                </h2>
                <p className="text-lg md:text-xl text-white/90 mb-8 font-medium drop-shadow">
                  اطلب الآن ونجهّز طلبك فوراً للاستلام بدون انتظار.
                </p>
                <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-full shadow-xl hover:scale-105 transition-transform bg-white text-primary hover:bg-gray-50">
                  تصفح المنتجات
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-display font-bold text-foreground">تسوق حسب الفئة</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {categories.map((cat, i) => (
                <div key={cat} className="group cursor-pointer">
                  <div className={`h-32 rounded-2xl mb-3 flex items-center justify-center text-3xl shadow-sm border border-gray-100 group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-300 ${['bg-blue-50', 'bg-purple-50', 'bg-amber-50', 'bg-green-50', 'bg-rose-50'][i % 5]}`}>
                    {['✏️', '📚', '📘', '💳', '🎲'][i % 5]}
                  </div>
                  <h4 className="text-center font-bold text-foreground group-hover:text-primary transition-colors">{cat}</h4>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Products Grid */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-3xl font-display font-bold text-foreground">الأكثر طلباً</h3>
              <Button variant="ghost" className="text-primary font-bold hover:bg-primary/5 rounded-full">
                عرض الكل <ChevronLeft className="w-4 h-4 ms-1" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {isLoading ? (
                 Array(10).fill(0).map((_, i) => (
                   <div key={i} className="bg-white rounded-3xl p-4 h-72 animate-pulse border border-gray-100 shadow-sm">
                     <div className="w-full h-32 bg-gray-200 rounded-2xl mb-4"></div>
                     <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                     <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
                     <div className="h-10 bg-gray-200 rounded-xl w-full"></div>
                   </div>
                 ))
              ) : products?.slice(0, 10).map((product) => (
                <div key={product.id} className="bg-white rounded-3xl p-4 border border-border shadow-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300 group flex flex-col">
                  {/* Mock Product Image Area */}
                  <div className="w-full aspect-square bg-gray-50 rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center border border-gray-100 group-hover:scale-105 transition-transform duration-500">
                    <span className="text-4xl opacity-50">{product.category === 'قرطاسية' ? '✏️' : '📚'}</span>
                    {product.discountedPrice && (
                      <span className="absolute top-2 right-2 bg-destructive text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm">
                        خصم
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col">
                    <div className="text-xs font-bold text-muted-foreground mb-1">{product.category}</div>
                    <h4 className="font-bold text-foreground leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors">{product.name}</h4>
                    
                    <div className="mt-auto pt-4 flex items-end justify-between">
                      <div>
                        {product.discountedPrice ? (
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground line-through">{product.price.toFixed(2)} د.أ</span>
                            <span className="font-display font-bold text-xl text-destructive">{product.discountedPrice.toFixed(2)} د.أ</span>
                          </div>
                        ) : (
                          <span className="font-display font-bold text-xl text-primary">{product.price.toFixed(2)} د.أ</span>
                        )}
                      </div>
                      
                      <Button size="icon" className="w-10 h-10 rounded-full shadow-md shadow-primary/20 active:scale-95" disabled={!product.isAvailable}>
                        <Plus className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-foreground text-white/80 py-12 mt-auto border-t-4 border-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="font-display font-bold text-xl text-white">مكتبة الأمل</h2>
            </div>
            <p className="text-sm leading-relaxed mb-4">نوفر لكم كل ما تحتاجونه من أدوات مدرسية، قرطاسية، ودوسيات بأسعار منافسة.</p>
          </div>
          <div>
            <h3 className="font-bold text-white mb-4 text-lg">تواصل معنا</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> عمان، الأردن - شارع الجامعة</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> 0791234567</li>
            </ul>
          </div>
          <div>
             <p className="text-sm text-white/50 pt-8 mt-8 border-t border-white/10 text-center md:text-right">
              مدعوم بواسطة <span className="font-bold text-white">LibraryOS</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Needed for the plus icon in product cards
import { Plus } from "lucide-react";
