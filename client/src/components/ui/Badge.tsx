import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  variant?: "success" | "error" | "warning" | "info" | "neutral";
  children: ReactNode;
  className?: string;
}

const variantClasses = {
  success: "bg-green-100 text-green-700",
  error: "bg-red-100 text-red-700",
  warning: "bg-yellow-100 text-yellow-700",
  info: "bg-agribank-100 text-agribank-dark",
  neutral: "bg-gray-100 text-gray-600",
};

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full", variantClasses[variant], className)}>
      {children}
    </span>
  );
}
