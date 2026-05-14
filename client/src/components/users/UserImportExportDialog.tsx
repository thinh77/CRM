import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { usersApi } from "@/api/users.api";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Upload, Download, FileSpreadsheet, FileText } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export function UserImportExportDialog({ open, onClose, onImportSuccess }: Props) {
  const [tab, setTab] = useState<"import" | "export">("import");
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (file: File) => usersApi.importFile(file),
    onSuccess: (res) => {
      const result = res.data.data;
      setImportResult(result);
      if (result.success > 0) {
        toast.success(`Import thành công ${result.success} người dùng`);
        onImportSuccess();
      }
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} dòng bị lỗi`);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Import thất bại");
    },
  });

  const handleImport = () => {
    if (!file) return;
    setImportResult(null);
    importMutation.mutate(file);
  };

  const handleExport = async (format: "xlsx" | "csv") => {
    try {
      const res = await usersApi.exportFile(format);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `nguoi-dung.${format === "xlsx" ? "xlsx" : "csv"}`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Xuất file thành công");
    } catch {
      toast.error("Xuất file thất bại");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await usersApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "mau-nhap-nguoi-dung.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Tải mẫu thất bại");
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Import / Export người dùng">
      <div className="flex border-b border-gray-200 mb-4">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "import" ? "border-agribank text-agribank" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          onClick={() => setTab("import")}
        >
          <Upload className="w-4 h-4 inline mr-1" />
          Import
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === "export" ? "border-agribank text-agribank" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          onClick={() => setTab("export")}
        >
          <Download className="w-4 h-4 inline mr-1" />
          Export
        </button>
      </div>

      {tab === "import" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chọn file Excel hoặc CSV
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setImportResult(null);
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-agribank-50 file:text-agribank-dark hover:file:bg-agribank-100"
            />
          </div>

          <p className="text-xs text-gray-500">
            Nếu không có mật khẩu trong file, mật khẩu mặc định là: <code className="bg-gray-100 px-1 rounded">Agribank@123</code>
          </p>

          <button
            onClick={handleDownloadTemplate}
            className="text-sm text-agribank hover:text-agribank-dark underline"
          >
            Tải mẫu nhập liệu (.xlsx)
          </button>

          <Button
            onClick={handleImport}
            disabled={!file || importMutation.isPending}
            className="w-full"
          >
            {importMutation.isPending ? "Đang import..." : "Import"}
          </Button>

          {importResult && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
              <p className="font-medium text-green-700">
                ✓ Thành công: {importResult.success} dòng
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium text-red-700">
                    ✗ Lỗi: {importResult.errors.length} dòng
                  </p>
                  <ul className="mt-1 max-h-40 overflow-y-auto space-y-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i} className="text-red-600">
                        Dòng {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "export" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-4">
            Xuất danh sách người dùng ra file
          </p>
          <Button onClick={() => handleExport("xlsx")} variant="secondary" className="w-full justify-center">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Xuất Excel (.xlsx)
          </Button>
          <Button onClick={() => handleExport("csv")} variant="secondary" className="w-full justify-center">
            <FileText className="w-4 h-4 mr-2" />
            Xuất CSV (.csv)
          </Button>
        </div>
      )}
    </Modal>
  );
}
