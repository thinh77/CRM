import { useMemo, useState, type ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, type DashboardPeriod } from "@/api/dashboard.api";
import {
  Building2,
  CreditCard,
  Smartphone,
  Wallet,
  TrendingUp,
  UserPlus,
  Trophy,
  Monitor,
  Users,
} from "lucide-react";
import type { TopConsultant } from "@/types";

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  description?: string;
  icon: ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {description ? <p className="text-xs text-gray-500 mt-1">{description}</p> : null}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function TopConsultantsTable({
  title,
  rows,
  isLoading,
}: {
  title: string;
  rows: TopConsultant[] | undefined;
  isLoading: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        {title}
      </h2>
      {isLoading ? (
        <p className="text-gray-400 text-sm">Đang tải dữ liệu...</p>
      ) : rows && rows.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-gray-500 font-medium w-8">#</th>
              <th className="text-left py-2 text-gray-500 font-medium">Cán bộ</th>
              <th className="text-left py-2 text-gray-500 font-medium">Mã NV</th>
              <th className="text-right py-2 text-gray-500 font-medium">SL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.consultantId} className="border-b border-gray-100 last:border-0">
                <td className="py-2 font-semibold text-agribank-600">{index + 1}</td>
                <td className="py-2">{row.fullName}</td>
                <td className="py-2 text-gray-500">{row.employeeCode}</td>
                <td className="py-2 text-right font-semibold">{Number(row.customerCount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-400 text-sm">Chưa có dữ liệu</p>
      )}
    </div>
  );
}

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
];

export function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["dashboard-stats", period],
    queryFn: () => dashboardApi.getStats(period).then((res) => res.data.data),
  });

  const { data: topTotal, isLoading: isTopTotalLoading } = useQuery({
    queryKey: ["top-consultants", "total"],
    queryFn: () =>
      dashboardApi.getTopConsultants("month", "total").then((res) => res.data.data),
  });

  const { data: topNew, isLoading: isTopNewLoading } = useQuery({
    queryKey: ["top-consultants", period, "new"],
    queryFn: () =>
      dashboardApi.getTopConsultants(period, "new").then((res) => res.data.data),
  });

  const { data: topSoftware, isLoading: isTopSoftwareLoading } = useQuery({
    queryKey: ["top-consultants", period, "software"],
    queryFn: () =>
      dashboardApi.getTopConsultants(period, "software").then((res) => res.data.data),
  });

  const software = useMemo(() => {
    const misa = stats?.customers.useMisa || 0;
    const vnpay = stats?.customers.useVnpay || 0;
    const other = stats?.customers.otherSoftware || 0;
    const total = misa + vnpay + other;
    return { misa, vnpay, other, total };
  }, [stats?.customers.otherSoftware, stats?.customers.useMisa, stats?.customers.useVnpay]);

  const growthSoftwareTotal = (stats?.growth.newMisa || 0) + (stats?.growth.newVnpay || 0);
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label || "Tháng này";

  if (isStatsLoading && !stats) {
    return <div className="text-gray-500">Đang tải...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Tổng khách hàng"
          value={stats?.customers.total || 0}
          icon={Building2}
          color="bg-agribank-500"
        />
        <StatCard
          title="Có tài khoản"
          value={stats?.customers.withAccount || 0}
          icon={CreditCard}
          color="bg-green-500"
        />
        <StatCard
          title="Agribank Plus"
          value={stats?.customers.withAgribankPlus || 0}
          icon={Smartphone}
          color="bg-agribank-500"
        />
        <StatCard
          title="Tổng số dư"
          value={`${Number(stats?.customers.totalBalance || 0).toLocaleString("vi-VN")} đ`}
          icon={Wallet}
          color="bg-emerald-600"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Phần mềm sử dụng</h2>
        <p className="text-sm text-gray-500 mb-4">
          Tổng KH dùng PM: <strong>{software.total}</strong> / {stats?.customers.total || 0}
        </p>
        <div className="space-y-3">
          {[
            { label: "MISA", value: software.misa, color: "bg-agribank-500" },
            { label: "VNPAY", value: software.vnpay, color: "bg-green-500" },
            { label: "Khác", value: software.other, color: "bg-yellow-500" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-sm text-gray-600 w-20">{item.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-4">
                <div
                  className={`${item.color} h-4 rounded-full transition-all`}
                  style={{ width: `${software.total ? (item.value / software.total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-medium w-10 text-right">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Nhóm khách hàng</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Nhóm 1"
            value={stats?.customers.group1 || 0}
            icon={Users}
            color="bg-agribank-500"
          />
          <StatCard
            title="Nhóm 2"
            value={stats?.customers.group2 || 0}
            icon={Users}
            color="bg-green-500"
          />
          <StatCard
            title="Nhóm 3"
            value={stats?.customers.group3 || 0}
            icon={Users}
            color="bg-yellow-500"
          />
          <StatCard
            title="Nhóm 4"
            value={stats?.customers.group4 || 0}
            icon={Users}
            color="bg-gray-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-agribank-500" />
            Tăng trưởng ({periodLabel})
          </h2>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === option.value
                    ? "bg-agribank text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="KH mới"
            value={stats?.growth.newCustomers || 0}
            icon={UserPlus}
            color="bg-agribank-600"
          />
          <StatCard
            title="Đăng ký AG+"
            value={stats?.growth.newAgribankPlus || 0}
            icon={Smartphone}
            color="bg-agribank-500"
          />
          <StatCard
            title="Đăng ký phần mềm"
            value={growthSoftwareTotal}
            description={`MISA: ${stats?.growth.newMisa || 0} · VNPAY: ${stats?.growth.newVnpay || 0}`}
            icon={Monitor}
            color="bg-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <TopConsultantsTable
          title="Top CBTV - Tổng KH"
          rows={topTotal}
          isLoading={isTopTotalLoading}
        />
        <TopConsultantsTable
          title={`Top CBTV - KH mới (${periodLabel})`}
          rows={topNew}
          isLoading={isTopNewLoading}
        />
        <TopConsultantsTable
          title={`Top CBTV - PM mới (${periodLabel})`}
          rows={topSoftware}
          isLoading={isTopSoftwareLoading}
        />
      </div>
    </div>
  );
}
