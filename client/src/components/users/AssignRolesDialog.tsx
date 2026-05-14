import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rolesApi } from "@/api/roles.api";
import { usersApi } from "@/api/users.api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { User } from "@/types";

interface AssignRolesDialogProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

export function AssignRolesDialog({ open, onClose, user }: AssignRolesDialogProps) {
  const queryClient = useQueryClient();
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesApi.list().then((r) => r.data.data),
    enabled: open,
  });

  const { data: fullUser } = useQuery({
    queryKey: ["user-detail", user?.id],
    queryFn: () => usersApi.getById(user!.id).then((r) => r.data.data),
    enabled: open && !!user,
  });

  useEffect(() => {
    if (fullUser?.roles) {
      setSelectedRoleIds(fullUser.roles.map((r) => r.roleId));
    }
  }, [fullUser]);

  const mutation = useMutation({
    mutationFn: () => usersApi.assignRoles(user!.id, selectedRoleIds),
    onSuccess: () => {
      toast.success("Gán vai trò thành công");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-detail", user?.id] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Gán vai trò thất bại");
    },
  });

  const toggle = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  if (!user) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Gán vai trò — ${user.fullName}`} size="md">
      <div className="space-y-2 mb-6">
        {roles?.map((role) => (
          <label
            key={role.id}
            className="flex items-start gap-3 p-3 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedRoleIds.includes(role.id)}
              onChange={() => toggle(role.id)}
              className="mt-0.5 rounded"
            />
            <div>
              <div className="text-sm font-medium">
                {role.name}
                {role.isSystem && (
                  <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Hệ thống</span>
                )}
              </div>
              {role.description && (
                <p className="text-xs text-gray-500 mt-0.5">{role.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Lưu</Button>
      </div>
    </Modal>
  );
}
