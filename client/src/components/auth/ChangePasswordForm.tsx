import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "@/api/auth.api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mật khẩu hiện tại là bắt buộc"),
  newPassword: z.string()
    .min(8, "Tối thiểu 8 ký tự")
    .regex(/[A-Z]/, "Cần có ký tự in hoa")
    .regex(/[a-z]/, "Cần có ký tự thường")
    .regex(/[0-9]/, "Cần có số")
    .regex(/[@$!%*?&]/, "Cần có ký tự đặc biệt (@$!%*?&)"),
  confirmPassword: z.string().min(1, "Xác nhận mật khẩu là bắt buộc"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

type ChangePasswordData = z.infer<typeof changePasswordSchema>;

export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ChangePasswordData) =>
      authApi.changePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      toast.success("Đổi mật khẩu thành công");
      reset();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Đổi mật khẩu thất bại");
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4 max-w-md">
      <Input
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        {...register("currentPassword")}
        error={errors.currentPassword?.message}
        showPasswordToggle
      />
      <Input
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        {...register("newPassword")}
        error={errors.newPassword?.message}
        showPasswordToggle
      />
      <Input
        label="Xác nhận mật khẩu mới"
        type="password"
        autoComplete="new-password"
        {...register("confirmPassword")}
        error={errors.confirmPassword?.message}
        showPasswordToggle
      />
      <Button type="submit" loading={mutation.isPending}>
        Đổi mật khẩu
      </Button>
    </form>
  );
}
