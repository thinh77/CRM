import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/api/auth.api";
import { useAuthStore } from "@/stores/authStore";
import { Input } from "@/components/ui/Input";
import { getDefaultRoute } from "@/utils/routing";
import logo from "../../assets/logo.jpg";

export function LoginForm() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth, setPermissions } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data: loginRes } = await authApi.login(employeeCode, password);
      setAuth(
        loginRes.data.accessToken,
        loginRes.data.refreshToken,
        loginRes.data.user
      );

      // Fetch permissions and full user info
      const { data: meRes } = await authApi.getMe();
      setPermissions(meRes.data.permissions || []);
      setAuth(loginRes.data.accessToken, loginRes.data.refreshToken, {
        ...loginRes.data.user,
        ...meRes.data,
      });

      navigate(getDefaultRoute(meRes.data.permissions || []), { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Đăng nhập thất bại"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <img src={logo} alt="Logo" className="w-full h-auto mx-auto mb-4" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mã nhân viên
            </label>
            <input
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-agribank-500"
              placeholder="Nhập mã nhân viên"
              required
            />
          </div>

          <Input
            label="Mật khẩu"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nhập mật khẩu"
            autoComplete="current-password"
            required
            showPasswordToggle
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-agribank text-white py-2 rounded-md hover:bg-agribank-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
