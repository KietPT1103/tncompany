export type BillDatePreset =
  | "today"
  | "yesterday"
  | "last7Days"
  | "thisMonth"
  | "previousMonth";

export function getBillDatePresetRange(
  preset: BillDatePreset,
  referenceDate = new Date(),
) {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );

  if (preset === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: yesterday, end: yesterday };
  }

  if (preset === "last7Days") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { start, end: today };
  }

  if (preset === "thisMonth") {
    return {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: today,
    };
  }

  if (preset === "previousMonth") {
    return {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 0),
    };
  }

  return { start: today, end: today };
}
