import { useAuthStore } from "@/stores/authStore";
import { Badge } from "@/components/ui/Badge";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { useNavigate } from "react-router-dom";
import { User, KeyRound, ArrowLeft } from "lucide-react";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value || "-"}</dd>
    </div>
  );
}

export function ProfilePage() {
  const { user, permissions } = useAuthStore();
  const navigate = useNavigate();

  if (!user) return null;

  const handleBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="max-w-3xl">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 min-h-11 px-3 mb-3 text-sm text-gray-600 hover:text-agribank rounded-md hover:bg-gray-100 transition-colors touch-manipulation"
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Thông tin cá nhân</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-agribank-100 flex items-center justify-center">
            <User className="w-8 h-8 text-agribank" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{user.fullName}</h2>
            <p className="text-sm text-gray-500">{user.employeeCode}</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Mã nhân viên" value={user.employeeCode} />
          <Field label="Họ tên" value={user.fullName} />
          <Field label="Chi nhánh" value={user.branchName} />
          <Field label="Phòng ban" value={user.departmentName} />
          <Field label="Chức vụ" value={user.positionName} />
          <Field
            label="Trạng thái"
            value={
              <Badge variant={user.isActive ? "success" : "error"}>
                {user.isActive ? "Hoạt động" : "Vô hiệu"}
              </Badge>
            }
          />
        </dl>

        {user.roles && user.roles.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Vai trò</h4>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((r) => (
                <Badge key={r.roleId} variant="info">{r.roleName}</Badge>
              ))}
            </div>
          </div>
        )}

        {permissions && permissions.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Quyền hạn</h4>
            <div className="flex flex-wrap gap-1">
              {permissions.map((p) => (
                <Badge key={p} variant="neutral">{p}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold">Đổi mật khẩu</h2>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
