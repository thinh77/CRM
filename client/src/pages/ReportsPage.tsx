import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Users, CreditCard, Smartphone, Monitor, Layers } from "lucide-react";
import { toast } from "sonner";
import { reportsApi } from "@/api/reports.api";
import { organizationApi } from "@/api/organization.api";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { formatReportExportFilename } from "@/utils/reportFilenames";

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-full ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ReportsPage() {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [filters, setFilters] = useState({
    dateFrom: formatDateForInput(firstDayOfMonth),
    dateTo: formatDateForInput(today),
    branchId: "",
    departmentId: "",
    customerGroup: "",
  });

  const { data: branchList = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => organizationApi.listBranches(),
  });

  const { data: departmentList = [] } = useQuery({
    queryKey: ["departments", filters.branchId],
    queryFn: () => organizationApi.listDepartments(filters.branchId),
    enabled: !!filters.branchId,
  });

  const hasInvalidRange = !!(
    filters.dateFrom &&
    filters.dateTo &&
    filters.dateFrom > filters.dateTo
  );

  const queryFilters = useMemo(
    () => ({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      branchId: filters.branchId || undefined,
      departmentId: filters.departmentId || undefined,
      customerGroup: filters.customerGroup ? Number(filters.customerGroup) : undefined,
    }),
    [filters.dateFrom, filters.dateTo, filters.branchId, filters.departmentId, filters.customerGroup]
  );

  const { data, isLoading } = useQuery({
    queryKey: ["reports", queryFilters],
    queryFn: () => reportsApi.getData(queryFilters).then((res) => res.data.data),
    enabled: !hasInvalidRange,
  });

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingBalance, setIsExportingBalance] = useState(false);

  const handleExport = async () => {
    if (hasInvalidRange) {
      toast.error("Khoảng thời gian không hợp lệ");
      return;
    }

    try {
      const res = await reportsApi.exportExcel(queryFilters);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = formatReportExportFilename();
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Xuất báo cáo thành công");
    } catch {
      toast.error("Xuất báo cáo thất bại");
    }
  };

  const handleExportBalance = async () => {
    if (hasInvalidRange) {
      toast.error("Khoảng thời gian không hợp lệ");
      return;
    }
    setIsExportingBalance(true);
    try {
      const res = await reportsApi.exportBalanceByOrg({
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        branchId: filters.branchId || undefined,
        departmentId: filters.departmentId || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "bao-cao-so-du-theo-don-vi.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Xuất báo cáo số dư thành công");
    } catch {
      toast.error("Xuất báo cáo số dư thất bại");
    } finally {
      setIsExportingBalance(false);
    }
  };

  const handleExportPdf = async () => {
    if (hasInvalidRange) {
      toast.error("Khoảng thời gian không hợp lệ");
      return;
    }
    setIsExportingPdf(true);
    try {
      const res = await reportsApi.exportPdf({
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      const rangeSuffix =
        filters.dateFrom && filters.dateTo
          ? `${filters.dateFrom}_${filters.dateTo}`
          : filters.dateFrom || filters.dateTo || "toan-thoi-gian";
      link.download = `bao-cao-tong-hop-kh_${rangeSuffix}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Xuất PDF thành công");
    } catch {
      toast.error("Xuất PDF thất bại");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo KH mới</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleExportPdf}
            disabled={isExportingPdf || hasInvalidRange}
            title="Báo cáo PDF tổng hợp theo chi nhánh & phòng ban (toàn hệ thống)"
          >
            <FileText className="w-4 h-4" />
            Xuất PDF
          </Button>
          <Button
            variant="secondary"
            onClick={handleExportBalance}
            disabled={isExportingBalance || hasInvalidRange}
            title="Tổng hợp số dư theo chi nhánh / phòng ban / cán bộ tư vấn (sort giảm dần)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất báo cáo số dư
          </Button>
          <Button onClick={handleExport} disabled={isLoading || hasInvalidRange}>
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Excel
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
          <DateInput
            label="Từ ngày"
            value={filters.dateFrom}
            onChange={(val) => setFilters((prev) => ({ ...prev, dateFrom: val }))}
          />

          <DateInput
            label="Đến ngày"
            value={filters.dateTo}
            onChange={(val) => setFilters((prev) => ({ ...prev, dateTo: val }))}
          />

          <div>
            <label className="block text-xs text-gray-500 mb-1">Chi nhánh</label>
            <select
              value={filters.branchId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  branchId: e.target.value,
                  departmentId: "",
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              {branchList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Phòng ban</label>
            <select
              value={filters.departmentId}
              disabled={!filters.branchId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  departmentId: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Tất cả</option>
              {departmentList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Nhóm</label>
            <select
              value={filters.customerGroup}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  customerGroup: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="1">Nhóm 1</option>
              <option value="2">Nhóm 2</option>
              <option value="3">Nhóm 3</option>
              <option value="4">Nhóm 4</option>
            </select>
          </div>

          <Button
            variant="secondary"
            onClick={() =>
              setFilters({
                dateFrom: formatDateForInput(firstDayOfMonth),
                dateTo: formatDateForInput(today),
                branchId: "",
                departmentId: "",
                customerGroup: "",
              })
            }
          >
            Đặt lại
          </Button>
        </div>
        {hasInvalidRange && (
          <p className="mt-2 text-sm text-red-600">Từ ngày không được lớn hơn đến ngày</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <StatCard title="Tổng KH mới" value={data?.stats.total || 0} icon={Users} color="bg-agribank-500" />
        <StatCard title="Có tài khoản" value={data?.stats.withAccount || 0} icon={CreditCard} color="bg-green-500" />
        <StatCard title="Agribank Plus" value={data?.stats.withAgribankPlus || 0} icon={Smartphone} color="bg-agribank-500" />
        <StatCard title="Dùng MISA" value={data?.stats.useMisa || 0} icon={Monitor} color="bg-blue-500" />
        <StatCard title="Dùng VNPAY" value={data?.stats.useVnpay || 0} icon={Monitor} color="bg-emerald-600" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard title="Nhóm 1" value={data?.stats.group1 || 0} icon={Layers} color="bg-blue-500" />
        <StatCard title="Nhóm 2" value={data?.stats.group2 || 0} icon={Layers} color="bg-green-500" />
        <StatCard title="Nhóm 3" value={data?.stats.group3 || 0} icon={Layers} color="bg-yellow-500" />
        <StatCard title="Nhóm 4" value={data?.stats.group4 || 0} icon={Layers} color="bg-gray-500" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 text-sm text-gray-600">
        {isLoading
          ? "Đang tải số liệu báo cáo..."
          : "Báo cáo chi tiết đã được tối ưu cho file Excel. Vui lòng bấm \"Xuất Excel\" để tải dữ liệu đầy đủ."}
      </div>
    </div>
  );
}
