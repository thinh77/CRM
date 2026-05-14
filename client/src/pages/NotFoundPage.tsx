import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-gray-600 mt-2 mb-4">Trang không tồn tại</p>
        <Link
          to="/dashboard"
          className="text-agribank hover:text-agribank-dark underline"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
