import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { organizationApi } from "@/api/organization.api";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Branch, Department, Position } from "@/types";

// --- Schemas ---
const branchSchema = z.object({
  code: z.string().min(1, "Mã chi nhánh là bắt buộc").max(20),
  name: z.string().min(1, "Tên chi nhánh là bắt buộc").max(100),
});
type BranchFormData = z.infer<typeof branchSchema>;

const departmentSchema = z.object({
  name: z.string().min(1, "Tên phòng ban là bắt buộc").max(100),
  branchId: z.string().min(1, "Chi nhánh là bắt buộc"),
});
type DepartmentFormData = z.infer<typeof departmentSchema>;

const positionSchema = z.object({
  name: z.string().min(1, "Tên chức vụ là bắt buộc").max(100),
  level: z.coerce.number().int().min(0, "Thứ tự phải >= 0"),
});
type PositionFormData = z.infer<typeof positionSchema>;

// --- Tab: Branches ---
function BranchesTab() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => organizationApi.listBranches(),
  });

  const form = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: { code: "", name: "" },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ code: "", name: "" });
    setShowForm(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    form.reset({ code: b.code, name: b.name });
    setShowForm(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: BranchFormData) => organizationApi.createBranch(data),
    onSuccess: () => {
      toast.success("Tạo chi nhánh thành công");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Tạo thất bại"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: BranchFormData) => organizationApi.updateBranch(editing!.id, data),
    onSuccess: () => {
      toast.success("Cập nhật chi nhánh thành công");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Cập nhật thất bại"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteBranch(id),
    onSuccess: () => {
      toast.success("Xóa chi nhánh thành công");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      setDeleting(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Xóa thất bại"),
  });

  const onSubmit = (data: BranchFormData) => {
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <div>
      {isAdmin() && (
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Thêm chi nhánh
          </Button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mã</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên chi nhánh</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branches?.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{b.code}</td>
                  <td className="px-4 py-3">{b.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={b.isActive ? "success" : "error"}>
                      {b.isActive ? "Hoạt động" : "Vô hiệu"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin() && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(b)} className="p-1 text-gray-500 hover:text-agribank" title="Sửa">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleting(b)} className="p-1 text-gray-500 hover:text-red-600" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {branches?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Sửa chi nhánh" : "Thêm chi nhánh"} size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Mã chi nhánh *" {...form.register("code")} error={form.formState.errors.code?.message} />
          <Input label="Tên chi nhánh *" {...form.register("name")} error={form.formState.errors.name?.message} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Cập nhật" : "Tạo mới"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Xóa chi nhánh"
        message={`Bạn có chắc muốn xóa chi nhánh "${deleting?.name}"?`}
        confirmText="Xóa"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// --- Tab: Departments ---
function DepartmentsTab() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [filterBranch, setFilterBranch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => organizationApi.listBranches(),
  });

  const { data: departments, isLoading } = useQuery({
    queryKey: ["departments", filterBranch],
    queryFn: () => organizationApi.listDepartments(filterBranch || undefined),
  });

  const form = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "", branchId: "" },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: "", branchId: "" });
    setShowForm(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    form.reset({ name: d.name, branchId: d.branchId });
    setShowForm(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: DepartmentFormData) => organizationApi.createDepartment(data),
    onSuccess: () => {
      toast.success("Tạo phòng ban thành công");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Tạo thất bại"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: DepartmentFormData) => organizationApi.updateDepartment(editing!.id, data),
    onSuccess: () => {
      toast.success("Cập nhật phòng ban thành công");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Cập nhật thất bại"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationApi.deleteDepartment(id),
    onSuccess: () => {
      toast.success("Xóa phòng ban thành công");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeleting(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Xóa thất bại"),
  });

  const onSubmit = (data: DepartmentFormData) => {
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const branchOptions = (branches || []).map((b) => ({ value: b.id, label: b.name }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="w-64">
          <Select
            options={branchOptions}
            placeholder="Tất cả chi nhánh"
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
          />
        </div>
        {isAdmin() && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Thêm phòng ban
          </Button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên phòng ban</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chi nhánh</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {departments?.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3">{d.branchName || "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={d.isActive ? "success" : "error"}>
                      {d.isActive ? "Hoạt động" : "Vô hiệu"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin() && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(d)} className="p-1 text-gray-500 hover:text-agribank" title="Sửa">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleting(d)} className="p-1 text-gray-500 hover:text-red-600" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {departments?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Sửa phòng ban" : "Thêm phòng ban"} size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Tên phòng ban *" {...form.register("name")} error={form.formState.errors.name?.message} />
          <Select
            label="Chi nhánh *"
            options={branchOptions}
            placeholder="Chọn chi nhánh"
            {...form.register("branchId")}
            error={form.formState.errors.branchId?.message}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Cập nhật" : "Tạo mới"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Xóa phòng ban"
        message={`Bạn có chắc muốn xóa phòng ban "${deleting?.name}"?`}
        confirmText="Xóa"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// --- Tab: Positions ---
function PositionsTab() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [deleting, setDeleting] = useState<Position | null>(null);

  const { data: positions, isLoading } = useQuery({
    queryKey: ["positions"],
    queryFn: () => organizationApi.listPositions(),
  });

  const form = useForm<PositionFormData>({
    resolver: zodResolver(positionSchema),
    defaultValues: { name: "", level: 0 },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: "", level: 0 });
    setShowForm(true);
  };

  const openEdit = (p: Position) => {
    setEditing(p);
    form.reset({ name: p.name, level: p.level });
    setShowForm(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: PositionFormData) => organizationApi.createPosition(data),
    onSuccess: () => {
      toast.success("Tạo chức vụ thành công");
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Tạo thất bại"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: PositionFormData) => organizationApi.updatePosition(editing!.id, data),
    onSuccess: () => {
      toast.success("Cập nhật chức vụ thành công");
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setShowForm(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Cập nhật thất bại"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => organizationApi.deletePosition(id),
    onSuccess: () => {
      toast.success("Xóa chức vụ thành công");
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      setDeleting(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || "Xóa thất bại"),
  });

  const onSubmit = (data: PositionFormData) => {
    if (editing) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  return (
    <div>
      {isAdmin() && (
        <div className="flex justify-end mb-4">
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Thêm chức vụ
          </Button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên chức vụ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Thứ tự</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {positions?.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">{p.level}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.isActive ? "success" : "error"}>
                      {p.isActive ? "Hoạt động" : "Vô hiệu"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin() && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="p-1 text-gray-500 hover:text-agribank" title="Sửa">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleting(p)} className="p-1 text-gray-500 hover:text-red-600" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {positions?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Không có dữ liệu</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Sửa chức vụ" : "Thêm chức vụ"} size="sm">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Tên chức vụ *" {...form.register("name")} error={form.formState.errors.name?.message} />
          <Input label="Thứ tự *" type="number" {...form.register("level")} error={form.formState.errors.level?.message} />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Cập nhật" : "Tạo mới"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="Xóa chức vụ"
        message={`Bạn có chắc muốn xóa chức vụ "${deleting?.name}"?`}
        confirmText="Xóa"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// --- Main Page ---
const tabs = [
  { key: "branches", label: "Chi nhánh" },
  { key: "departments", label: "Phòng ban" },
  { key: "positions", label: "Chức vụ" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

export function OrganizationPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("branches");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cơ cấu tổ chức</h1>

      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-agribank text-agribank"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "branches" && <BranchesTab />}
      {activeTab === "departments" && <DepartmentsTab />}
      {activeTab === "positions" && <PositionsTab />}
    </div>
  );
}
