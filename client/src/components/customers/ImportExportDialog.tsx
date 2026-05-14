import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { customersApi, type CustomerImportType } from "@/api/customers.api";
import { toast } from "sonner";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FileSpreadsheet } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

export function ImportExportDialog({ open, onClose, onImportSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    updated: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: ({ file: importFile, type }: { file: File; type: CustomerImportType }) =>
      customersApi.importFile(importFile, type),
    onSuccess: (res) => {
      const result = res.data.data;
      setImportResult(result);
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length} dòng bị lỗi. Không có dòng nào được import`);
        return;
      }
      if (result.success > 0 || result.updated > 0) {
        toast.success(`Import thành công: ${result.success} thêm mới, ${result.updated} cập nhật`);
        onImportSuccess();
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Import thất bại");
    },
  });

  const handleImport = (type: CustomerImportType = "standard") => {
    if (!file) return;
    setImportResult(null);
    importMutation.mutate({ file, type });
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await customersApi.downloadTemplate();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "mau-nhap-khach-hang.xlsx";
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
    <Modal open={open} onClose={handleClose} title="Import khách hàng">
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

        <button
          onClick={handleDownloadTemplate}
          className="text-sm text-agribank hover:text-agribank-dark underline"
        >
          Tải mẫu nhập liệu (.xlsx)
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            onClick={() => handleImport("standard")}
            disabled={!file || importMutation.isPending}
            className="w-full justify-center"
          >
            {importMutation.isPending ? "Đang import..." : "Import"}
          </Button>
          <Button
            onClick={() => handleImport("mist81")}
            disabled={!file || importMutation.isPending}
            variant="secondary"
            className="w-full justify-center"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import MIST81 (.xls)
          </Button>
        </div>

        {importResult && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
            {(importResult.success > 0 || importResult.updated > 0) && (
              <p className="font-medium text-green-700">
                ✓ Thành công: {importResult.success} thêm mới, {importResult.updated} cập nhật
              </p>
            )}
            {importResult.errors.length > 0 && (
              <div className="mt-2">
                <p className="font-medium text-red-700">
                  ✗ Lỗi: {importResult.errors.length} dòng (không có dòng nào được import)
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
    </Modal>
  );
}
