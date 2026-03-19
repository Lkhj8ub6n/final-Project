import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { StoreAuthProvider } from "@/lib/store-auth-context";
import { CartProvider } from "@/lib/cart-context";
import NotFound from "@/pages/not-found";

// Pages
import Login from "@/pages/login";
import TenantDashboard from "@/pages/tenant/dashboard";
import TenantProducts from "@/pages/tenant/products";
import TenantOrders from "@/pages/tenant/orders";
import TenantCards from "@/pages/tenant/cards";
import TenantDiscounts from "@/pages/tenant/discounts";
import TenantPrintServices from "@/pages/tenant/print-services";
import TenantStaff from "@/pages/tenant/staff";
import TenantReports from "@/pages/tenant/reports";
import TenantNotifications from "@/pages/tenant/notifications";
import TenantSettings from "@/pages/tenant/settings";
import SuperAdminDashboard from "@/pages/admin/dashboard";
import AdminLibraries from "@/pages/admin/libraries";
import POSSell from "@/pages/pos/sell";
import StoreHome from "@/pages/store/home";
import StoreCart from "@/pages/store/cart";
import StoreMyOrders from "@/pages/store/my-orders";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ component: Component, allowedRoles }: { component: any, allowedRoles: string[] }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!user) return <Redirect to="/" />;
  if (!allowedRoles.includes(user.role)) return <Redirect to="/" />;

  return <Component />;
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />

      {/* Super Admin */}
      <Route path="/admin">
        {() => <ProtectedRoute component={SuperAdminDashboard} allowedRoles={["super_admin"]} />}
      </Route>
      <Route path="/admin/dashboard">
        {() => <ProtectedRoute component={SuperAdminDashboard} allowedRoles={["super_admin"]} />}
      </Route>
      <Route path="/admin/libraries">
        {() => <ProtectedRoute component={AdminLibraries} allowedRoles={["super_admin"]} />}
      </Route>

      {/* Tenant Admin Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={TenantDashboard} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/products">
        {() => <ProtectedRoute component={TenantProducts} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/cards">
        {() => <ProtectedRoute component={TenantCards} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/orders">
        {() => <ProtectedRoute component={TenantOrders} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/discounts">
        {() => <ProtectedRoute component={TenantDiscounts} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/print-services">
        {() => <ProtectedRoute component={TenantPrintServices} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/staff">
        {() => <ProtectedRoute component={TenantStaff} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/reports">
        {() => <ProtectedRoute component={TenantReports} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/notifications">
        {() => <ProtectedRoute component={TenantNotifications} allowedRoles={["tenant_admin"]} />}
      </Route>
      <Route path="/dashboard/settings">
        {() => <ProtectedRoute component={TenantSettings} allowedRoles={["tenant_admin"]} />}
      </Route>

      {/* POS Routes */}
      <Route path="/pos/sell">
        {() => <ProtectedRoute component={POSSell} allowedRoles={["cashier", "tenant_admin"]} />}
      </Route>

      {/* Store Routes */}
      <Route path="/store/:tenantSlug" component={StoreHome} />
      <Route path="/store/:tenantSlug/cart" component={StoreCart} />
      <Route path="/store/:tenantSlug/my-orders" component={StoreMyOrders} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StoreAuthProvider>
          <CartProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </CartProvider>
        </StoreAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
