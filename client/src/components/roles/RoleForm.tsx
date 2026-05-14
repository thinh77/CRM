import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rolesApi } from "@/api/roles.api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { Role, Permission } from "@/types";

const roleSchema = z.object({
  name: z.string().min(1, "Tên vai trò là bắt buộc").max(50),
  description: z.string().optional().or(z.literal("")),
});

type RoleFormData = z.infer<typeof roleSchema>;

interface RoleFormProps {
  open: boolean;
  onClose: () => void;
  role?: Role | null;
}

export function RoleForm({ open, onClose, role }: RoleFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!role;
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);

  const { data: allPermissions } = useQuery({
    queryKey: ["all-permissions"],
    queryFn: () => rolesApi.listPermissions().then((r) => r.data.data),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name || "",
      description: role?.description || "",
    },
  });

  useEffect(() => {
    if (role) {
      reset({ name: role.name, description: role.description || "" });
      setSelectedPermIds(role.permissions.map((p) => p.id));
    } else {
      reset({ name: "", description: "" });
      setSelectedPermIds([]);
    }
  }, [role, reset]);

  const groupedPermissions = useMemo(() => {
    if (!allPermissions) return {};
    return allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
      (acc[p.resource] = acc[p.resource] || []).push(p);
      return acc;
    }, {});
  }, [allPermissions]);

  const createMutation = useMutation({
    mutationFn: (data: RoleFormData) =>
      rolesApi.create({ ...data, description: data.description || undefined, permissionIds: selectedPermIds }),
    onSuccess: () => {
      toast.success("Tạo vai trò thành công");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Tạo thất bại");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: RoleFormData) => {
      await rolesApi.update(role!.id, { name: data.name, description: data.description || undefined });
      await rolesApi.assignPermissions(role!.id, selectedPermIds);
    },
    onSuccess: () => {
      toast.success("Cập nhật vai trò thành công");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      handleClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Cập nhật thất bại");
    },
  });

  const handleClose = () => {
    reset();
    setSelectedPermIds([]);
    onClose();
  };

  const togglePerm = (id: string) => {
    setSelectedPermIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const toggleResource = (resource: string) => {
    const perms = groupedPermissions[resource] || [];
    const allSelected = perms.every((p) => selectedPermIds.includes(p.id));
    if (allSelected) {
      setSelectedPermIds((prev) => prev.filter((id) => !perms.find((p) => p.id === id)));
    } else {
      setSelectedPermIds((prev) => [...new Set([...prev, ...perms.map((p) => p.id)])]);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Sửa vai trò" : "Thêm vai trò mới"} size="lg">
      <form
        onSubmit={handleSubmit((d) => isEdit ? updateMutation.mutate(d) : createMutation.mutate(d))}
        className="space-y-4"
      >
        <Input label="Tên vai trò *" {...register("name")} error={errors.name?.message} />
        <Textarea label="Mô tả" {...register("description")} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Quyền hạn</label>
          <div className="space-y-3">
            {Object.entries(groupedPermissions).map(([resource, perms]) => {
              const allSelected = perms.every((p) => selectedPermIds.includes(p.id));
              return (
                <div key={resource} className="border border-gray-200 rounded-md p-3">
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => toggleResource(resource)}
                      className="rounded"
                    />
                    <span className="text-sm font-semibold capitalize">{resource}</span>
                  </label>
                  <div className="flex flex-wrap gap-3 ml-6">
                    {perms.map((p) => (
                      <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPermIds.includes(p.id)}
                          onChange={() => togglePerm(p.id)}
                          className="rounded"
                        />
                        <span>{p.action}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" type="button" onClick={handleClose}>Hủy</Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? "Cập nhật" : "Tạo mới"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
