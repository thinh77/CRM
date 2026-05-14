import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/api/users.api";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { User } from "@/types";

interface UserDetailModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value || "-"}</dd>
    </div>
  );
}

export function UserDetailModal({ open, onClose, user }: UserDetailModalProps) {
  const { data: fullUser } = useQuery({
    queryKey: ["user-detail", user?.id],
    queryFn: () => usersApi.getById(user!.id).then((r) => r.data.data),
    enabled: open && !!user,
  });

  if (!user) return null;
  const u = fullUser || user;

  return (
    <Modal open={open} onClose={onClose} title="Chi tiết người dùng" size="md">
      <dl className="grid grid-cols-2 gap-4 mb-6">
        <Field label="Mã NV" value={u.employeeCode} />
        <Field label="Họ tên" value={u.fullName} />
        <Field label="Chi nhánh" value={u.branchName} />
        <Field label="Phòng ban" value={u.departmentName} />
        <Field label="Chức vụ" value={u.positionName} />
        <Field
          label="Trạng thái"
          value={
            <Badge variant={u.isActive ? "success" : "error"}>
              {u.isActive ? "Hoạt động" : "Vô hiệu"}
            </Badge>
          }
        />
        <Field
          label="Đăng nhập lần cuối"
          value={u.lastLogin ? new Date(u.lastLogin).toLocaleString("vi-VN") : "Chưa đăng nhập"}
        />
        <Field
          label="Ngày tạo"
          value={new Date(u.createdAt).toLocaleString("vi-VN")}
        />
      </dl>

      {u.roles && u.roles.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Vai trò</h4>
          <div className="flex flex-wrap gap-2">
            {u.roles.map((r) => (
              <Badge key={r.roleId} variant="info">{r.roleName}</Badge>
            ))}
          </div>
        </div>
      )}

      {u.permissions && u.permissions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Quyền hạn</h4>
          <div className="flex flex-wrap gap-1">
            {u.permissions.map((p) => (
              <Badge key={p} variant="neutral">{p}</Badge>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
