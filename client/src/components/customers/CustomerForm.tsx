import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { customersApi } from "@/api/customers.api";
import { usersApi } from "@/api/users.api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DateInput } from "@/components/ui/DateInput";
import { Select } from "@/components/ui/Select";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import type { Customer } from "@/types";
import { useAuthStore } from "@/stores/authStore";

const customerSchema = z.object({
  businessName: z.string().min(1, "Tên HKD là bắt buộc").max(255),
  ownerName: z.string().min(1, "Tên chủ hộ là bắt buộc").max(150),
  customerCode: z.string().max(50).optional().or(z.literal("")),
  registrationNumber: z.string().max(50).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  hasAccount: z.boolean(),
  accountNumber: z.string()
    .regex(/^\d{13}$/, "Số tài khoản phải gồm đúng 13 chữ số")
    .refine(
      (val) => val.startsWith("6421") || val.startsWith("6221"),
      "Số tài khoản phải bắt đầu bằng 6421 hoặc 6221"
    )
    .optional().or(z.literal("")),
  balance: z.string().optional().or(z.literal("")),
  hasAgribankPlus: z.boolean(),
  software: z.enum(["MISA", "VNPAY", "NO", "OTHER"]),
  customerGroup: z.coerce.number().int().min(1).max(4).default(1),
  consultantId: z.string().optional().or(z.literal("")),
  leadSource: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  createdAt: z.string().optional().or(z.literal("")),
}).refine(
  (data) => !data.hasAccount || (!!data.accountNumber && data.accountNumber.trim().length > 0),
  { message: "Vui lòng nhập số tài khoản", path: ["accountNumber"] }
);

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
}

export function CustomerForm({ open, onClose, customer }: CustomerFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!customer;
  const { user: currentUser } = useAuthStore();

  const { data: consultantsData } = useQuery({
    queryKey: ["consultants"],
    queryFn: () => usersApi.listConsultants().then((r) => r.data.data),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      businessName: "",
      ownerName: "",
      customerCode: "",
      registrationNumber: "",
      phone: "",
      address: "",
      hasAccount: false,
      accountNumber: "",
      balance: "0",
      hasAgribankPlus: false,
      software: "NO",
      customerGroup: 1,
      consultantId: "",
      leadSource: "",
      notes: "",
      createdAt: "",
    },
  });

  useEffect(() => {
    if (open && customer) {
      reset({
        businessName: customer.businessName || "",
        ownerName: customer.ownerName || "",
        customerCode: customer.customerCode || "",
        registrationNumber: customer.registrationNumber || "",
        phone: customer.phone || "",
        address: customer.address || "",
        hasAccount: customer.hasAccount || false,
        accountNumber: customer.accountNumber || "",
        balance: customer.balance || "0",
        hasAgribankPlus: customer.hasAgribankPlus || false,
        software: customer.software || "NO",
        customerGroup: customer.customerGroup || 1,
        consultantId: customer.consultantId || "",
        leadSource: customer.leadSource || "",
        notes: customer.notes || "",
        createdAt: customer.createdAt
          ? new Date(customer.createdAt).toISOString().split("T")[0]
          : "",
      });
    } else if (open) {
      reset({
        businessName: "",
        ownerName: "",
        customerCode: "",
        registrationNumber: "",
        phone: "",
        address: "",
        hasAccount: false,
        balance: "0",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: currentUser?.id || "",
        leadSource: "",
        notes: "",
      });
    }
  }, [open, customer, reset]);

  // Auto-sync: accountNumber -> hasAccount
  const watchedAccountNumber = watch("accountNumber");
  useEffect(() => {
    if (watchedAccountNumber && watchedAccountNumber.trim().length > 0) {
      setValue("hasAccount", true);
    }
  }, [watchedAccountNumber, setValue]);

  const watchedHasAccount = watch("hasAccount");
  useEffect(() => {
    if (!watchedHasAccount) {
      setValue("accountNumber", "");
    }
  }, [watchedHasAccount, setValue]);

  const mutation = useMutation({
    mutationFn: (data: CustomerFormData) => {
      const payload = {
        ...data,
        registrationNumber: data.registrationNumber || undefined,
        customerCode: data.customerCode || undefined,
        accountNumber: data.accountNumber || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        balance: data.balance || "0",
        consultantId: data.consultantId || undefined,
        leadSource: data.leadSource || undefined,
        notes: data.notes || undefined,
        createdAt: data.createdAt || undefined,
      };
      return isEdit
        ? customersApi.update(customer.id, payload)
        : customersApi.create(payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Cập nhật khách hàng thành công" : "Thêm khách hàng thành công");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["top-consultants"] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Có lỗi xảy ra");
    },
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const consultantOptions = (consultantsData || []).map((u) => ({
    value: u.id,
    label: `${u.fullName} (${u.employeeCode})`,
  }));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? "Sửa khách hàng" : "Thêm khách hàng mới"}
      size="lg"
    >
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tên HKD *"
            {...register("businessName")}
            error={errors.businessName?.message}
          />
          <Input
            label="Chủ hộ *"
            {...register("ownerName")}
            error={errors.ownerName?.message}
          />
          <Input
            label="Mã KH"
            maxLength={50}
            {...register("customerCode")}
            error={errors.customerCode?.message}
          />
          <Input
            label="Số ĐKKD"
            {...register("registrationNumber")}
            error={errors.registrationNumber?.message}
          />
          <Input
            label="SĐT"
            {...register("phone")}
            error={errors.phone?.message}
          />
          <div className="md:col-span-2">
            <Input
              label="Địa chỉ"
              {...register("address")}
              error={errors.address?.message}
            />
          </div>
          <Controller
            name="hasAccount"
            control={control}
            render={({ field }) => (
              <Switch
                label="Có tài khoản"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {(() => {
            const reg = register("accountNumber");
            return (
              <Input
                label="Số TK"
                required
                {...reg}
                inputMode="numeric"
                maxLength={13}
                placeholder="Nhập 13 chữ số, bắt đầu 6421 hoặc 6221"
                error={errors.accountNumber?.message}
                onChange={(e) => {
                  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 13);
                  reg.onChange(e);
                }}
              />
            );
          })()}
          <Input
            label="Số dư"
            type="number"
            step="0.01"
            {...register("balance")}
          />
          <Controller
            name="createdAt"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Ngày mở TK"
                value={field.value || ""}
                onChange={field.onChange}
                max={new Date().toISOString().split("T")[0]}
                error={errors.createdAt?.message}
              />
            )}
          />
          <Controller
            name="hasAgribankPlus"
            control={control}
            render={({ field }) => (
              <Switch
                label="Agribank Plus"
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Select
            label="Phần mềm"
            options={[
              { value: "MISA", label: "MISA" },
              { value: "VNPAY", label: "VNPAY" },
              { value: "NO", label: "Không có" },
              { value: "OTHER", label: "Khác" },
            ]}
            {...register("software")}
          />
          <Select
            label="Nhóm"
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
            ]}
            {...register("customerGroup")}
          />
          <Controller
            name="consultantId"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                label="Cán bộ tư vấn"
                options={consultantOptions}
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="-- Chọn CBTV --"
                searchPlaceholder="Tìm theo tên hoặc mã NV..."
                error={errors.consultantId?.message}
              />
            )}
          />
          <Input
            label="Nguồn"
            {...register("leadSource")}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Ghi chú"
              {...register("notes")}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button variant="secondary" type="button" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {isEdit ? "Cập nhật" : "Thêm mới"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
