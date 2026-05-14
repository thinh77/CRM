import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogsApi, type AuditLog, type AuditLogFilters } from "@/api/audit-logs.api";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { ITEMS_PER_PAGE } from "@/lib/constants";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  LOGIN: "Đăng nhập",
  EXPORT: "Xuất",
  IMPORT: "Nhập",
};

const ACTION_VARIANTS: Record<string, "success" | "error" | "warning" | "info" | "neutral"> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "error",
  LOGIN: "info",
  EXPORT: "warning",
  IMPORT: "warning",
};

const RESOURCE_LABELS: Record<string, string> = {
  customers: "Khách hàng",
  users: "Người dùng",
  roles: "Vai trò",
  branches: "Chi nhánh",
  departments: "Phòng ban",
  positions: "Chức vụ",
  organization: "Tổ chức",
};

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, limit: ITEMS_PER_PAGE });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => auditLogsApi.list(filters).then((res) => res.data),
  });

  const logs = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nhật ký hoạt động</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hành động</label>
            <select
              value={filters.action || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value || undefined, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="CREATE">Tạo mới</option>
              <option value="UPDATE">Cập nhật</option>
              <option value="DELETE">Xóa</option>
              <option value="LOGIN">Đăng nhập</option>
              <option value="EXPORT">Xuất</option>
              <option value="IMPORT">Nhập</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Đối tượng</label>
            <select
              value={filters.resource || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, resource: e.target.value || undefined, page: 1 }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Tất cả</option>
              <option value="customers">Khách hàng</option>
              <option value="users">Người dùng</option>
              <option value="roles">Vai trò</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Thời gian</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Người thực hiện</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Hành động</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Đối tượng</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Giá trị cũ</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Giá trị mới</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => {
                    const changedKeys = getChangedKeys(log.oldData, log.newData);
                    const oldSummary = summarizeData(log.oldData, changedKeys);
                    const newSummary = summarizeData(log.newData, changedKeys);

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(log.createdAt).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{log.userName || "-"}</span>
                          {log.employeeCode && (
                            <span className="text-gray-400 ml-1">({log.employeeCode})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={ACTION_VARIANTS[log.action] || "neutral"}>
                            {ACTION_LABELS[log.action] || log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {RESOURCE_LABELS[log.resource] || log.resource}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs">
                          <span className="block truncate" title={oldSummary}>
                            {oldSummary}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs">
                          <span className="block truncate" title={newSummary}>
                            {newSummary}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{log.ipAddress || "-"}</td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
                onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
              />
            )}
          </>
        )}
      </div>

      <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}

function AuditLogDetailModal({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const oldRecord = toRecord(log?.oldData);
  const newRecord = toRecord(log?.newData);
  const changedKeys = getChangedKeys(log?.oldData ?? null, log?.newData ?? null);
  const allKeys = new Set<string>([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
  const unchangedKeys = Array.from(allKeys).filter((key) => !changedKeys.includes(key)).sort();
  const orderedKeys = [...changedKeys, ...unchangedKeys];

  const changedSet = new Set(changedKeys);

  return (
    <Modal open={Boolean(log)} onClose={onClose} title="Chi tiết nhật ký" size="xl">
      {!log ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Thời gian: </span>
              <span className="font-medium">{new Date(log.createdAt).toLocaleString("vi-VN")}</span>
            </div>
            <div>
              <span className="text-gray-500">Người thực hiện: </span>
              <span className="font-medium">
                {log.userName || "-"}
                {log.employeeCode ? ` (${log.employeeCode})` : ""}
              </span>
            </div>
            <div>
              <span className="text-gray-500">IP: </span>
              <span className="font-mono">{log.ipAddress || "-"}</span>
            </div>
            <div>
              <span className="text-gray-500">Hành động: </span>
              <Badge variant={ACTION_VARIANTS[log.action] || "neutral"}>
                {ACTION_LABELS[log.action] || log.action}
              </Badge>
            </div>
            <div>
              <span className="text-gray-500">Đối tượng: </span>
              <span className="font-medium">{RESOURCE_LABELS[log.resource] || log.resource}</span>
            </div>
            <div>
              <span className="text-gray-500">Mã đối tượng: </span>
              <span className="font-mono text-xs break-all">{log.resourceId || "-"}</span>
            </div>
          </div>

          {orderedKeys.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded-md">
              Không có dữ liệu giá trị cũ/mới để so sánh.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 w-1/5">Trường</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 w-2/5">Giá trị cũ</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 w-2/5">Giá trị mới</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orderedKeys.map((key) => (
                    <tr key={key} className={changedSet.has(key) ? "bg-yellow-50" : ""}>
                      <td className="px-4 py-2 font-medium text-gray-700 align-top">{key}</td>
                      <td className="px-4 py-2 align-top">
                        <pre className="whitespace-pre-wrap break-words text-xs font-mono text-gray-700">
                          {formatDetailedValue(oldRecord[key])}
                        </pre>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <pre className="whitespace-pre-wrap break-words text-xs font-mono text-gray-700">
                          {formatDetailedValue(newRecord[key])}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function toRecord(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return {};
  }
  return value;
}

function getChangedKeys(
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null
): string[] {
  const oldRecord = toRecord(oldData);
  const newRecord = toRecord(newData);
  const keySet = new Set<string>([...Object.keys(oldRecord), ...Object.keys(newRecord)]);

  return Array.from(keySet)
    .filter((key) => JSON.stringify(oldRecord[key]) !== JSON.stringify(newRecord[key]))
    .sort();
}

function summarizeData(
  data: Record<string, unknown> | null,
  prioritizedKeys: string[]
): string {
  const record = toRecord(data);
  const recordKeys = Object.keys(record);

  if (recordKeys.length === 0) {
    return "-";
  }

  const keys =
    prioritizedKeys.length > 0
      ? prioritizedKeys.filter((key) => key in record)
      : recordKeys;
  const shownKeys = keys.slice(0, 2);

  const preview = shownKeys.map((key) => `${key}: ${truncate(formatSummaryValue(record[key]), 28)}`);
  const remaining = keys.length - shownKeys.length;

  return remaining > 0 ? `${preview.join(" | ")} | +${remaining} trường` : preview.join(" | ");
}

function formatSummaryValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatDetailedValue(value: unknown): string {
  if (value === undefined) return "-";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}
