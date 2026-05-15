import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { rolesApi } from "@/api/roles.api";
import { usersApi } from "@/api/users.api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { User, Permission } from "@/types";
import {
  getNextPermissionState,
  getPermissionDisplay,
  hasEffectivePermission,
  type PermState,
} from "./permissionDisplay";

interface AssignPermissionsDialogProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

export function AssignPermissionsDialog({ open, onClose, user }: AssignPermissionsDialogProps) {
  const queryClient = useQueryClient();
  const [permStates, setPermStates] = useState<Record<string, PermState>>({});

  const { data: allPermissions } = useQuery({
    queryKey: ["all-permissions"],
    queryFn: () => rolesApi.listPermissions().then((r) => r.data.data),
    enabled: open,
  });

  const { data: fullUser } = useQuery({
    queryKey: ["user-detail", user?.id],
    queryFn: () => usersApi.getById(user!.id).then((r) => r.data.data),
    enabled: open && !!user,
  });

  const { data: permissionOverrides } = useQuery({
    queryKey: ["user-permission-overrides", user?.id],
    queryFn: () => usersApi.getPermissionOverrides(user!.id).then((r) => r.data.data),
    enabled: open && !!user,
  });

  useEffect(() => {
    if (!allPermissions) return;

    const initial: Record<string, PermState> = {};
    allPermissions.forEach((p) => {
      initial[p.id] = "inherit";
    });

    (permissionOverrides || []).forEach((override) => {
      initial[override.permissionId] = override.granted ? "grant" : "revoke";
    });

    setPermStates(initial);
  }, [allPermissions, permissionOverrides]);

  const groupedPermissions = useMemo(() => {
    if (!allPermissions) return {};
    return allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
      (acc[p.resource] = acc[p.resource] || []).push(p);
      return acc;
    }, {});
  }, [allPermissions]);

  const cycleState = (permId: string, isInherited: boolean) => {
    setPermStates((prev) => {
      const current = prev[permId] || "inherit";
      return { ...prev, [permId]: getNextPermissionState(current, isInherited) };
    });
  };

  const mutation = useMutation({
    mutationFn: () => {
      const permissions = Object.entries(permStates)
        .filter(([, state]) => state !== "inherit")
        .map(([permissionId, state]) => ({
          permissionId,
          granted: state === "grant",
        }));
      return usersApi.assignPermissions(user!.id, permissions);
    },
    onSuccess: () => {
      toast.success("Cập nhật quyền hạn thành công");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user-detail", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["user-permission-overrides", user?.id] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Cập nhật thất bại");
    },
  });

  if (!user) return null;

  const userPermissions = fullUser?.permissions || [];

  return (
    <Modal open={open} onClose={onClose} title={`Quyền riêng — ${user.fullName}`} size="lg">
      <p className="text-xs text-gray-500 mb-4">
        Quyền xanh là quyền đang có hiệu lực; "Kế thừa" lấy từ vai trò của user.
        Hiện có: {userPermissions.join(", ") || "không có"}.
      </p>
      <div className="space-y-4 mb-6">
        {Object.entries(groupedPermissions).map(([resource, perms]) => (
          <div key={resource}>
            <h4 className="text-sm font-semibold text-gray-700 mb-2 capitalize">{resource}</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {perms.map((p) => {
                const state = permStates[p.id] || "inherit";
                const permissionKey = `${p.resource}:${p.action}`;
                const isInherited = hasEffectivePermission(permissionKey, userPermissions);
                const { text, cls } = getPermissionDisplay(state, permissionKey, userPermissions);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => cycleState(p.id, isInherited)}
                    className={`flex items-center justify-between px-3 py-2 rounded-md border text-sm ${cls} hover:opacity-80`}
                  >
                    <span>{p.action}</span>
                    <span className="text-xs font-medium">{text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 border-t pt-4">
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Lưu</Button>
      </div>
    </Modal>
  );
}
