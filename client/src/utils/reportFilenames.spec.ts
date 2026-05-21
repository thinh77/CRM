import test from "node:test";
import assert from "node:assert/strict";
import { formatReportExportFilename } from "./reportFilenames.ts";

test("formats KH moi Excel export filename with local dd-mm-yyyy date", () => {
  const filename = formatReportExportFilename(new Date(2026, 4, 21));

  assert.equal(filename, "bao-cao-21-05-2026.xlsx");
});
