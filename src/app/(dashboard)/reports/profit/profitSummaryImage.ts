import type { Cell } from "exceljs";
import { buildProfitWorkbook } from "./profitExcelExport";

const money = new Intl.NumberFormat("vi-VN");
const percent = new Intl.NumberFormat("vi-VN", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

function cellText(cell: Cell) {
  const value = cell.formula ? cell.result : cell.value;
  if (typeof value === "number") {
    if (cell.numFmt?.includes("%")) return percent.format(value);
    if (cell.numFmt?.includes('" đ"')) {
      if (value === 0) return "—";
      const amount = money.format(Math.abs(value));
      return value < 0 ? `(${amount}) đ` : `${amount} đ`;
    }
    return money.format(value);
  }
  return typeof value === "string" ? value : "";
}

export async function renderProfitSummaryImage(options: Parameters<typeof buildProfitWorkbook>[0]): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");
  const sheet = buildProfitWorkbook(options).getWorksheet("Tổng hợp");
  if (!sheet) throw new Error("Không tìm thấy sheet Tổng hợp.");

  const frame = document.createElement("div");
  Object.assign(frame.style, {
    position: "absolute", left: "-10000px", top: "0", width: "1320px",
    background: "#ffffff", color: "#0f172a", fontFamily: "Arial, sans-serif", lineHeight: "1.25",
  });
  frame.setAttribute("aria-hidden", "true");
  const caption = document.createElement("div");
  caption.textContent = `${options.storeName} · VND${options.unsaved ? " · Có thay đổi chưa lưu" : ""}`;
  Object.assign(caption.style, { padding: "8px 12px", fontSize: "14px" });
  frame.append(caption);

  const table = document.createElement("table");
  Object.assign(table.style, { width: "100%", tableLayout: "fixed", borderCollapse: "collapse" });
  const columns = document.createElement("colgroup");
  const widths = [1, 2, 3, 4, 5].map((index) => sheet.getColumn(index).width ?? 12);
  const totalWidth = widths.reduce((total, width) => total + width, 0);
  for (const width of widths) {
    const column = document.createElement("col");
    column.style.width = `${width / totalWidth * 100}%`;
    columns.append(column);
  }
  table.append(columns);
  const body = table.createTBody();
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const sourceRow = sheet.getRow(rowNumber);
    const row = body.insertRow();
    row.style.height = `${sourceRow.height ?? 23}px`;
    for (let column = 1; column <= 5; column++) {
      const source = sourceRow.getCell(column);
      const cell = row.insertCell();
      while (column < 5 && sourceRow.getCell(column + 1).master.address === source.address) {
        cell.colSpan++;
        column++;
      }
      const background = source.fill?.type === "pattern" ? source.fill.fgColor?.argb : undefined;
      const color = source.font?.color?.argb;
      cell.textContent = cellText(source);
      Object.assign(cell.style, {
        padding: `4px 8px 4px ${source.alignment?.indent ? 18 : 8}px`,
        backgroundColor: background ? `#${background.slice(-6)}` : "#ffffff",
        color: color ? `#${color.slice(-6)}` : "#0f172a",
        fontSize: `${(source.font?.size ?? 11) * 1.18}px`,
        fontWeight: source.font?.bold ? "700" : "400",
        fontStyle: source.font?.italic ? "italic" : "normal",
        textAlign: source.alignment?.horizontal === "right" || typeof source.result === "number" ? "right" : "left",
        verticalAlign: "middle",
        overflowWrap: "anywhere",
        border: source.border?.bottom || source.border?.left ? "1px solid #d1d5db" : "none",
      });
    }
  }
  frame.append(table);
  document.body.append(frame);
  try {
    const scale = Math.min(2, 16000 / frame.offsetHeight, Math.sqrt(32_000_000 / (frame.offsetWidth * frame.offsetHeight)));
    const canvas = await html2canvas(frame, {
      backgroundColor: "#ffffff",
      scale,
      logging: false,
      onclone(clonedDocument) {
        // Tailwind's block images shift html2canvas's inline font baseline probe.
        const style = clonedDocument.createElement("style");
        style.textContent = 'body > div[style*="visibility: hidden"] > img[width="1"][height="1"] { display: inline-block !important; }';
        clonedDocument.head.append(style);
      },
    });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không tạo được ảnh Tổng hợp.")), "image/png");
    });
  } finally {
    frame.remove();
  }
}
