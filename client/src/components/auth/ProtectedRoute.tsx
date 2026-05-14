import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { getDefaultRoute } from "@/utils/routing";

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  redirectOnForbidden?: boolean;
}

export function ProtectedRoute({ children, permission, redirectOnForbidden = false }: ProtectedRouteProps) {
  const { accessToken, hasPermission, permissions } = useAuthStore();
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !hasPermission(permission)) {
    if (redirectOnForbidden) {
      const fallbackRoute = getDefaultRoute(permissions);
      if (fallbackRoute !== location.pathname) {
        return <Navigate to={fallbackRoute} replace />;
      }
    }

    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">403</h1>
          <p className="text-gray-600 mt-2">Bạn không có quyền truy cập trang này</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
