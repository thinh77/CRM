import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi, type CustomerFilters } from "@/api/customers.api";
import { organizationApi } from "@/api/organization.api";
import { usersApi } from "@/api/users.api";
import { useAuthStore } from "@/stores/authStore";
import { Plus, Search, Trash2, Edit, Eye, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { CustomerDetailModal } from "@/components/customers/CustomerDetailModal";
import { CustomerCard } from "@/components/customers/CustomerCard";
import { ImportExportDialog } from "@/components/customers/ImportExportDialog";
import type { Customer } from "@/types";

export function CustomersPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<CustomerFilters>({
    page: 1,
    limit: 20,
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    invalidAccount: searchParams.get("invalidAccount") === "true" ? true : undefined,
  });
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", filters],
    queryFn: () => customersApi.list(filters).then((res) => res.data),
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

  const { data: consultantsData } = useQuery({
    queryKey: ["consultants", filters.branchId, filters.departmentId],
    queryFn: () =>
      usersApi.listConsultants({
        branchId: filters.branchId,
        departmentId: filters.departmentId,
      }).then((res) => res.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      toast.success("Xóa khách hàng thành công");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setDeletingCustomer(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Xóa thất bại");
    },
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Khách hàng</h1>
        <div className="flex gap-2">
          {hasPermission("customers:import") && (
            <Button variant="secondary" onClick={() => setShowImportExport(true)}>
              <Upload className="w-4 h-4" />
              Import
            </Button>
          )}
          {hasPermission("customers:create") && (
            <Button
              onClick={() => { setEditingCustomer(null); setShowForm(true); }}
            >
              <Plus className="w-4 h-4" />
              Thêm mới
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Tên HKD, chủ hộ, Mã KH, SĐT, ĐKKD..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Chi nhánh</label>
            <select
              value={filters.branchId || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, branchId: e.target.value || undefined, departmentId: undefined, consultantId: undefined, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              {branchesData?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phòng ban</label>
            <select
              value={filters.departmentId || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, departmentId: e.target.value || undefined, consultantId: undefined, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              disabled={!filters.branchId}
            >
              <option value="">Tất cả</option>
              {departmentsData?.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CBTV</label>
            <select
              value={filters.consultantId || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, consultantId: e.target.value || undefined, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              {consultantsData?.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName} ({c.employeeCode})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Phần mềm</label>
            <select
              value={filters.software || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, software: e.target.value || undefined, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="MISA">MISA</option>
              <option value="VNPAY">VNPAY</option>
              <option value="NO">Không có</option>
              <option value="OTHER">Khác</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tài khoản</label>
            <select
              value={filters.hasAccount === undefined ? "" : String(filters.hasAccount)}
              onChange={(e) => setFilters((prev) => ({ ...prev, hasAccount: e.target.value === "" ? undefined : e.target.value === "true", page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="true">Có TK</option>
              <option value="false">Chưa có</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Agribank+</label>
            <select
              value={filters.hasAgribankPlus === undefined ? "" : String(filters.hasAgribankPlus)}
              onChange={(e) => setFilters((prev) => ({ ...prev, hasAgribankPlus: e.target.value === "" ? undefined : e.target.value === "true", page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="true">Có</option>
              <option value="false">Chưa có</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nhóm</label>
            <select
              value={filters.customerGroup === undefined ? "" : String(filters.customerGroup)}
              onChange={(e) => setFilters((prev) => ({ ...prev, customerGroup: e.target.value === "" ? undefined : Number(e.target.value), page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">STK sai format</label>
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md text-sm bg-white cursor-pointer">
              <input
                type="checkbox"
                checked={!!filters.invalidAccount}
                onChange={(e) => setFilters((prev) => ({ ...prev, invalidAccount: e.target.checked || undefined, page: 1 }))}
                className="w-4 h-4"
              />
              <span className="text-gray-700">Chỉ KH lỗi</span>
            </label>
          </div>
          <Button type="submit" variant="secondary">
            Lọc
          </Button>
        </form>
      </div>

      {/* Table — desktop only */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tên HKD</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Chủ hộ</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Mã KH</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">SĐT</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">TK</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Số dư</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">AG+</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">PM</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Nhóm</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">CBTV</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.data.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setViewingCustomer(customer)}
                    >
                      <td className="px-4 py-3 font-medium">{customer.businessName}</td>
                      <td className="px-4 py-3">{customer.ownerName}</td>
                      <td className="px-4 py-3">{customer.customerCode || "-"}</td>
                      <td className="px-4 py-3">{customer.phone}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block w-2 h-2 rounded-full ${customer.hasAccount ? "bg-green-500" : "bg-gray-300"}`} />
                      </td>
                      <td className="px-4 py-3">{Number(customer.balance).toLocaleString("vi-VN")}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block w-2 h-2 rounded-full ${customer.hasAgribankPlus ? "bg-green-500" : "bg-gray-300"}`} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            customer.software === "MISA" ? "info" :
                            customer.software === "VNPAY" ? "success" :
                            customer.software === "OTHER" ? "warning" : "neutral"
                          }
                        >
                          {customer.software}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            customer.customerGroup === 1 ? "info" :
                            customer.customerGroup === 2 ? "success" :
                            customer.customerGroup === 3 ? "warning" : "neutral"
                          }
                        >
                          {customer.customerGroup}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{customer.consultantName || "-"}</td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setViewingCustomer(customer)}
                            className="p-1 text-gray-500 hover:text-agribank"
                            title="Xem chi tiết"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {hasPermission("customers:update") && (
                            <button
                              onClick={() => { setEditingCustomer(customer); setShowForm(true); }}
                              className="p-1 text-gray-500 hover:text-agribank"
                              title="Sửa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {hasPermission("customers:delete") && (
                            <button
                              onClick={() => setDeletingCustomer(customer)}
                              className="p-1 text-gray-500 hover:text-red-600"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data?.data.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

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

      {/* Card list — mobile only */}
      <div className="md:hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3">
              {data?.data.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onView={setViewingCustomer}
                  onEdit={hasPermission("customers:update") ? (c) => { setEditingCustomer(c); setShowForm(true); } : undefined}
                  onDelete={hasPermission("customers:delete") ? setDeletingCustomer : undefined}
                />
              ))}
            </div>
            {data?.data.length === 0 && (
              <div className="p-8 text-center text-gray-500">Không có dữ liệu</div>
            )}
            {data?.pagination && (
              <div className="mt-4">
                <Pagination
                  page={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  total={data.pagination.total}
                  onPageChange={(p) => setFilters((prev) => ({ ...prev, page: p }))}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Customer Form Modal */}
      <CustomerForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditingCustomer(null); }}
        customer={editingCustomer}
      />

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        open={!!viewingCustomer}
        onClose={() => setViewingCustomer(null)}
        customer={viewingCustomer}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingCustomer}
        onClose={() => setDeletingCustomer(null)}
        onConfirm={() => deletingCustomer && deleteMutation.mutate(deletingCustomer.id)}
        title="Xóa khách hàng"
        message={`Bạn có chắc muốn xóa khách hàng "${deletingCustomer?.businessName}"?`}
        confirmText="Xóa"
        loading={deleteMutation.isPending}
      />

      <ImportExportDialog
        open={showImportExport}
        onClose={() => setShowImportExport(false)}
        onImportSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        }}
      />
    </div>
  );
}
