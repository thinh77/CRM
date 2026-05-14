import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, type UserFilters } from "@/api/users.api";
import { organizationApi } from "@/api/organization.api";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { Plus, Search, Trash2, Edit, Eye, Shield, Key, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { UserForm } from "@/components/users/UserForm";
import { UserDetailModal } from "@/components/users/UserDetailModal";
import { AssignRolesDialog } from "@/components/users/AssignRolesDialog";
import { AssignPermissionsDialog } from "@/components/users/AssignPermissionsDialog";
import { UserImportExportDialog } from "@/components/users/UserImportExportDialog";
import type { User } from "@/types";

export function UsersPage() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [filters, setFilters] = useState<UserFilters>({ page: 1, limit: 20, search: "" });
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [assignRolesUser, setAssignRolesUser] = useState<User | null>(null);
  const [assignPermsUser, setAssignPermsUser] = useState<User | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["users", filters],
    queryFn: () => usersApi.list(filters).then((res) => res.data),
  });

  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => organizationApi.listBranches(),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["departments", filters.branchId],
    queryFn: () => organizationApi.listDepartments(filters.branchId),
    enabled: !!filters.branchId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      toast.success("Xóa người dùng thành công");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingUser(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Xóa thất bại");
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
        {isAdmin() && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowImportExport(true)}>
              <Upload className="w-4 h-4" />
              Import / Export
            </Button>
            <Button onClick={() => { setEditingUser(null); setShowForm(true); }}>
              <Plus className="w-4 h-4" />
              Thêm user
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-gray-500 mb-1">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search || ""}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                placeholder="Tìm theo mã NV, họ tên..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Chi nhánh</label>
            <select
              value={filters.branchId || ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  branchId: e.target.value || undefined,
                  departmentId: undefined,
                  page: 1,
                }))
              }
              className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[180px]"
            >
              <option value="">Tất cả</option>
              {branchesData?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Phòng ban</label>
            <select
              value={filters.departmentId || ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  departmentId: e.target.value || undefined,
                  page: 1,
                }))
              }
              className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-[180px]"
              disabled={!filters.branchId}
            >
              <option value="">Tất cả</option>
              {departmentsData?.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mã NV</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Họ tên</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Chi nhánh</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Phòng ban</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Chức vụ</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.data.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{user.employeeCode}</td>
                    <td className="px-4 py-3">{user.fullName}</td>
                    <td className="px-4 py-3">{user.branchName || "-"}</td>
                    <td className="px-4 py-3">{user.departmentName || "-"}</td>
                    <td className="px-4 py-3">{user.positionName || "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.isActive ? "success" : "error"}>
                        {user.isActive ? "Hoạt động" : "Vô hiệu"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setViewingUser(user)}
                          className="p-1 text-gray-500 hover:text-agribank"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin() && (
                          <>
                            <button
                              onClick={() => { setEditingUser(user); setShowForm(true); }}
                              className="p-1 text-gray-500 hover:text-agribank"
                              title="Sửa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setAssignRolesUser(user)}
                              className="p-1 text-gray-500 hover:text-agribank"
                              title="Gán vai trò"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setAssignPermsUser(user)}
                              className="p-1 text-gray-500 hover:text-orange-600"
                              title="Quyền riêng"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingUser(user)}
                              className="p-1 text-gray-500 hover:text-red-600"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {data?.pagination && (
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
              />
            )}
          </>
        )}
      </div>

      <UserForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingUser(null); }}
        user={editingUser}
      />

      <UserDetailModal
        open={!!viewingUser}
        onClose={() => setViewingUser(null)}
        user={viewingUser}
      />

      <AssignRolesDialog
        open={!!assignRolesUser}
        onClose={() => setAssignRolesUser(null)}
        user={assignRolesUser}
      />

      <AssignPermissionsDialog
        open={!!assignPermsUser}
        onClose={() => setAssignPermsUser(null)}
        user={assignPermsUser}
      />

      <ConfirmDialog
        open={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
        title="Xóa người dùng"
        message={`Bạn có chắc muốn xóa "${deletingUser?.fullName}" (${deletingUser?.employeeCode})?`}
        confirmText="Xóa"
        loading={deleteMutation.isPending}
      />

      <UserImportExportDialog
        open={showImportExport}
        onClose={() => setShowImportExport(false)}
        onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
      />
    </div>
  );
}
