import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { 
  LayoutDashboard, Package, Tag, Users, FileText, 
  Settings, LogOut, ShoppingCart, Bell, Store, Printer, CreditCard,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const tenantNavItems: NavItem[] = [
  { title: "الرئيسية", href: "/dashboard", icon: LayoutDashboard },
  { title: "المنتجات", href: "/dashboard/products", icon: Package },
  { title: "البطاقات", href: "/dashboard/cards", icon: CreditCard },
  { title: "الطلبات", href: "/dashboard/orders", icon: ShoppingCart },
  { title: "العروض والخصومات", href: "/dashboard/discounts", icon: Tag },
  { title: "خدمات الطباعة", href: "/dashboard/print-services", icon: Printer },
  { title: "الموظفين", href: "/dashboard/staff", icon: Users },
  { title: "التقارير", href: "/dashboard/reports", icon: FileText },
  { title: "الإشعارات", href: "/dashboard/notifications", icon: Bell },
  { title: "الإعدادات", href: "/dashboard/settings", icon: Settings },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const NavLinks = () => (
    <nav className="space-y-1.5 px-3 py-4">
      {tenantNavItems.map((item) => {
        const isActive = location === item.href || location.startsWith(`${item.href}/`);
        return (
          <Link 
            key={item.href} 
            href={item.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
              ${isActive 
                ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20" 
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium"
              }
            `}
          >
            <item.icon className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-70"}`} />
            <span>{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row w-full overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-sidebar text-sidebar-foreground shadow-md z-20 relative">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-display font-bold text-white">
            L
          </div>
          <span className="font-display font-bold text-lg tracking-wide">LibraryOS</span>
        </div>
        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="p-0 bg-sidebar border-l-sidebar-border w-72">
            <div className="p-6 border-b border-sidebar-border/50">
               <h2 className="font-display font-bold text-2xl text-white">LibraryOS</h2>
               <p className="text-sidebar-foreground/60 text-sm mt-1">{user?.tenantName}</p>
            </div>
            <div className="overflow-y-auto h-[calc(100vh-10rem)]">
              <NavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-sidebar text-sidebar-foreground border-l border-sidebar-border shrink-0 z-10 shadow-2xl relative">
        <div className="p-6 border-b border-sidebar-border/50 flex flex-col items-start justify-center min-h-[5rem]">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center font-display font-bold text-white shadow-lg shadow-primary/20 text-xl">
              L
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-xl tracking-wide text-white leading-tight">LibraryOS</span>
              <span className="text-primary-foreground/60 text-xs font-medium truncate max-w-[140px]">{user?.tenantName}</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-sidebar-border/50 bg-sidebar/50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border">
            <Avatar className="w-10 h-10 border border-sidebar-border shadow-sm">
              <AvatarFallback className="bg-primary/20 text-primary font-bold">
                {user?.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user?.role === 'tenant_admin' ? 'مدير المكتبة' : user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Top Header */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white/50 backdrop-blur-md border-b border-border/50 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-display font-bold text-foreground">
              {tenantNavItems.find(i => location === i.href || (i.href !== '/dashboard' && location.startsWith(i.href)))?.title || "لوحة التحكم"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" className="rounded-full relative bg-white shadow-sm border-border/50">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-white"></span>
            </Button>
            <Button asChild variant="default" className="rounded-full shadow-md shadow-primary/20 font-bold px-6">
              <Link href={`/store/${user?.tenantSlug}`} target="_blank">
                <Store className="w-4 h-4 me-2" />
                عرض المتجر
              </Link>
            </Button>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50">
          <div className="max-w-7xl mx-auto w-full animate-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}


// Simple layout for POS to maximize screen real estate
export function POSLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col overflow-hidden">
      <header className="h-16 bg-white border-b border-border flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-display font-bold text-white text-xl">L</div>
          <div>
            <h1 className="font-display font-bold text-xl text-foreground leading-none">نقطة البيع (POS)</h1>
            <p className="text-xs text-muted-foreground font-medium mt-1">{user?.tenantName}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-100 rounded-full border border-gray-200">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm font-bold text-gray-700">{user?.name}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={logout} className="text-gray-500 hover:text-destructive hover:bg-destructive/10 rounded-full">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
