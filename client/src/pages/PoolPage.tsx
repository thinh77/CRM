import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { poolApi, type PoolFilters } from "@/api/pool.api";
import { Search, CheckCheck, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CustomerDetailModal } from "@/components/customers/CustomerDetailModal";
import type { Customer } from "@/types";

export function PoolPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PoolFilters>({
    page: 1,
    limit: 20,
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["pool", filters],
    queryFn: () => poolApi.list(filters).then((res) => res.data),
  });

  // Clear selection when filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filters]);

  const claimMutation = useMutation({
    mutationFn: (customerIds: string[]) => poolApi.claim(customerIds),
    onSuccess: (res) => {
      const { claimed, alreadyClaimed } = res.data.data;
      const total = claimed + alreadyClaimed;

      if (alreadyClaimed === 0) {
        toast.success(`Đã nhận ${claimed} khách hàng thành công`);
      } else if (claimed > 0) {
        toast.warning(
          `Đã nhận ${claimed}/${total} khách hàng. ${alreadyClaimed} khách hàng đã được người khác nhận trước.`
        );
      } else {
        toast.warning("Tất cả khách hàng đã được nhận trước đó");
      }

      queryClient.invalidateQueries({ queryKey: ["pool"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setSelectedIds(new Set());
      setShowClaimConfirm(false);
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Nhận khách hàng thất bại";
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr.response?.data?.message || message);
      setShowClaimConfirm(false);
    },
  });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!data?.data) return;
    const pageIds = data.data.map((c) => c.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [data?.data, selectedIds]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, page: 1 }));
  };

  const handleClaim = () => {
    claimMutation.mutate(Array.from(selectedIds));
  };

  const selectedCount = selectedIds.size;
  const pageIds = data?.data?.map((c) => c.id) ?? [];
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            Pool - Khách hàng chưa gán
          </h1>
          {data?.pagination && (
            <Badge variant="info" className="text-sm px-3 py-1">
              {data.pagination.total}
            </Badge>
          )}
        </div>
        <Button
          onClick={() => setShowClaimConfirm(true)}
          disabled={selectedCount === 0}
          className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
        >
          <CheckCheck className="w-4 h-4" />
          Nhận đã chọn ({selectedCount})
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <form onSubmit={handleSearch} className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">
              Tìm kiếm
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                placeholder="Tên HKD, chủ hộ, SĐT, ĐKKD..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Phần mềm
            </label>
            <select
              value={filters.software || ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  software: e.target.value || undefined,
                  page: 1,
                }))
              }
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
            <label className="block text-xs text-gray-500 mb-1">
              Tài khoản
            </label>
            <select
              value={
                filters.hasAccount === undefined
                  ? ""
                  : String(filters.hasAccount)
              }
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  hasAccount:
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  page: 1,
                }))
              }
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="true">Có TK</option>
              <option value="false">Chưa có</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Agribank+
            </label>
            <select
              value={
                filters.hasAgribankPlus === undefined
                  ? ""
                  : String(filters.hasAgribankPlus)
              }
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  hasAgribankPlus:
                    e.target.value === ""
                      ? undefined
                      : e.target.value === "true",
                  page: 1,
                }))
              }
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
              value={
                filters.customerGroup === undefined
                  ? ""
                  : String(filters.customerGroup)
              }
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  customerGroup:
                    e.target.value === ""
                      ? undefined
                      : Number(e.target.value),
                  page: 1,
                }))
              }
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Lọc
          </Button>
        </form>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-500">Không thể tải dữ liệu. Vui lòng thử lại.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Tên HKD
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Chủ hộ
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      SĐT
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      TK
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Số dư
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      AG+
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      PM
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">
                      Nhóm
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.data?.map((customer) => (
                    <PoolTableRow
                      key={customer.id}
                      customer={customer}
                      selected={selectedIds.has(customer.id)}
                      onToggle={toggleSelect}
                      onView={setViewingCustomer}
                    />
                  ))}
                  {(data?.data?.length ?? 0) === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-gray-500"
                      >
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
                onPageChange={(p) =>
                  setFilters((prev) => ({ ...prev, page: p }))
                }
              />
            )}
          </>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-500">Không thể tải dữ liệu. Vui lòng thử lại.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3">
              {data?.data?.map((customer) => (
                <PoolMobileCard
                  key={customer.id}
                  customer={customer}
                  selected={selectedIds.has(customer.id)}
                  onToggle={toggleSelect}
                  onView={setViewingCustomer}
                />
              ))}
            </div>
            {(data?.data?.length ?? 0) === 0 && (
              <div className="p-8 text-center text-gray-500">
                Không có dữ liệu
              </div>
            )}
            {data?.pagination && (
              <div className="mt-4">
                <Pagination
                  page={data.pagination.page}
                  totalPages={data.pagination.totalPages}
                  total={data.pagination.total}
                  onPageChange={(p) =>
                    setFilters((prev) => ({ ...prev, page: p }))
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      <CustomerDetailModal
        open={!!viewingCustomer}
        onClose={() => setViewingCustomer(null)}
        customer={viewingCustomer}
      />

      {/* Claim Confirmation */}
      <ConfirmDialog
        open={showClaimConfirm}
        onClose={() => setShowClaimConfirm(false)}
        onConfirm={handleClaim}
        title="Nhận khách hàng"
        message={`Bạn muốn nhận ${selectedCount} khách hàng về quản lý?`}
        confirmText="Nhận"
        variant="primary"
        loading={claimMutation.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop table row                                                   */
/* ------------------------------------------------------------------ */

interface PoolTableRowProps {
  customer: Customer;
  selected: boolean;
  onToggle: (id: string) => void;
  onView: (customer: Customer) => void;
}

function PoolTableRow({
  customer,
  selected,
  onToggle,
  onView,
}: PoolTableRowProps) {
  return (
    <tr
      className={`cursor-pointer transition-colors ${
        selected ? "bg-green-50" : "hover:bg-gray-50"
      }`}
      onClick={() => onToggle(customer.id)}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(customer.id)}
          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
      </td>
      <td className="px-4 py-3 font-medium">{customer.businessName}</td>
      <td className="px-4 py-3">{customer.ownerName}</td>
      <td className="px-4 py-3">{customer.phone}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            customer.hasAccount ? "bg-green-500" : "bg-gray-300"
          }`}
        />
      </td>
      <td className="px-4 py-3">
        {Number(customer.balance).toLocaleString("vi-VN")}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            customer.hasAgribankPlus ? "bg-green-500" : "bg-gray-300"
          }`}
        />
      </td>
      <td className="px-4 py-3">
        <Badge
          variant={
            customer.software === "MISA"
              ? "info"
              : customer.software === "VNPAY"
                ? "success"
                : customer.software === "OTHER"
                  ? "warning"
                  : "neutral"
          }
        >
          {customer.software}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge
          variant={
            customer.customerGroup === 1
              ? "info"
              : customer.customerGroup === 2
                ? "success"
                : customer.customerGroup === 3
                  ? "warning"
                  : "neutral"
          }
        >
          {customer.customerGroup}
        </Badge>
      </td>
      <td
        className="px-4 py-3 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onView(customer)}
          className="p-1 text-gray-500 hover:text-agribank"
          title="Xem chi tiết"
          aria-label="Xem chi tiết khách hàng"
        >
          <Eye className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile card                                                         */
/* ------------------------------------------------------------------ */

interface PoolMobileCardProps {
  customer: Customer;
  selected: boolean;
  onToggle: (id: string) => void;
  onView: (customer: Customer) => void;
}

function PoolMobileCard({
  customer,
  selected,
  onToggle,
  onView,
}: PoolMobileCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border shadow-sm p-4 cursor-pointer transition-colors ${
        selected
          ? "border-green-300 bg-green-50"
          : "border-gray-200 active:bg-gray-50"
      }`}
      onClick={() => onToggle(customer.id)}
    >
      {/* Header with checkbox */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {customer.businessName}
          </h3>
          <p className="text-sm text-gray-600 truncate">{customer.ownerName}</p>
        </div>
        <div
          className="shrink-0 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onView(customer)}
            className="p-1.5 text-gray-500 hover:text-agribank"
            title="Xem chi tiết"
            aria-label="Xem chi tiết khách hàng"
          >
            <Eye className="w-4 h-4" />
          </button>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(customer.id)}
            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1 text-sm text-gray-600 mb-3">
        {customer.phone && <p>📞 {customer.phone}</p>}
        <p>💰 {Number(customer.balance).toLocaleString("vi-VN")} đ</p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={customer.hasAccount ? "success" : "neutral"}>
          {customer.hasAccount ? "Có TK" : "Chưa TK"}
        </Badge>
        <Badge variant={customer.hasAgribankPlus ? "success" : "neutral"}>
          {customer.hasAgribankPlus ? "AG+" : "Chưa AG+"}
        </Badge>
        <Badge
          variant={
            customer.software === "MISA"
              ? "info"
              : customer.software === "VNPAY"
                ? "success"
                : customer.software === "OTHER"
                  ? "warning"
                  : "neutral"
          }
        >
          {customer.software}
        </Badge>
        <Badge
          variant={
            customer.customerGroup === 1
              ? "info"
              : customer.customerGroup === 2
                ? "success"
                : customer.customerGroup === 3
                  ? "warning"
                  : "neutral"
          }
        >
          N{customer.customerGroup}
        </Badge>
      </div>
    </div>
  );
}
