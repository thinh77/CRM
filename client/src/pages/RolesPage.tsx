import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rolesApi } from "@/api/roles.api";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RoleForm } from "@/components/roles/RoleForm";
import type { Role } from "@/types";

export function RolesPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  const { data: roles, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list().then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => {
      toast.success("Xóa vai trò thành công");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      setDeletingRole(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Xóa thất bại");
    },
  });

  if (isLoading) return <div className="text-gray-500">Đang tải...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vai trò & Quyền hạn</h1>
        {isAdmin() && (
          <Button onClick={() => { setEditingRole(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" />
            Thêm vai trò
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {roles?.map((role) => (
          <div key={role.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">{role.name}</h3>
                <p className="text-sm text-gray-500">{role.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {role.isSystem && (
                  <Badge variant="neutral">Hệ thống</Badge>
                )}
                {isAdmin() && !role.isSystem && (
                  <>
                    <button
                      onClick={() => { setEditingRole(role); setShowForm(true); }}
                      className="p-1.5 text-gray-500 hover:text-agribank rounded"
                      title="Sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingRole(role)}
                      className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {role.permissions.map((p) => (
                <Badge key={p.id} variant="info">
                  {p.resource}:{p.action}
                </Badge>
              ))}
              {role.permissions.length === 0 && (
                <span className="text-sm text-gray-400">Chưa có quyền nào</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <RoleForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingRole(null); }}
        role={editingRole}
      />

      <ConfirmDialog
        open={!!deletingRole}
        onClose={() => setDeletingRole(null)}
        onConfirm={() => deletingRole && deleteMutation.mutate(deletingRole.id)}
        title="Xóa vai trò"
        message={`Bạn có chắc muốn xóa vai trò "${deletingRole?.name}"? Tất cả user có vai trò này sẽ bị ảnh hưởng.`}
        confirmText="Xóa"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
