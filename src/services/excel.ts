import * as XLSX from "xlsx";

export type ImportedInvoiceDraftItem = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

export type ImportedInvoiceDraft = {
  invoiceDate: string;
  note: string;
  items: ImportedInvoiceDraftItem[];
  sourceSheetName: string;
  sourceRowNumber: number;
};

export type ImportedInvoiceSheetSummary = {
  sheetName: string;
  rowCount: number;
};

export type ImportedInvoiceWorkbook = {
  entries: ImportedInvoiceDraft[];
  sheets: ImportedInvoiceSheetSummary[];
  skippedRows: number;
};

const trimCell = (value: unknown) =>
  typeof value === "string" ? value.trim() : String(value ?? "").trim();

const normalizeHeader = (value: unknown) =>
  trimCell(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ");

const isRowEmpty = (row: unknown[]) =>
  row.every((cell) => trimCell(cell) === "");

const parseQuantityValue = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = trimCell(value).replace(/[^\d,.-]/g, "");
  if (!text) {
    return 0;
  }

  if (text.includes(",") && text.includes(".")) {
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const normalized = text
      .replace(decimalSeparator === "," ? /\./g : /,/g, "")
      .replace(decimalSeparator, ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (text.includes(",") || text.includes(".")) {
    const separator = text.includes(",") ? "," : ".";
    const parts = text.split(separator);
    if (parts.length === 2) {
      const fractionLength = parts[1]?.length ?? 0;
      if (fractionLength > 0 && fractionLength <= 3) {
        const parsed = Number(text.replace(separator, "."));
        return Number.isFinite(parsed) ? parsed : 0;
      }
    }

    const parsed = Number(text.replace(/[,.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseMoneyValue = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const text = trimCell(value).replace(/[^\d,.-]/g, "");
  if (!text) {
    return 0;
  }

  const decimalMatch = text.match(/^\d+[.,]\d{1,2}$/);
  const normalized = decimalMatch ? text.replace(",", ".") : text.replace(/[,.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateInputValue = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
      value.getDate()
    ).padStart(2, "0")}`;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y && parsed?.m && parsed?.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(
        2,
        "0"
      )}`;
    }
  }

  const text = trimCell(value);
  if (!text) {
    return "";
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const localMatch = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (localMatch) {
    const [, day, month, year] = localMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return "";
};

const hasExpectedHeader = (row: unknown[]) => {
  const normalized = row.slice(0, 6).map(normalizeHeader);
  return (
    normalized[0]?.includes("ten") &&
    normalized[1]?.includes("ngay") &&
    normalized[2]?.includes("so luong") &&
    normalized[3]?.includes("don gia") &&
    normalized[4]?.includes("phat sinh") &&
    normalized[5]?.includes("tong gia")
  );
};

export function parseExcel(file: File): Promise<any[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
      }) as any[][];

      resolve(rows);
    };

    reader.readAsArrayBuffer(file);
  });
}

export function parseInvoiceImportWorkbook(file: File): Promise<ImportedInvoiceWorkbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(reader.error || new Error("Failed to read workbook"));

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: true,
        });

        const entries: ImportedInvoiceDraft[] = [];
        const sheets: ImportedInvoiceSheetSummary[] = [];
        let skippedRows = 0;

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) {
            continue;
          }

          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            raw: false,
            dateNF: "d/m/yyyy",
          }) as unknown[][];

          const headerRowIndex = rows.findIndex(hasExpectedHeader);
          if (headerRowIndex === -1) {
            continue;
          }

          let currentCategory = "";
          let importedRowCount = 0;

          for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
            const row = rows[rowIndex] || [];
            if (isRowEmpty(row)) {
              continue;
            }

            const name = trimCell(row[0]);
            const invoiceDate = toDateInputValue(row[1]);
            const quantity = parseQuantityValue(row[2]);
            const sourceUnitPrice = parseMoneyValue(row[3]);
            const surcharge = parseMoneyValue(row[4]);
            const total = parseMoneyValue(row[5]);

            const isCategoryRow =
              name &&
              !invoiceDate &&
              quantity <= 0 &&
              sourceUnitPrice <= 0 &&
              surcharge <= 0 &&
              total <= 0;

            if (isCategoryRow) {
              currentCategory = name;
              continue;
            }

            if (!name || !invoiceDate) {
              skippedRows += 1;
              continue;
            }

            const effectiveQuantity = quantity > 0 ? quantity : 1;
            const mainAmount = Math.max(total - surcharge, 0);
            const effectiveUnitPrice =
              mainAmount > 0 && effectiveQuantity > 0
                ? mainAmount / effectiveQuantity
                : sourceUnitPrice;

            if (effectiveQuantity <= 0 || effectiveUnitPrice <= 0) {
              skippedRows += 1;
              continue;
            }

            const items: ImportedInvoiceDraftItem[] = [
              {
                name,
                quantity: effectiveQuantity,
                unit: "",
                unitPrice: effectiveUnitPrice,
              },
            ];

            if (surcharge > 0) {
              items.push({
                name: "Phát sinh (ship, xe)",
                quantity: 1,
                unit: "lần",
                unitPrice: surcharge,
              });
            }

            const noteParts = [`Import Excel sheet: ${sheetName}`, `Dòng: ${rowIndex + 1}`];
            if (currentCategory) {
              noteParts.push(`Nhóm: ${currentCategory}`);
            }

            entries.push({
              invoiceDate,
              note: noteParts.join(" | "),
              items,
              sourceSheetName: sheetName,
              sourceRowNumber: rowIndex + 1,
            });
            importedRowCount += 1;
          }

          if (importedRowCount > 0) {
            sheets.push({
              sheetName,
              rowCount: importedRowCount,
            });
          }
        }

        resolve({
          entries,
          sheets,
          skippedRows,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.readAsArrayBuffer(file);
  });
}
