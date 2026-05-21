function formatDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatReportExportFilename(date = new Date()): string {
  const day = formatDatePart(date.getDate());
  const month = formatDatePart(date.getMonth() + 1);
  const year = date.getFullYear();

  return `bao-cao-${day}-${month}-${year}.xlsx`;
}
