export interface User {
  id: string;
  employeeCode: string;
  fullName: string;
  branchId: string | null;
  departmentId: string | null;
  positionId: string | null;
  branchName: string | null;
  departmentName: string | null;
  positionName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  permissions?: string[];
  roles?: { roleId: string; roleName: string }[];
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  branchId: string;
  branchName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Position {
  id: string;
  name: string;
  level: number;
  isActive: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  businessName: string;
  ownerName: string;
  registrationNumber: string | null;
  phone: string | null;
  address: string | null;
  hasAccount: boolean;
  accountNumber: string | null;
  balance: string;
  hasAgribankPlus: boolean;
  software: "MISA" | "VNPAY" | "NO" | "OTHER";
  customerGroup: number;
  consultantId: string | null;
  consultantName: string | null;
  leadSource: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface DashboardStats {
  customers: {
    total: number;
    withAccount: number;
    withAgribankPlus: number;
    useMisa: number;
    useVnpay: number;
    noSoftware: number;
    otherSoftware: number;
    totalBalance: string;
    group1: number;
    group2: number;
    group3: number;
    group4: number;
  };
  growth: {
    newCustomers: number;
    newAccount: number;
    newAgribankPlus: number;
    newMisa: number;
    newVnpay: number;
  };
}

export interface TopConsultant {
  consultantId: string;
  fullName: string;
  employeeCode: string;
  customerCount: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}
