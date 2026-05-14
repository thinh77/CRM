import { z } from "zod";

const softwareEnum = z.enum(["MISA", "VNPAY", "NO", "OTHER"]);

const customerBaseObject = z.object({
  businessName: z.string().min(1, "Tên hộ kinh doanh không được để trống").max(255),
  ownerName: z.string().min(1, "Tên chủ hộ không được để trống").max(150),
  customerCode: z.string().max(50).optional().nullable(),
  registrationNumber: z.string().max(50).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().optional().nullable(),
  hasAccount: z.boolean().default(false),
  accountNumber: z.string()
    .regex(/^\d{13}$/, "Số tài khoản phải gồm đúng 13 chữ số")
    .refine(
      (val) => val.startsWith("6421") || val.startsWith("6221"),
      "Số tài khoản phải bắt đầu bằng 6421 hoặc 6221"
    )
    .optional().nullable(),
  balance: z.string().or(z.number()).optional().default("0"),
  hasAgribankPlus: z.boolean().default(false),
  software: softwareEnum.default("NO"),
  customerGroup: z.coerce.number().int().min(1, "Nhóm phải từ 1 đến 4").max(4, "Nhóm phải từ 1 đến 4").default(1),
  consultantId: z.string().uuid().optional().nullable(),
  leadSource: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày phải là YYYY-MM-DD")
    .refine((val) => {
      const [y, m, d] = val.split("-").map(Number);
      const date = new Date(y, m - 1, d);
      return date <= new Date();
    }, "Ngày không được ở tương lai")
    .optional()
    .nullable(),
});

const hasAccountRequiresNumber = (data: { hasAccount?: boolean; accountNumber?: string | null }) =>
  data.hasAccount !== true || (!!data.accountNumber && data.accountNumber.trim().length > 0);

export const createCustomerSchema = customerBaseObject.refine(hasAccountRequiresNumber, {
  message: "Vui lòng nhập số tài khoản khi chọn 'Có tài khoản'",
  path: ["accountNumber"],
});

export const updateCustomerSchema = customerBaseObject.partial().refine(hasAccountRequiresNumber, {
  message: "Vui lòng nhập số tài khoản khi chọn 'Có tài khoản'",
  path: ["accountNumber"],
});

export const customerQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  software: softwareEnum.optional(),
  hasAccount: z.coerce.boolean().optional(),
  hasAgribankPlus: z.coerce.boolean().optional(),
  consultantId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  customerGroup: z.coerce.number().int().min(1).max(4).optional(),
  invalidAccount: z.coerce.boolean().optional(),
  sortBy: z
    .enum(["businessName", "ownerName", "createdAt", "balance"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const poolQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  software: softwareEnum.optional(),
  hasAccount: z.coerce.boolean().optional(),
  hasAgribankPlus: z.coerce.boolean().optional(),
  customerGroup: z.coerce.number().int().min(1).max(4).optional(),
  sortBy: z
    .enum(["businessName", "ownerName", "createdAt", "balance"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const claimSchema = z.object({
  customerIds: z.array(z.string().uuid()).min(1, "Chọn ít nhất 1 khách hàng").max(100),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQuery = z.infer<typeof customerQuerySchema>;
export type PoolQuery = z.infer<typeof poolQuerySchema>;
export type ClaimInput = z.infer<typeof claimSchema>;
