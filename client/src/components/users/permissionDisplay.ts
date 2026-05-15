export type PermState = "inherit" | "grant" | "revoke";

export interface PermissionDisplay {
  text: string;
  cls: string;
  isEffective: boolean;
}

export function hasEffectivePermission(permissionKey: string, effectivePermissions: string[]): boolean {
  return effectivePermissions.includes("*") || effectivePermissions.includes(permissionKey);
}

export function getPermissionDisplay(
  state: PermState,
  permissionKey: string,
  effectivePermissions: string[]
): PermissionDisplay {
  if (state === "grant") {
    return { text: "Cấp thêm", cls: "bg-green-100 text-green-700", isEffective: true };
  }

  if (state === "revoke") {
    return { text: "Tước bỏ", cls: "bg-red-100 text-red-700", isEffective: false };
  }

  const inherited = hasEffectivePermission(permissionKey, effectivePermissions);

  return inherited
    ? { text: "Kế thừa", cls: "bg-green-100 text-green-700", isEffective: true }
    : { text: "Kế thừa", cls: "bg-gray-100 text-gray-500", isEffective: false };
}

export function getNextPermissionState(current: PermState, isInherited: boolean): PermState {
  if (current === "inherit") {
    return isInherited ? "revoke" : "grant";
  }

  return "inherit";
}
