import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Building2, LogOut, ShieldCheck, Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { title: "لوحة التحكم", href: "/dashboard", icon: LayoutDashboard },
  { title: "المكتبات", href: "/libraries", icon: Building2 },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const NavLinks = () => (
    <nav className="space-y-1.5 px-3 py-4">
      {navItems.map((item) => {
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
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-display font-bold text-lg tracking-wide">بوابة الإدارة</span>
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
              <p className="text-sidebar-foreground/60 text-sm mt-1">لوحة الإدارة العليا</p>
            </div>
            <div className="overflow-y-auto h-[calc(100vh-10rem)]">
              <NavLinks />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-sidebar text-sidebar-foreground border-l border-sidebar-border shrink-0 z-10 shadow-2xl relative">
        <div className="p-6 border-b border-sidebar-border/50">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-xl tracking-wide text-white leading-tight">LibraryOS</span>
              <span className="text-primary-foreground/60 text-xs font-medium">لوحة الإدارة العليا</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <NavLinks />
        </div>

        <div className="p-4 border-t border-sidebar-border/50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border">
            <Avatar className="w-10 h-10 border border-sidebar-border">
              <AvatarFallback className="bg-primary/20 text-primary font-bold">
                {user?.name?.charAt(0) ?? "A"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.name}</p>
              <p className="text-xs text-sidebar-foreground/60">مدير المنصة</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white/50 backdrop-blur-md border-b border-border/50 z-10">
          <h1 className="text-2xl font-display font-bold">
            {navItems.find(i => location === i.href || (i.href !== "/dashboard" && location.startsWith(i.href)))?.title ?? "لوحة التحكم"}
          </h1>
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-muted-foreground">{user?.name}</div>
            <Button variant="ghost" size="icon" onClick={logout} className="rounded-full text-muted-foreground hover:text-destructive">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50">
          <div className="max-w-7xl mx-auto w-full animate-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
