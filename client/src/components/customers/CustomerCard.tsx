import { Eye, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { Customer } from "@/types";

interface CustomerCardProps {
  customer: Customer;
  onView: (c: Customer) => void;
  onEdit?: (c: Customer) => void;
  onDelete?: (c: Customer) => void;
}

export function CustomerCard({ customer, onView, onEdit, onDelete }: CustomerCardProps) {
  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 active:bg-gray-50"
      onClick={() => onView(customer)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{customer.businessName}</h3>
          <p className="text-sm text-gray-600 truncate">{customer.ownerName}</p>
        </div>
        <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onView(customer)} className="p-1.5 text-gray-400 hover:text-agribank" title="Xem">
            <Eye className="w-4 h-4" />
          </button>
          {onEdit && (
            <button onClick={() => onEdit(customer)} className="p-1.5 text-gray-400 hover:text-agribank" title="Sửa">
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(customer)} className="p-1.5 text-gray-400 hover:text-red-600" title="Xóa">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Info rows */}
      <div className="space-y-1 text-sm text-gray-600 mb-3">
        {customer.phone && (
          <p>📞 {customer.phone}</p>
        )}
        <p>💰 {Number(customer.balance).toLocaleString("vi-VN")} đ</p>
        {customer.consultantName && (
          <p className="truncate">👤 {customer.consultantName}</p>
        )}
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
            customer.software === "MISA" ? "info" :
            customer.software === "VNPAY" ? "success" :
            customer.software === "OTHER" ? "warning" : "neutral"
          }
        >
          {customer.software}
        </Badge>
        <Badge
          variant={
            customer.customerGroup === 1 ? "info" :
            customer.customerGroup === 2 ? "success" :
            customer.customerGroup === 3 ? "warning" : "neutral"
          }
        >
          N{customer.customerGroup}
        </Badge>
      </div>
    </div>
  );
}
