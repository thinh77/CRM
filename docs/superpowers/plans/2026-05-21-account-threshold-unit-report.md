# Account Threshold Unit Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new Excel report that matches the provided unit-summary image and counts account/balance metrics by special business units.

**Architecture:** The backend reports service will expose a focused workbook generator and helper aggregation for account-threshold unit rows. The existing reports controller/routes and React reports page will add a separate export action, leaving all existing exports unchanged.

**Tech Stack:** TypeScript, Express, Drizzle ORM, ExcelJS, React, TanStack Query, Vitest.

---

## File Structure

- Modify `server/tests/reports.test.ts`: add a regression test that creates organization/customer data and validates the workbook rows.
- Modify `server/src/modules/reports/reports.service.ts`: add aggregation types/helpers and `exportAccountThresholdByUnitExcel`.
- Modify `server/src/modules/reports/reports.controller.ts`: add `exportAccountThresholdByUnit`.
- Modify `server/src/modules/reports/reports.routes.ts`: add GET route `/export-account-threshold`.
- Modify `client/src/api/reports.api.ts`: add client call.
- Modify `client/src/pages/ReportsPage.tsx`: add a separate button and loading state.

### Task 1: Backend Workbook Test

**Files:**
- Modify: `server/tests/reports.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test in the existing `describe("Reports service", ...)` block:

```ts
  it("exports account threshold report with PGD Binh Tay as a separate top-level unit", async () => {
    const hqBranch = await ensureBranch("6421", "Hội sở");
    const namHoaBranch = await ensureBranch("6221", "Chi nhánh Nam Hoa");
    const khcnDept = await ensureDepartment("Phòng KHCN", hqBranch.id);
    const pgdDept = await ensureDepartment("PGD Bình Tây", hqBranch.id);
    const namHoaDept = await ensureDepartment("Phòng KH", namHoaBranch.id);

    const [hqUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_50K_HQ",
        passwordHash: "test-password-hash",
        fullName: "HQ Report Tester",
        branchId: hqBranch.id,
        departmentId: khcnDept.id,
      })
      .returning();
    const [pgdUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_50K_PGD",
        passwordHash: "test-password-hash",
        fullName: "PGD Report Tester",
        branchId: hqBranch.id,
        departmentId: pgdDept.id,
      })
      .returning();
    const [namHoaUser] = await db
      .insert(users)
      .values({
        employeeCode: "REPORT_50K_NH",
        passwordHash: "test-password-hash",
        fullName: "Nam Hoa Report Tester",
        branchId: namHoaBranch.id,
        departmentId: namHoaDept.id,
      })
      .returning();

    await db.insert(customers).values([
      {
        businessName: "HQ Account Over 50K",
        ownerName: "HQ Owner One",
        accountNumber: "RPT50K0000001",
        hasAccount: true,
        balance: "60000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "HQ Account Under 50K",
        ownerName: "HQ Owner Two",
        accountNumber: "RPT50K0000002",
        hasAccount: true,
        balance: "10000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "HQ No Account",
        ownerName: "HQ Owner Three",
        hasAccount: false,
        balance: "900000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: hqUser.id,
        createdBy: hqUser.id,
        updatedBy: hqUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "PGD Account",
        ownerName: "PGD Owner",
        accountNumber: "RPT50K0000003",
        hasAccount: true,
        balance: "70000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: pgdUser.id,
        createdBy: pgdUser.id,
        updatedBy: pgdUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
      {
        businessName: "Nam Hoa Account",
        ownerName: "Nam Hoa Owner",
        accountNumber: "RPT50K0000004",
        hasAccount: true,
        balance: "5000",
        hasAgribankPlus: false,
        software: "NO",
        customerGroup: 1,
        consultantId: namHoaUser.id,
        createdBy: namHoaUser.id,
        updatedBy: namHoaUser.id,
        createdAt: new Date("2036-03-10T00:00:00.000Z"),
      },
    ]);

    try {
      const buffer = await reportsService.exportAccountThresholdByUnitExcel({
        dateFrom: "2036-03-10",
        dateTo: "2036-03-10",
      });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
      const sheet = workbook.getWorksheet("Bao cao tai khoan");
      expect(sheet).toBeDefined();

      const rows = sheet!.getRows(2, sheet!.rowCount - 1)!.map((row) => ({
        stt: row.getCell(1).value,
        unit: row.getCell(2).value,
        accountCount: row.getCell(3).value,
        positiveBalanceCount: row.getCell(4).value,
        over50kCount: row.getCell(5).value,
        completionRate: row.getCell(6).value,
        balance: row.getCell(7).value,
      }));

      expect(rows).toEqual([
        {
          stt: 1,
          unit: "HỘI SỞ",
          accountCount: 2,
          positiveBalanceCount: 2,
          over50kCount: 1,
          completionRate: "50%",
          balance: 70000,
        },
        {
          stt: "1.1",
          unit: "P.KHCN",
          accountCount: 2,
          positiveBalanceCount: 2,
          over50kCount: 1,
          completionRate: "50%",
          balance: 70000,
        },
        {
          stt: 2,
          unit: "PGD BÌNH TÂY",
          accountCount: 1,
          positiveBalanceCount: 1,
          over50kCount: 1,
          completionRate: "100%",
          balance: 70000,
        },
        {
          stt: 3,
          unit: "NAM HOA",
          accountCount: 1,
          positiveBalanceCount: 1,
          over50kCount: 0,
          completionRate: "0%",
          balance: 5000,
        },
        {
          stt: null,
          unit: "TỔNG CỘNG",
          accountCount: 4,
          positiveBalanceCount: 4,
          over50kCount: 2,
          completionRate: "50%",
          balance: 145000,
        },
      ]);
    } finally {
      await cleanupAccountThresholdReportFixtures();
    }
  });
```

Add small test helpers above the test:

```ts
async function ensureBranch(code: string, name: string) {
  const [inserted] = await db.insert(branches).values({ code, name }).onConflictDoNothing().returning();
  if (inserted) return inserted;
  const [existing] = await db.select().from(branches).where(eq(branches.code, code));
  return existing;
}

async function ensureDepartment(name: string, branchId: string) {
  const [inserted] = await db.insert(departments).values({ name, branchId }).onConflictDoNothing().returning();
  if (inserted) return inserted;
  const [existing] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.name, name), eq(departments.branchId, branchId)));
  return existing;
}

async function cleanupAccountThresholdReportFixtures() {
  await db.delete(customers).where(inArray(customers.accountNumber, [
    "RPT50K0000001",
    "RPT50K0000002",
    "RPT50K0000003",
    "RPT50K0000004",
  ]));
  await db.delete(users).where(inArray(users.employeeCode, [
    "REPORT_50K_HQ",
    "REPORT_50K_PGD",
    "REPORT_50K_NH",
  ]));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- tests/reports.test.ts`

Expected: FAIL with TypeScript/runtime message that `exportAccountThresholdByUnitExcel` is not defined.

### Task 2: Backend Service Implementation

**Files:**
- Modify: `server/src/modules/reports/reports.service.ts`
- Test: `server/tests/reports.test.ts`

- [ ] **Step 1: Add aggregation and workbook code**

Implement:

```ts
interface AccountThresholdStats {
  accountCount: number;
  positiveBalanceCount: number;
  over50kCount: number;
  totalBalance: number;
}

interface AccountThresholdReportRow {
  stt: number | string | null;
  unit: string;
  stats: AccountThresholdStats;
  bold?: boolean;
}

const ACCOUNT_THRESHOLD_AMOUNT = 50000;
const HQ_BRANCH_CODE = "6421";
const NAM_HOA_BRANCH_CODE = "6221";
const PGD_BINH_TAY_NAME = "PGD Bình Tây";
```

Add helpers that normalize display labels, add stats, format completion rate, and build rows by:

- Reading customer rows joined to users, branches and departments.
- Filtering to rows with non-empty `accountNumber`.
- Assigning `PGD Bình Tây` to its own top-level bucket.
- Assigning branch code `6221` to `NAM HOA`.
- Assigning branch code `6421` to `HỘI SỞ` except `PGD Bình Tây`.
- Creating department child rows only for `HỘI SỞ`.
- Adding `TỔNG CỘNG` from top-level rows only.

Add `exportAccountThresholdByUnitExcel(filters: BalanceByOrgFilters = {}): Promise<Buffer>` that creates the sheet `Bao cao tai khoan`, adds the exact headers, applies borders/fills/bold rows, formats balance as `#,##0`, and returns the workbook buffer.

- [ ] **Step 2: Run test to verify it passes**

Run: `cd server && npm test -- tests/reports.test.ts`

Expected: PASS for the reports service suite.

### Task 3: Backend Route

**Files:**
- Modify: `server/src/modules/reports/reports.controller.ts`
- Modify: `server/src/modules/reports/reports.routes.ts`

- [ ] **Step 1: Wire the endpoint**

Add controller:

```ts
export async function exportAccountThresholdByUnit(req: Request, res: Response, next: NextFunction) {
  try {
    const filters: reportsService.BalanceByOrgFilters = {
      dateFrom: getDateQueryParam(req.query.dateFrom, "dateFrom"),
      dateTo: getDateQueryParam(req.query.dateTo, "dateTo"),
      branchId: getUuidQueryParam(req.query.branchId, "branchId"),
      departmentId: getUuidQueryParam(req.query.departmentId, "departmentId"),
    };
    const buffer = await reportsService.exportAccountThresholdByUnitExcel(filters);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="bao-cao-tai-khoan-theo-don-vi.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}
```

Add route:

```ts
router.get(
  "/export-account-threshold",
  requirePermission("reports:export"),
  reportsController.exportAccountThresholdByUnit
);
```

- [ ] **Step 2: Run backend build**

Run: `cd server && npm run typecheck`

Expected: TypeScript passes.

### Task 4: Frontend Export Button

**Files:**
- Modify: `client/src/api/reports.api.ts`
- Modify: `client/src/pages/ReportsPage.tsx`

- [ ] **Step 1: Add client API and button handler**

In `reports.api.ts`, add:

```ts
exportAccountThresholdByUnit: (filters: ReportsFilters = {}) =>
  client.get("/reports/export-account-threshold", {
    params: filters,
    responseType: "blob",
  }),
```

In `ReportsPage.tsx`:

- Add `const [isExportingAccountThreshold, setIsExportingAccountThreshold] = useState(false);`
- Add `handleExportAccountThreshold` that sends `dateFrom`, `dateTo`, `branchId`, and `departmentId`, downloads `bao-cao-tai-khoan-theo-don-vi.xlsx`, and shows success/error toasts.
- Add a secondary button labeled `Xuất BC tài khoản >50K` with `FileSpreadsheet` icon.

- [ ] **Step 2: Run frontend build**

Run: `cd client && npm run build`

Expected: TypeScript and Vite build pass.

### Task 5: Final Verification

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Run targeted backend test**

Run: `cd server && npm test -- tests/reports.test.ts`

Expected: PASS.

- [ ] **Step 2: Run backend typecheck**

Run: `cd server && npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run: `cd client && npm run build`

Expected: PASS.

- [ ] **Step 4: Inspect git status**

Run: `git status --short`

Expected: only intended source/docs changes plus pre-existing untracked image files.
