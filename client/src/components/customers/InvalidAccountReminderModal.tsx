import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { customersApi } from "@/api/customers.api";
import { useAuthStore } from "@/stores/authStore";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const PREVIEW_LIMIT = 10;

export function InvalidAccountReminderModal() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const [isOpen, setIsOpen] = useState(false);
  const hasOpenedRef = useRef(false);

  const { data } = useQuery({
    queryKey: ["customers", "invalid-account-reminder", userId],
    queryFn: () =>
      customersApi
        .list({ invalidAccount: true, consultantId: userId, limit: PREVIEW_LIMIT, page: 1 })
        .then((res) => res.data),
    enabled: !!userId,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (hasOpenedRef.current) return;
    if (data && data.pagination.total > 0) {
      hasOpenedRef.current = true;
      setIsOpen(true);
    }
  }, [data]);

  if (!data || data.pagination.total === 0) return null;

  const total = data.pagination.total;
  const rows = data.data;
  const remaining = total - rows.length;

  const handleViewList = () => {
    setIsOpen(false);
    navigate(`/customers?invalidAccount=true&consultantId=${userId}`);
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => setIsOpen(false)}
      size="lg"
      title="Có khách hàng cần cập nhật số tài khoản"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md bg-amber-50 border border-amber-200 p-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-900">
            Có <strong>{total}</strong> khách hàng do bạn quản lý có số tài khoản
            không đúng định dạng (phải gồm 13 chữ số). Vui lòng cập nhật lại.
          </p>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Tên HKD</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Chủ hộ</th>
                <th className="text-left px-3 py-2 font-medium text-gray-600">Số TK hiện tại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">{c.businessName}</td>
                  <td className="px-3 py-2">{c.ownerName}</td>
                  <td className="px-3 py-2 font-mono text-red-600">{c.accountNumber || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {remaining > 0 && (
          <p className="text-sm text-gray-500">
            ...và {remaining} khách hàng khác.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => setIsOpen(false)}>
            Để sau
          </Button>
          <Button onClick={handleViewList}>Xem danh sách</Button>
        </div>
      </div>
    </Modal>
  );
}
