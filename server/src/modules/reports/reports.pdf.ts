import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import type { BranchDepartmentBreakdown, ReportStats } from "./reports.service.js";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const fontCandidates = [
  process.env.PDF_FONTS_DIR,
  path.resolve(here, "../../assets/fonts"),
  path.resolve(process.cwd(), "dist/assets/fonts"),
  path.resolve(process.cwd(), "src/assets/fonts"),
].filter((dir): dir is string => Boolean(dir && fs.existsSync(dir)));
const fontsDir = fontCandidates[0] ?? path.resolve(here, "../../assets/fonts");
const PrinterModule = require("pdfmake/src/printer.js");
const PdfPrinter = PrinterModule.default ?? PrinterModule;

const printer = new PdfPrinter({
  Roboto: {
    normal: path.join(fontsDir, "Roboto-Regular.ttf"),
    bold: path.join(fontsDir, "Roboto-Medium.ttf"),
    italics: path.join(fontsDir, "Roboto-Italic.ttf"),
    bolditalics: path.join(fontsDir, "Roboto-MediumItalic.ttf"),
  },
});

const METRIC_HEADERS = [
  "Tên đơn vị",
  "Tổng KH",
  "Có tài khoản",
  "Agribank+",
  "MISA",
  "VNPAY",
  "Nhóm 1",
  "Nhóm 2",
  "Nhóm 3",
  "Nhóm 4",
];

function statsRowCells(stats: ReportStats): (string | number)[] {
  return [
    stats.total,
    stats.withAccount,
    stats.withAgribankPlus,
    stats.useMisa,
    stats.useVnpay,
    stats.group1,
    stats.group2,
    stats.group3,
    stats.group4,
  ];
}

function formatRangeLabel(dateFrom?: string, dateTo?: string): string {
  if (!dateFrom && !dateTo) return "Toàn thời gian";
  if (dateFrom && dateTo) return `Từ ${dateFrom} đến ${dateTo}`;
  if (dateFrom) return `Từ ${dateFrom}`;
  return `Đến ${dateTo}`;
}

export function renderBranchDepartmentReportPdf(
  breakdown: BranchDepartmentBreakdown,
  options: { dateFrom?: string; dateTo?: string }
): NodeJS.ReadableStream {
  const body: TableCell[][] = [];

  body.push(
    METRIC_HEADERS.map((h) => ({
      text: h,
      bold: true,
      alignment: "center",
      fillColor: "#e5e7eb",
    }))
  );

  for (const branch of breakdown.branches) {
    const branchLabel = `${branch.code} — ${branch.name}`;
    body.push([
      { text: branchLabel, bold: true, fillColor: "#f3f4f6" },
      ...statsRowCells(branch.totals).map(
        (v): TableCell => ({
          text: String(v),
          bold: true,
          alignment: "right",
          fillColor: "#f3f4f6",
        })
      ),
    ]);

    for (const dept of branch.departments) {
      body.push([
        { text: dept.name, margin: [12, 0, 0, 0] },
        ...statsRowCells(dept.stats).map(
          (v): TableCell => ({ text: String(v), alignment: "right" })
        ),
      ]);
    }
  }

  body.push([
    { text: "TỔNG TOÀN HỆ THỐNG", bold: true, fillColor: "#d1d5db" },
    ...statsRowCells(breakdown.grandTotal).map(
      (v): TableCell => ({
        text: String(v),
        bold: true,
        alignment: "right",
        fillColor: "#d1d5db",
      })
    ),
  ]);

  const content: Content = {
    table: {
      headerRows: 1,
      widths: ["*", "auto", "auto", "auto", "auto", "auto", "auto", "auto", "auto", "auto"],
      body,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#9ca3af",
      vLineColor: () => "#9ca3af",
    },
  };

  const docDef: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [24, 64, 24, 36],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    header: {
      stack: [
        {
          text: "BÁO CÁO TỔNG HỢP KHÁCH HÀNG",
          bold: true,
          fontSize: 14,
          alignment: "center",
          margin: [0, 16, 0, 2],
        },
        {
          text: formatRangeLabel(options.dateFrom, options.dateTo),
          fontSize: 10,
          alignment: "center",
        },
      ],
    },
    footer: (currentPage, pageCount) => ({
      text: `Trang ${currentPage}/${pageCount}`,
      alignment: "center",
      fontSize: 9,
      margin: [0, 12, 0, 0],
    }),
    content,
  };

  const pdfDoc = printer.createPdfKitDocument(docDef);
  pdfDoc.end();
  return pdfDoc;
}
