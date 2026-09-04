export const BAR_RECEIPT_COMPACT_ITEM_THRESHOLD = 8;

export const getBarReceiptItemColumns = <T>(items: readonly T[]): T[][] => {
  if (items.length <= BAR_RECEIPT_COMPACT_ITEM_THRESHOLD) {
    return [[...items]];
  }

  const firstColumnLength = Math.ceil(items.length / 2);
  return [
    items.slice(0, firstColumnLength),
    items.slice(firstColumnLength),
  ];
};
