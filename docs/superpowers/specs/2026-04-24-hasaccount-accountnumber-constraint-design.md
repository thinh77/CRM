# Design: Ràng buộc "Có TK" → bắt buộc nhập Số tài khoản

**Ngày:** 2026-04-24  
**Scope:** CustomerForm validation (client + server)

## Vấn đề

Hiện tại chiều auto-sync chỉ có một chiều:
- `accountNumber` nhập → `hasAccount` tự động `true`

Chiều ngược lại còn thiếu:
- `hasAccount = true` → `accountNumber` **không** bị bắt buộc

Người dùng có thể bật switch "Có tài khoản" rồi submit form mà bỏ trống trường Số TK.

## Hành vi sau khi fix

1. Switch `hasAccount = true` + `accountNumber` trống → form không submit, hiện lỗi trên field Số TK: _"Số tài khoản là bắt buộc khi có tài khoản"_
2. Tắt switch `hasAccount = false` → `accountNumber` tự động clear về `""`
3. Label "Số TK" hiển thị thêm `*` khi switch đang bật

## Kiến trúc thay đổi

### Client: `client/src/components/customers/CustomerForm.tsx`

**Schema Zod:** Thêm `.superRefine()` ở cấp object sau tất cả field definitions:

```ts
const customerSchema = z.object({
  // ... existing fields ...
}).superRefine((data, ctx) => {
  if (data.hasAccount && !data.accountNumber?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accountNumber"],
      message: "Số tài khoản là bắt buộc khi có tài khoản",
    });
  }
});
```

**Effect xóa accountNumber khi tắt switch:**

```ts
const watchedHasAccount = watch("hasAccount");
useEffect(() => {
  if (!watchedHasAccount) {
    setValue("accountNumber", "");
  }
}, [watchedHasAccount, setValue]);
```

**Label động:**

```tsx
<Input
  label={watchedHasAccount ? "Số TK *" : "Số TK"}
  {...register("accountNumber")}
  error={errors.accountNumber?.message}
  placeholder="Nhập số tài khoản"
/>
```

### Server: `server/src/modules/customers/customers.schema.ts`

Tách base object để `updateCustomerSchema` vẫn dùng `.partial()` được:

```ts
const customerBaseObject = z.object({
  // ... tất cả field hiện tại ...
});

export const createCustomerSchema = customerBaseObject.superRefine((data, ctx) => {
  if (data.hasAccount && !data.accountNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accountNumber"],
      message: "Số tài khoản là bắt buộc khi có tài khoản",
    });
  }
});

export const updateCustomerSchema = customerBaseObject.partial();
```

> `updateCustomerSchema` giữ nguyên `.partial()` vì là PATCH — không cần constraint (client đã validate đủ, và import flow dùng riêng).

## Files thay đổi

| File | Loại thay đổi |
|---|---|
| `client/src/components/customers/CustomerForm.tsx` | Schema + Effect + Label |
| `server/src/modules/customers/customers.schema.ts` | Schema refactor + superRefine |

## Kiểm tra

1. Mở form thêm khách hàng, bật switch "Có tài khoản", bỏ trống Số TK → nhấn Thêm mới → phải hiện lỗi trên field Số TK
2. Nhập số TK hợp lệ → lỗi biến mất, form submit thành công
3. Nhập số TK, switch tự bật → tắt switch → Số TK tự xóa
4. Bật switch, nhập số TK → submit thành công → check DB có `hasAccount=true` và `accountNumber` đúng
5. Thử POST API trực tiếp với `hasAccount=true` và không có `accountNumber` → server trả về lỗi validation 400
6. Form sửa khách hàng (edit): cùng behavior khi `hasAccount=true` mà xóa `accountNumber` → không submit được
