import ExcelJS from "exceljs";
async function reportWorkbook(snapshot) {
  const { input, report } = snapshot, w = new ExcelJS.Workbook();
  w.creator = "TN Services";
  w.created = new Date(snapshot.createdAt || Date.now());
  const add = (name) => {
    const s = w.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
    s.properties.defaultRowHeight = 22;
    s.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    return s;
  };
  const title = (s, text, cols) => {
    s.mergeCells(1, 1, 1, cols);
    s.getCell(1, 1).value = text;
    s.getCell(1, 1).font = { bold: true, size: 16, color: { argb: "FF065F46" } };
    s.getRow(1).height = 32;
    s.getCell(2, 1).value = `Lẩu / ${input.from} – ${input.to} / ${snapshot.id || "Bản xem trước"}`;
    s.mergeCells(2, 1, 2, cols);
  };
  const header = (s, row, values) => {
    s.getRow(row).values = values;
    s.getRow(row).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s.getRow(row).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
    s.getRow(row).height = 32;
    s.getRow(row).alignment = { wrapText: true, vertical: "middle" };
  };
  const overview = add("TONG_HOP");
  title(overview, "BÁO CÁO ĐỐI SOÁT NGUYÊN LIỆU", 14);
  header(overview, 4, ["STT", "Nguyên liệu", "ĐVT kho", "Tồn kho đầu", "Nhập kho", "Cấp bếp", "Tồn kho cuối", "Định mức (quy về NL kho)", "Sử dụng thực tế*", "Chênh lệch chưa giải thích", "Lệch cấp bếp – định mức", "Sai lệch sơ chế mẻ cân*", "Tình trạng", "Chi tiết"]);
  report.rows.forEach((r, i) => {
    const sheetName = `${String(i + 1).padStart(2, "0")}_${r.name.replace(/[\\/*?:\[\]]/g, " ").slice(0, 27)}`;
    overview.addRow([i + 1, r.name, r.unit, r.warehouseOpening, r.received, r.issued, r.warehouseClosing, r.theoretical, r.actual, r.variance, r.issued - r.theoretical, r.processingVariance, r.actual === null ? "Thiếu kiểm kê bếp" : r.estimated ? "Có quy đổi ước tính" : "Đủ kiểm kê", { text: "Xem chi tiết", hyperlink: `#'${sheetName.replace(/'/g, "''")}'!A1` }]);
    const s = add(sheetName);
    title(s, r.name + " · " + r.unit, 13);
    header(s, 4, ["Mã hàng", "Tên món / combo bán", "SL bán", "Món thành phần", "Nguyên liệu Cost", "Định lượng/phần", "ĐVT Cost", "Số phần đã nhân", "Trạng thái Cost", "Hệ số ĐVT", "Thu hồi chuẩn", "Tổng theo ĐVT kho", "Nguồn công thức"]);
    for (const d of r.details) s.addRow([d.code, d.saleName, d.sold, d.recipeName, d.ingredient, d.quantity, d.unit, d.portions, d.stage === "raw" ? "Chưa sơ chế" : "Đã sơ chế", d.factor, d.yieldRatio, d.total, d.source]);
    s.addRow([]);
    for (const [label, value] of [["TỔNG TIÊU HAO ĐỊNH MỨC", r.theoretical], ["Tồn kho đầu kỳ", r.warehouseOpening], ["Nhập kho trong kỳ", r.received], ["Cấp xuống bếp", r.issued], ["Điều chỉnh kho", r.warehouseAdjustment], ["Tồn kho cuối kỳ", r.warehouseClosing], ["Tồn bếp đầu: chưa sơ chế", r.count.rawOpen ?? "Chưa nhập"], ["Tồn bếp đầu: đã sơ chế", r.count.preparedOpen ?? "Chưa nhập"], ["Tồn bếp cuối: chưa sơ chế", r.count.rawClose ?? "Chưa nhập"], ["Tồn bếp cuối: đã sơ chế", r.count.preparedClose ?? "Chưa nhập"], ["Điều chỉnh bếp (ĐVT kho)", r.kitchenAdjustment], ["Sử dụng thực tế quy về NL kho", r.actual ?? "Chưa đủ kiểm kê"], ["Chênh lệch chưa giải thích (thực tế − định mức)", r.variance ?? "Chưa đủ kiểm kê"], ["Lệch cấp bếp − định mức", r.issued - r.theoretical], ["Đầu vào các mẻ cân", r.batchInput], ["Đầu ra các mẻ cân", r.batchOutput], ["Sai lệch sơ chế so với tỷ lệ chuẩn", r.processingVariance], ["Tỷ lệ thu hồi chuẩn", r.yieldRatio ?? "Chưa khai báo"]]) s.addRow([label, value]);
    s.addRow(["Lưu ý", r.estimated ? "Có quy đổi theo tỷ lệ chuẩn; tách riêng sai lệch mẻ cân." : "Định lượng cùng trạng thái kho."]);
    s.addRow(["Nguồn kho", `${input.sources?.stock?.name || ""}; dòng ${(r.sourceRows || []).join(", ")}`]);
    s.addRow(["Ngày", "Nhập kho", "Cấp bếp"]);
    for (const m of r.moves.filter((m2) => m2.date >= input.from && m2.date <= input.to && (m2.received || m2.issued))) s.addRow([m.date, m.received, m.issued]);
    s.addRow(["Điều chỉnh", "Vị trí", "Số lượng", "Lý do"]);
    for (const a of r.adjustments) s.addRow([a.date, a.location === "warehouse" ? "Kho" : "Bếp", a.quantity, a.reason]);
    s.columns.forEach((c, j) => {
      c.width = j === 0 ? 30 : j === 1 ? 36 : j === 3 || j === 4 || j === 12 ? 30 : 18;
    });
    s.eachRow((row, n) => {
      if (n > 4) {
        row.alignment = { vertical: "top", wrapText: true };
        row.height = Math.max(24, Math.min(70, Math.ceil(String(row.getCell(1).value || "").length / 30) * 20));
      }
    });
  });
  const notes = add("GHI_CHU");
  title(notes, "NGUỒN VÀ PHẠM VI BÁO CÁO", 5);
  notes.addRow(["Thời điểm chốt", snapshot.createdAt || "Chưa chốt"]);
  notes.addRow(["Người chốt", snapshot.createdBy || ""]);
  for (const text of report.warnings) notes.addRow([text]);
  notes.addRow(["Thiếu kiểm kê bếp: chỉ đối chiếu lượng cấp và định mức; không tính thực tế bằng 0."]);
  for (const [kind, source] of Object.entries(input.sources || {})) if (source) notes.addRow([kind, source.name, source.sha256]);
  notes.addRow(["Món bỏ qua", "Mã", "SL bán", "Lý do"]);
  for (const s of report.skipped) notes.addRow([s.name, s.code, s.quantity, s.reason]);
  notes.addRow(["Nguyên liệu ngoài phạm vi", "Lý do"]);
  for (const r of report.outside) notes.addRow([r.name, r.reason]);
  notes.addRow(["Chỉnh sửa công thức", "Nguyên liệu", "Giá trị nhập", "Giá trị dùng", "Ghi chú"]);
  for (const r of input.recipes || []) for (const l of r.lines || []) if (l.note) notes.addRow([r.name, l.name, l.importedQuantity ?? "", l.quantity, l.note]);
  notes.columns = [{ width: 66 }, { width: 38 }, { width: 42 }, { width: 40 }, { width: 65 }];
  notes.eachRow((r) => {
    r.alignment = { wrapText: true, vertical: "top" };
    r.height = 42;
  });
  overview.columns.forEach((c, i) => {
    c.width = i === 1 ? 30 : i === 12 ? 28 : 19;
  });
  for (const s of w.worksheets) {
    s.eachRow((row, n) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "number") cell.numFmt = "#,##0.###";
        if (n > 4) cell.border = { bottom: { style: "hair", color: { argb: "FFE2E8F0" } } };
      });
    });
    s.autoFilter = { from: "A4", to: { row: 4, column: s === overview ? 14 : s.name === "GHI_CHU" ? 1 : 13 } };
  }
  return w;
}
async function downloadReport(snapshot) {
  const w = await reportWorkbook(snapshot);
  download(await w.xlsx.writeBuffer(), `bao-cao-nguyen-lieu_${snapshot.input.from}_${snapshot.input.to}_${snapshot.id || "nhap"}.xlsx`);
}
function download(data, name) {
  const url = URL.createObjectURL(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
async function downloadCountTemplate(stock) {
  const w = new ExcelJS.Workbook(), s = w.addWorksheet("KIEM_KE_BEP");
  s.addRow(["Nguyên liệu", "Tồn đầu chưa sơ chế", "Tồn cuối chưa sơ chế", "Tồn đầu đã sơ chế", "Tồn cuối đã sơ chế", "ĐVT"]);
  for (const r of stock) s.addRow([r.name, null, null, null, null, r.unit]);
  s.columns.forEach((c) => c.width = 26);
  s.getRow(1).font = { bold: true };
  s.getRow(1).alignment = { wrapText: true };
  s.getRow(1).height = 32;
  await download(await w.xlsx.writeBuffer(), "mau-kiem-ke-bep.xlsx");
}
export {
  download,
  downloadCountTemplate,
  downloadReport,
  reportWorkbook
};
