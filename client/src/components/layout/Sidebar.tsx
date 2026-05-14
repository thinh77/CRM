import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { queryClient } from "@/lib/queryClient";
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  LogOut,
  FileText,
  Network,
  FileSpreadsheet,
  Inbox,
} from "lucide-react";
import name from "../../assets/agri.png";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
  { to: "/customers", label: "Khách hàng", icon: Building2, permission: "customers:read" },
  { to: "/pool", label: "Pool", icon: Inbox, permission: "customers:claim" },
  { to: "/users", label: "Người dùng", icon: Users, permission: "users:read" },
  { to: "/organization", label: "Cơ cấu tổ chức", icon: Network, permission: "organization:read" },
  { to: "/roles", label: "Vai trò & Quyền", icon: Shield, permission: "roles:read" },
  { to: "/reports", label: "Báo cáo", icon: FileSpreadsheet, permission: "reports:export" },
  { to: "/audit-logs", label: "Nhật ký", icon: FileText, permission: "audit_logs:read" },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { hasPermission, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-app-screen">
      <div className="p-1 border-b border-gray-200 flex items-center gap-3">
        <img src={name} alt="Logo" className="w-full h-auto" />
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto ios-scroll">
        {navItems
          .filter((item) => hasPermission(item.permission))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 min-h-11 rounded-md text-sm transition-colors touch-manipulation ${
                  isActive
                    ? "bg-agribank-50 text-agribank-dark font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
      </nav>

      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 min-h-11 px-2 text-sm text-red-600 hover:text-red-700 transition-colors touch-manipulation"
        >
          <LogOut className="w-4 h-4" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
