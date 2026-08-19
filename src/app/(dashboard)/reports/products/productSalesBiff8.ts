import * as XLSX from "xlsx";

type BiffRecord = {
  type: number;
  payload: Uint8Array;
};

type CellStyle = {
  fontId: number;
  numberFormatId?: number;
  horizontal?: 0 | 1 | 2 | 3;
  vertical?: 0 | 1 | 2;
  wrapText?: boolean;
  topBorderStyle?: number;
  topBorderColor?: number;
  bottomBorderStyle?: number;
  bottomBorderColor?: number;
};

type StyleRole =
  | "date"
  | "title"
  | "subtitle"
  | "note"
  | "headerLeft"
  | "headerRight"
  | "summaryLeft"
  | "summaryQuantity"
  | "summaryMoney"
  | "code"
  | "name"
  | "quantity"
  | "money";

const BIFF = {
  blank: 0x0201,
  booleanError: 0x0205,
  boundSheet: 0x0085,
  dimensions: 0x0200,
  eof: 0x000a,
  font: 0x0031,
  formula: 0x0006,
  label: 0x0204,
  labelSst: 0x00fd,
  mergeCells: 0x00e5,
  number: 0x0203,
  rk: 0x027e,
  row: 0x0208,
  xf: 0x00e0,
} as const;

const CELL_RECORD_TYPES = new Set<number>([
  BIFF.blank,
  BIFF.booleanError,
  BIFF.formula,
  BIFF.label,
  BIFF.labelSst,
  BIFF.number,
  BIFF.rk,
]);

const COLOR_BLACK = 8;
const COLOR_AUTOMATIC = 63;
const COLOR_DEFAULT_BORDER = 64;
const COLOR_HEADER_BLUE = 44;
const COLOR_PRODUCT_CODE = 30;
const COLOR_LIGHT_GRAY = 22;
const BORDER_MEDIUM = 2;
type XlsxModuleInterop = { CFB?: typeof XLSX.CFB };
const xlsxInterop = XLSX as unknown as XlsxModuleInterop;
const xlsxDefault = Reflect.get(XLSX as object, "default") as XlsxModuleInterop | undefined;
const CFB = xlsxInterop.CFB || xlsxDefault?.CFB;

if (!CFB) throw new Error("SheetJS CFB utilities are unavailable.");

const readUint16 = (bytes: Uint8Array, offset: number) =>
  bytes[offset] | (bytes[offset + 1] << 8);

const readUint32 = (bytes: Uint8Array, offset: number) =>
  (bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)) >>> 0;

const writeUint16 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32 = (bytes: Uint8Array, offset: number, value: number) => {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
};

function concatBytes(chunks: Uint8Array[]) {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function parseBiffRecords(bytes: Uint8Array, start: number, end: number) {
  const records: BiffRecord[] = [];
  let offset = start;

  while (offset + 4 <= end) {
    const type = readUint16(bytes, offset);
    const length = readUint16(bytes, offset + 2);
    const payloadStart = offset + 4;
    const payloadEnd = payloadStart + length;

    if (payloadEnd > end) {
      throw new Error(`Invalid BIFF8 record 0x${type.toString(16)}.`);
    }

    records.push({ type, payload: bytes.slice(payloadStart, payloadEnd) });
    offset = payloadEnd;
  }

  if (offset !== end) {
    throw new Error("Invalid BIFF8 workbook stream length.");
  }

  return records;
}

function serializeBiffRecord(record: BiffRecord) {
  const output = new Uint8Array(4 + record.payload.length);
  writeUint16(output, 0, record.type);
  writeUint16(output, 2, record.payload.length);
  output.set(record.payload, 4);
  return output;
}

function findGlobalStreamEnd(bytes: Uint8Array) {
  let offset = 0;

  while (offset + 4 <= bytes.length) {
    const type = readUint16(bytes, offset);
    const length = readUint16(bytes, offset + 2);
    const recordEnd = offset + 4 + length;

    if (recordEnd > bytes.length) {
      throw new Error("Invalid BIFF8 global workbook stream.");
    }
    if (type === BIFF.eof) return recordEnd;
    offset = recordEnd;
  }

  throw new Error("BIFF8 global workbook terminator not found.");
}

function splitOversizedMergeCellRecords(bytes: Uint8Array, sheetOffset: number) {
  // BIFF8 permits at most 1,027 ranges per MERGECELLS record.
  const MAX_MERGES_PER_RECORD = 1_027;
  const output: Uint8Array[] = [];
  let copiedThrough = 0;
  let offset = sheetOffset;

  while (offset + 4 <= bytes.length) {
    const type = readUint16(bytes, offset);
    const declaredLength = readUint16(bytes, offset + 2);

    if (type === BIFF.mergeCells) {
      const mergeCount = readUint16(bytes, offset + 4);
      const actualLength = 2 + mergeCount * 8;
      const actualRecordEnd = offset + 4 + actualLength;

      if (actualRecordEnd > bytes.length) {
        throw new Error("Invalid BIFF8 merged-cell record.");
      }

      if (mergeCount > MAX_MERGES_PER_RECORD) {
        output.push(bytes.slice(copiedThrough, offset));

        for (let start = 0; start < mergeCount; start += MAX_MERGES_PER_RECORD) {
          const count = Math.min(MAX_MERGES_PER_RECORD, mergeCount - start);
          const payload = new Uint8Array(2 + count * 8);
          writeUint16(payload, 0, count);
          payload.set(
            bytes.slice(offset + 6 + start * 8, offset + 6 + (start + count) * 8),
            2,
          );
          output.push(serializeBiffRecord({ type: BIFF.mergeCells, payload }));
        }

        copiedThrough = actualRecordEnd;
        offset = actualRecordEnd;
        continue;
      }

      if (declaredLength !== actualLength) {
        throw new Error("Invalid BIFF8 merged-cell record length.");
      }
    }

    const recordEnd = offset + 4 + declaredLength;
    if (recordEnd > bytes.length) {
      throw new Error(`Invalid BIFF8 record 0x${type.toString(16)}.`);
    }
    offset = recordEnd;
    if (type === BIFF.eof) break;
  }

  if (output.length === 0) return bytes;
  output.push(bytes.slice(copiedThrough));
  return concatBytes(output);
}

function createFontRecord({
  size,
  bold = false,
  italic = false,
  color = COLOR_BLACK,
}: {
  size: number;
  bold?: boolean;
  italic?: boolean;
  color?: number;
}): BiffRecord {
  const fontName = "Arial";
  const payload = new Uint8Array(16 + fontName.length * 2);
  writeUint16(payload, 0, size * 20);
  writeUint16(payload, 2, italic ? 0x0002 : 0);
  writeUint16(payload, 4, color);
  writeUint16(payload, 6, bold ? 700 : 400);
  payload[12] = 1;
  payload[14] = fontName.length;
  payload[15] = 1;

  for (let index = 0; index < fontName.length; index += 1) {
    writeUint16(payload, 16 + index * 2, fontName.charCodeAt(index));
  }

  return { type: BIFF.font, payload };
}

function createXfRecord({
  fontId,
  numberFormatId = 0,
  horizontal = 0,
  vertical = 0,
  wrapText = false,
  topBorderStyle = 0,
  topBorderColor = COLOR_DEFAULT_BORDER,
  bottomBorderStyle = 0,
  bottomBorderColor = COLOR_DEFAULT_BORDER,
}: CellStyle): BiffRecord {
  const payload = new Uint8Array(20);
  const hasBorder = topBorderStyle > 0 || bottomBorderStyle > 0;
  const alignment =
    horizontal |
    (wrapText ? 0x08 : 0) |
    (vertical << 4) |
    (hasBorder ? 0x60400000 : 0x20400000);
  const borderStyles =
    (topBorderStyle << 8) |
    (bottomBorderStyle << 12) |
    (COLOR_DEFAULT_BORDER << 16) |
    (COLOR_DEFAULT_BORDER << 23);
  const borderColors = topBorderColor | (bottomBorderColor << 7);

  writeUint16(payload, 0, fontId);
  writeUint16(payload, 2, numberFormatId);
  writeUint16(payload, 4, 1);
  writeUint32(payload, 6, alignment);
  writeUint32(payload, 10, borderStyles);
  writeUint32(payload, 14, borderColors);
  writeUint16(payload, 18, 0x20c0);
  return { type: BIFF.xf, payload };
}

function createRowRecord(rowIndex: number, heightPoints: number): BiffRecord {
  const payload = new Uint8Array(16);
  writeUint16(payload, 0, rowIndex);
  writeUint16(payload, 2, 0);
  writeUint16(payload, 4, 12);
  writeUint16(payload, 6, Math.round(heightPoints * 20));
  payload[12] = 0x40;
  return { type: BIFF.row, payload };
}

function fontIdFromRecordIndex(recordIndex: number) {
  return recordIndex >= 4 ? recordIndex + 1 : recordIndex;
}

function getCellStyleIndex(records: BiffRecord[], row: number, column: number) {
  const cell = records.find(
    (record) =>
      CELL_RECORD_TYPES.has(record.type) &&
      record.payload.length >= 6 &&
      readUint16(record.payload, 0) === row &&
      readUint16(record.payload, 2) === column,
  );
  return cell ? readUint16(cell.payload, 4) : undefined;
}

function getNumberFormatId(
  records: BiffRecord[],
  xfs: BiffRecord[],
  row: number,
  column: number,
) {
  const styleIndex = getCellStyleIndex(records, row, column);
  if (styleIndex === undefined || !xfs[styleIndex]) return 0;
  return readUint16(xfs[styleIndex].payload, 2);
}

function findLastRecordIndex(records: BiffRecord[], type: number) {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index].type === type) return index;
  }
  return -1;
}

function styleRoleForCell(row: number, column: number): StyleRole | undefined {
  if (row === 0 && column === 1) return "date";
  if (row === 1 && column === 3) return "title";
  if ((row === 3 || row === 4) && column === 1) return "subtitle";

  if (row === 6 && column === 5) return "note";

  if (row === 7 && column >= 1 && column <= 10) {
    return column <= 4 ? "headerLeft" : "headerRight";
  }

  if (row === 8 && column >= 1 && column <= 10) {
    if (column <= 3) return "summaryLeft";
    if (column === 4 || column === 5 || column === 7) return "summaryQuantity";
    return "summaryMoney";
  }

  if (row >= 10 && column >= 1 && column <= 10) {
    if (column === 1) return "code";
    if (column >= 2 && column <= 4) return "name";
    if (column === 5 || column === 7) return "quantity";
    return "money";
  }

  return undefined;
}

export function applyProductSalesBiff8Styles(
  workbookBytes: Uint8Array,
  rowHeights: number[],
) {
  const cfb = CFB.read(workbookBytes, { type: "array" });
  const workbookEntryIndex = cfb.FullPaths.findIndex((path: string) => /Workbook$/.test(path));

  if (workbookEntryIndex === -1) {
    throw new Error("Workbook stream not found in BIFF8 file.");
  }

  const sourceWorkbookStream = Uint8Array.from(cfb.FileIndex[workbookEntryIndex].content);
  const globalStreamEnd = findGlobalStreamEnd(sourceWorkbookStream);
  const sourceGlobalRecords = parseBiffRecords(sourceWorkbookStream, 0, globalStreamEnd);
  const boundSheetRecord = sourceGlobalRecords.find((record) => record.type === BIFF.boundSheet);

  if (!boundSheetRecord) {
    throw new Error("Worksheet metadata not found in BIFF8 file.");
  }

  const sheetOffset = readUint32(boundSheetRecord.payload, 0);
  const workbookStream = splitOversizedMergeCellRecords(sourceWorkbookStream, sheetOffset);
  const globalRecords = parseBiffRecords(workbookStream, 0, sheetOffset);
  const sheetRecords = parseBiffRecords(workbookStream, sheetOffset, workbookStream.length);
  const existingFonts = globalRecords.filter((record) => record.type === BIFF.font);
  const existingXfs = globalRecords.filter((record) => record.type === BIFF.xf);
  const quantityNumberFormatId = getNumberFormatId(sheetRecords, existingXfs, 8, 4);
  const moneyNumberFormatId = getNumberFormatId(sheetRecords, existingXfs, 8, 6);

  const customFonts = [
    createFontRecord({ size: 8.25, color: COLOR_AUTOMATIC }),
    createFontRecord({ size: 9, color: COLOR_AUTOMATIC }),
    createFontRecord({ size: 9, bold: true, color: COLOR_AUTOMATIC }),
    createFontRecord({ size: 15, bold: true, color: COLOR_AUTOMATIC }),
    createFontRecord({ size: 9, italic: true, color: COLOR_BLACK }),
    createFontRecord({ size: 9, bold: true, color: COLOR_PRODUCT_CODE }),
  ];
  const fontIds = customFonts.map((_, index) =>
    fontIdFromRecordIndex(existingFonts.length + index),
  );
  const [dateFont, regularFont, boldFont, titleFont, italicFont, codeFont] = fontIds;
  const grayBorder = {
    bottomBorderStyle: BORDER_MEDIUM,
    bottomBorderColor: COLOR_LIGHT_GRAY,
  } as const;
  const headerBorder = {
    topBorderStyle: BORDER_MEDIUM,
    topBorderColor: COLOR_HEADER_BLUE,
    bottomBorderStyle: BORDER_MEDIUM,
    bottomBorderColor: COLOR_HEADER_BLUE,
  } as const;
  // These XF values mirror the visual metadata in the reference BIFF8 report.
  const styleRecords: Record<StyleRole, BiffRecord> = {
    date: createXfRecord({
      fontId: dateFont,
      horizontal: 1,
      vertical: 1,
      wrapText: true,
    }),
    title: createXfRecord({
      fontId: titleFont,
      horizontal: 2,
      vertical: 1,
      wrapText: true,
    }),
    subtitle: createXfRecord({ fontId: regularFont, horizontal: 2, wrapText: true }),
    note: createXfRecord({ fontId: italicFont, horizontal: 3, wrapText: true }),
    headerLeft: createXfRecord({
      fontId: boldFont,
      horizontal: 1,
      vertical: 1,
      wrapText: true,
      ...headerBorder,
    }),
    headerRight: createXfRecord({
      fontId: boldFont,
      horizontal: 3,
      vertical: 1,
      wrapText: true,
      ...headerBorder,
    }),
    summaryLeft: createXfRecord({
      fontId: boldFont,
      horizontal: 1,
      vertical: 1,
      wrapText: true,
      ...grayBorder,
    }),
    summaryQuantity: createXfRecord({
      fontId: boldFont,
      numberFormatId: quantityNumberFormatId,
      horizontal: 3,
      vertical: 1,
      wrapText: true,
      ...grayBorder,
    }),
    summaryMoney: createXfRecord({
      fontId: boldFont,
      numberFormatId: moneyNumberFormatId,
      horizontal: 3,
      vertical: 1,
      wrapText: true,
      ...grayBorder,
    }),
    code: createXfRecord({
      fontId: codeFont,
      horizontal: 1,
      vertical: 1,
      wrapText: true,
      ...grayBorder,
    }),
    name: createXfRecord({
      fontId: regularFont,
      horizontal: 1,
      vertical: 1,
      wrapText: true,
      ...grayBorder,
    }),
    quantity: createXfRecord({
      fontId: regularFont,
      numberFormatId: quantityNumberFormatId,
      horizontal: 3,
      vertical: 1,
      wrapText: true,
      ...grayBorder,
    }),
    money: createXfRecord({
      fontId: regularFont,
      numberFormatId: moneyNumberFormatId,
      horizontal: 3,
      vertical: 1,
      wrapText: true,
      ...grayBorder,
    }),
  };
  const customXfs = Object.values(styleRecords);
  const styleIndexes = Object.fromEntries(
    Object.keys(styleRecords).map((role, index) => [role, existingXfs.length + index]),
  ) as Record<StyleRole, number>;
  const addedGlobalByteLength = [...customFonts, ...customXfs].reduce(
    (total, record) => total + serializeBiffRecord(record).length,
    0,
  );
  const lastFontIndex = findLastRecordIndex(globalRecords, BIFF.font);
  const lastXfIndex = findLastRecordIndex(globalRecords, BIFF.xf);
  const styledGlobalRecords: BiffRecord[] = [];

  globalRecords.forEach((record, index) => {
    const payload = record.payload.slice();
    if (record.type === BIFF.boundSheet) {
      writeUint32(payload, 0, sheetOffset + addedGlobalByteLength);
    }
    styledGlobalRecords.push({ type: record.type, payload });
    if (index === lastFontIndex) styledGlobalRecords.push(...customFonts);
    if (index === lastXfIndex) styledGlobalRecords.push(...customXfs);
  });

  const styledSheetRecords: BiffRecord[] = [];
  sheetRecords.forEach((record) => {
    const payload = record.payload.slice();

    if (CELL_RECORD_TYPES.has(record.type) && payload.length >= 6) {
      const row = readUint16(payload, 0);
      const column = readUint16(payload, 2);
      const role = styleRoleForCell(row, column);
      if (role) writeUint16(payload, 4, styleIndexes[role]);
    }

    styledSheetRecords.push({ type: record.type, payload });
    if (record.type === BIFF.dimensions) {
      styledSheetRecords.push(
        ...rowHeights.map((height, rowIndex) => createRowRecord(rowIndex, height)),
      );
    }
  });

  if (!globalRecords.some((record) => record.type === BIFF.eof)) {
    throw new Error("Invalid BIFF8 global workbook stream.");
  }

  const styledWorkbookStream = concatBytes(
    [...styledGlobalRecords, ...styledSheetRecords].map(serializeBiffRecord),
  );
  cfb.FileIndex[workbookEntryIndex].content = styledWorkbookStream;
  cfb.FileIndex[workbookEntryIndex].size = styledWorkbookStream.length;
  return Uint8Array.from(CFB.write(cfb, { type: "array" }));
}
