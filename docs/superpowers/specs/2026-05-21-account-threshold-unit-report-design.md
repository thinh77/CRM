# Báo cáo tài khoản theo đơn vị

## Mục tiêu

Thêm một báo cáo Excel mới theo mẫu bảng người dùng cung cấp. Báo cáo dùng cho thống kê tài khoản theo đơn vị, số tài khoản có số dư, số tài khoản có số dư trên 50.000 đồng, tỷ lệ hoàn thành và tổng số dư.

## Phạm vi

- Thêm một endpoint xuất Excel mới trong module reports.
- Thêm một nút xuất báo cáo mới trên trang `Báo cáo KH mới`.
- Giữ nguyên các báo cáo hiện có: Excel KH mới, PDF tổng hợp, và báo cáo số dư theo chi nhánh / phòng ban / cán bộ tư vấn.
- Không thay đổi schema cơ sở dữ liệu.

## Cấu trúc file Excel

File xuất ra có một sheet dạng bảng với các cột:

- `STT`
- `ĐƠN VỊ`
- `SL TÀI KHOẢN`
- `TK CÓ SỐ DƯ`
- `TK CÓ SD TRÊN 50K`
- `%HT TRÊN TỔNG SỐ 50K`
- `DƯ/TR ĐỒNG`
- `GHI CHÚ`

Định dạng bảng bám theo ảnh mẫu: tiêu đề in đậm, border đầy đủ, số căn phải, tên đơn vị cấp tổng in đậm, dòng `TỔNG CỘNG` in đậm.

## Logic gom đơn vị

Tổ chức hiện tại trong seed:

- `Hội sở` là branch code `6421`.
- `PGD Bình Tây` là department thuộc `Hội sở`.
- `Chi nhánh Nam Hoa` là branch code `6221`.

Báo cáo mới gom theo quy tắc đặc thù:

- Dòng `HỘI SỞ` là tổng các phòng ban thuộc `Hội sở`, trừ department `PGD Bình Tây`.
- Các phòng ban thuộc `Hội sở`, trừ `PGD Bình Tây`, hiển thị dưới `HỘI SỞ` với STT dạng `1.1`, `1.2`, ...
- Department `PGD Bình Tây` hiển thị thành một dòng cấp 1 riêng dù vẫn thuộc branch `Hội sở`.
- Branch `Chi nhánh Nam Hoa` hiển thị thành dòng cấp 1 riêng là `NAM HOA`.
- Dòng `TỔNG CỘNG` cộng các dòng cấp 1: `HỘI SỞ`, `PGD BÌNH TÂY`, `NAM HOA`, và mọi đơn vị cấp 1 phát sinh khác nếu có.
- Các dòng phòng ban con chỉ là breakdown của `HỘI SỞ`, không được cộng thêm lần nữa vào `TỔNG CỘNG`.

## Công thức chỉ tiêu

Mỗi chỉ tiêu chỉ tính khách hàng có `accountNumber` thực tế.

- `SL TÀI KHOẢN`: đếm khách hàng có `accountNumber`.
- `TK CÓ SỐ DƯ`: đếm khách hàng có `accountNumber` và `balance > 0`.
- `TK CÓ SD TRÊN 50K`: đếm khách hàng có `accountNumber` và `balance > 50000`.
- `%HT TRÊN TỔNG SỐ 50K`: `TK CÓ SD TRÊN 50K / SL TÀI KHOẢN`, hiển thị phần trăm làm tròn như ảnh.
- `DƯ/TR ĐỒNG`: tổng `balance` của tất cả khách hàng có `accountNumber`, bao gồm cả số dư dưới và trên 50.000 đồng.

Nếu `SL TÀI KHOẢN = 0`, tỷ lệ hiển thị `0%`.

## Bộ lọc

Báo cáo dùng cùng bộ lọc ngày, chi nhánh và phòng ban hiện có trên trang báo cáo:

- `dateFrom` / `dateTo` lọc theo `customers.createdAt`, giống các báo cáo hiện có.
- `branchId` và `departmentId` vẫn áp dụng nếu người dùng chọn.
- Không dùng bộ lọc nhóm khách hàng cho báo cáo này vì ảnh mẫu là báo cáo tài khoản theo đơn vị.

## API và UI

- Thêm service `exportAccountThresholdByUnitExcel`.
- Thêm controller và route GET mới dưới `/api/reports`.
- Thêm hàm API client tương ứng.
- Thêm nút xuất trên `ReportsPage`, dùng icon Excel và trạng thái loading riêng.
- Tên file tải về dự kiến: `bao-cao-tai-khoan-theo-don-vi.xlsx`.

## Kiểm thử

Thêm regression test trong `server/tests/reports.test.ts`:

- Tạo dữ liệu cho `Hội sở`, một phòng ban Hội sở, `PGD Bình Tây`, và `Nam Hoa`.
- Kiểm tra `SL TÀI KHOẢN` chỉ đếm khách hàng có `accountNumber`.
- Kiểm tra `TK CÓ SỐ DƯ`, `TK CÓ SD TRÊN 50K`, `%HT`, và `DƯ/TR ĐỒNG`.
- Kiểm tra `PGD Bình Tây` là dòng cấp 1 riêng.
- Kiểm tra `TỔNG CỘNG` không double-count các phòng ban con.

Lệnh test mục tiêu: chạy Vitest từ thư mục `server` với `npm test -- tests/reports.test.ts`.
