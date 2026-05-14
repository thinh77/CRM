const DEFAULT_ROUTE_PRIORITY: Array<{ path: string; permission?: string }> = [
  { path: "/dashboard", permission: "dashboard:read" },
  { path: "/customers", permission: "customers:read" },
  { path: "/reports", permission: "reports:export" },
  { path: "/profile" },
];

export function getDefaultRoute(permissions: string[]): string {
  const hasPermission = (permission?: string) =>
    !permission || permissions.includes("*") || permissions.includes(permission);

  const matched = DEFAULT_ROUTE_PRIORITY.find((route) => hasPermission(route.permission));
  return matched?.path || "/profile";
}
