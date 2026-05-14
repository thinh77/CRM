import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usersApi } from "@/api/users.api";
import { rolesApi } from "@/api/roles.api";
import { organizationApi } from "@/api/organization.api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import type { User } from "@/types";

const passwordSchema = z.string().min(8, "Mật khẩu tối thiểu 8 ký tự")
  .regex(/[A-Z]/, "Cần có ký tự in hoa")
  .regex(/[a-z]/, "Cần có ký tự thường")
  .regex(/[0-9]/, "Cần có số")
  .regex(/[@$!%*?&]/, "Cần có ký tự đặc biệt");

const createUserSchema = z.object({
  employeeCode: z.string().min(1, "Mã NV là bắt buộc").max(20),
  password: passwordSchema,
  fullName: z.string().min(1, "Họ tên là bắt buộc").max(100),
  branchId: z.string().min(1, "Chi nhánh là bắt buộc"),
  departmentId: z.string().optional().or(z.literal("")).transform((value) => value || null),
  positionId: z.string().optional().or(z.literal("")).transform((value) => value || null),
});

const editUserSchema = z.object({
  fullName: z.string().min(1, "Họ tên là bắt buộc").max(100),
  branchId: z.string().min(1, "Chi nhánh là bắt buộc"),
  departmentId: z.string().optional().or(z.literal("")).transform((value) => value || null),
  positionId: z.string().optional().or(z.literal("")).transform((value) => value || null),
  password: z.union([passwordSchema, z.literal("")]).optional().transform((value) => value || undefined),
  isActive: z.boolean(),
});

type CreateUserData = z.infer<typeof createUserSchema>;
type EditUserData = z.infer<typeof editUserSchema>;

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  user?: User | null;
}

export function UserForm({ open, onClose, user }: UserFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!user;

  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list().then((r) => r.data.data),
    enabled: open && !isEdit,
  });

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: () => organizationApi.listBranches(),
    enabled: open,
  });

  const { data: positions } = useQuery({
    queryKey: ["positions"],
    queryFn: () => organizationApi.listPositions(),
    enabled: open,
  });

  const createForm = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { employeeCode: "", password: "", fullName: "", branchId: "", departmentId: "", positionId: "" },
  });

  const editForm = useForm<EditUserData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      branchId: user?.branchId || "",
      departmentId: user?.departmentId || "",
      positionId: user?.positionId || "",
      password: "",
      isActive: user?.isActive ?? true,
    },
  });

  const selectedBranchId = isEdit ? editForm.watch("branchId") : createForm.watch("branchId");

  const { data: departments } = useQuery({
    queryKey: ["departments", selectedBranchId],
    queryFn: () => organizationApi.listDepartments(selectedBranchId || undefined),
    enabled: open && !!selectedBranchId,
  });

  useEffect(() => {
    if (user && isEdit) {
      editForm.reset({
        fullName: user.fullName,
        branchId: user.branchId || "",
        departmentId: user.departmentId || "",
        positionId: user.positionId || "",
        password: "",
        isActive: user.isActive,
      });
    }
  }, [user, isEdit, editForm]);

  const createMutation = useMutation({
    mutationFn: (data: CreateUserData & { roleIds?: string[] }) => usersApi.create(data),
    onSuccess: () => {
      toast.success("Tạo người dùng thành công");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Tạo thất bại");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: EditUserData) => usersApi.update(user!.id, data),
    onSuccess: () => {
      toast.success("Cập nhật người dùng thành công");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Cập nhật thất bại");
    },
  });

  const handleClose = () => {
    createForm.reset();
    editForm.reset();
    onClose();
  };

  const branchOptions = (branches || []).map((b) => ({ value: b.id, label: b.name }));
  const departmentOptions = (departments || []).map((d) => ({ value: d.id, label: d.name }));
  const positionOptions = (positions || []).map((p) => ({ value: p.id, label: p.name }));

  if (isEdit) {
    const { register, handleSubmit, watch, setValue, formState: { errors } } = editForm;
    return (
      <Modal open={open} onClose={handleClose} title="Sửa người dùng" size="md">
        <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
          <Input label="Họ tên *" {...register("fullName")} error={errors.fullName?.message} />
          <Select label="Chi nhánh *" options={branchOptions} placeholder="Chọn chi nhánh" {...register("branchId")} error={errors.branchId?.message} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Phòng ban" options={departmentOptions} placeholder="Chọn phòng ban" {...register("departmentId")} />
            <Select label="Chức vụ" options={positionOptions} placeholder="Chọn chức vụ" {...register("positionId")} />
          </div>
          <Input
            label="Mật khẩu mới"
            type="password"
            autoComplete="new-password"
            placeholder="Để trống nếu không đổi"
            {...register("password")}
            error={errors.password?.message}
            showPasswordToggle
          />
          <Switch
            label="Hoạt động"
            checked={watch("isActive")}
            onChange={(v) => setValue("isActive", v)}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={handleClose}>Hủy</Button>
            <Button type="submit" loading={updateMutation.isPending}>Cập nhật</Button>
          </div>
        </form>
      </Modal>
    );
  }

  const { register, handleSubmit, formState: { errors } } = createForm;
  return (
    <Modal open={open} onClose={handleClose} title="Thêm người dùng mới" size="md">
      <form
        onSubmit={handleSubmit((d) => createMutation.mutate(d))}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Mã NV *" {...register("employeeCode")} error={errors.employeeCode?.message} />
          <Input
            label="Mật khẩu *"
            type="password"
            autoComplete="new-password"
            {...register("password")}
            error={errors.password?.message}
            showPasswordToggle
          />
        </div>
        <Input label="Họ tên *" {...register("fullName")} error={errors.fullName?.message} />
        <Select label="Chi nhánh *" options={branchOptions} placeholder="Chọn chi nhánh" {...register("branchId")} error={errors.branchId?.message} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Phòng ban" options={departmentOptions} placeholder="Chọn phòng ban" {...register("departmentId")} />
          <Select label="Chức vụ" options={positionOptions} placeholder="Chọn chức vụ" {...register("positionId")} />
        </div>

        {rolesData && rolesData.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vai trò</label>
            <div className="space-y-2">
              {rolesData.map((role) => (
                <label key={role.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={role.id} className="rounded" />
                  <span>{role.name}</span>
                  {role.description && <span className="text-gray-400">— {role.description}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" type="button" onClick={handleClose}>Hủy</Button>
          <Button type="submit" loading={createMutation.isPending}>Tạo mới</Button>
        </div>
      </form>
    </Modal>
  );
}
