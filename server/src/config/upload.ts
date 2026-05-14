import multer from "multer";
import path from "path";
import { AppError } from "../middleware/errorHandler.js";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".xlsx", ".xls", ".csv"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError("Chỉ chấp nhận file Excel (.xlsx, .xls) hoặc CSV (.csv)", 400) as any);
    }
  },
});
