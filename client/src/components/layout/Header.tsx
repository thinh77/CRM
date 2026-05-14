import { useAuthStore } from "@/stores/authStore";
import { Link } from "react-router-dom";
import { UserCircle } from "lucide-react";

export function Header() {
  const { user } = useAuthStore();

  return (
    <div className="flex items-center gap-3 ml-auto">
      <span className="text-sm text-white font-medium">
        {user?.fullName}
      </span>
      <Link
        to="/profile"
        className="p-1.5 text-white hover:text-agribank rounded-md hover:bg-gray-100"
        title="Thông tin cá nhân"
      >
        <UserCircle className="w-5 h-5" />
      </Link>
    </div>
  );
}
