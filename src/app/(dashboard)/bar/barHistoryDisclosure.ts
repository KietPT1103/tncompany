export function toggleHistoryBillDisclosure(
  current: ReadonlySet<string>,
  billId: string,
) {
  const next = new Set(current);

  if (next.has(billId)) {
    next.delete(billId);
  } else {
    next.add(billId);
  }

  return next;
}
