import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { Customer } from "@/types";

interface CustomerDetailModalProps {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value || "-"}</dd>
    </div>
  );
}

function formatDateVN(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function CustomerDetailModal({ open, onClose, customer }: CustomerDetailModalProps) {
  if (!customer) return null;

  return (
    <Modal open={open} onClose={onClose} title="Chi tiết khách hàng" size="lg">
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tên HKD" value={customer.businessName} />
        <Field label="Chủ hộ" value={customer.ownerName} />
        <Field label="Mã KH" value={customer.customerCode} />
        <Field label="Số ĐKKD" value={customer.registrationNumber} />
        <Field label="SĐT" value={customer.phone} />
        <div className="md:col-span-2">
          <Field label="Địa chỉ" value={customer.address} />
        </div>
        <Field
          label="Tài khoản"
          value={
            <Badge variant={customer.hasAccount ? "success" : "neutral"}>
              {customer.hasAccount ? "Có" : "Không"}
            </Badge>
          }
        />
        <Field label="Số TK" value={customer.accountNumber} />
        <Field
          label="Số dư"
          value={`${Number(customer.balance).toLocaleString("vi-VN")} đ`}
        />
        <Field
          label="Agribank Plus"
          value={
            <Badge variant={customer.hasAgribankPlus ? "success" : "neutral"}>
              {customer.hasAgribankPlus ? "Có" : "Không"}
            </Badge>
          }
        />
        <Field
          label="Phần mềm"
          value={
            <Badge
              variant={
                customer.software === "MISA" ? "info" :
                customer.software === "VNPAY" ? "success" :
                customer.software === "OTHER" ? "warning" : "neutral"
              }
            >
              {customer.software}
            </Badge>
          }
        />
        <Field label="Nhóm" value={customer.customerGroup} />
        <Field label="Cán bộ tư vấn" value={customer.consultantName} />
        <Field label="Nguồn" value={customer.leadSource} />
        <div className="md:col-span-2">
          <Field label="Ghi chú" value={customer.notes} />
        </div>
        <Field
          label="Ngày tạo"
          value={formatDateVN(customer.createdAt)}
        />
        <Field
          label="Cập nhật lần cuối"
          value={formatDateVN(customer.updatedAt)}
        />
      </dl>
    </Modal>
  );
}
