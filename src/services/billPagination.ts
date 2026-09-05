export const BILL_API_PAGE_SIZE = 2000;

export async function collectAllBillPages<T extends { id: string }>(
  loadPage: (offset: number, limit: number) => Promise<T[]>,
  pageSize = BILL_API_PAGE_SIZE,
): Promise<T[]> {
  const bills: T[] = [];
  const seenIds = new Set<string>();
  let offset = 0;

  while (true) {
    const page = await loadPage(offset, pageSize);
    let newBillCount = 0;

    page.forEach((bill) => {
      if (seenIds.has(bill.id)) return;
      seenIds.add(bill.id);
      bills.push(bill);
      newBillCount += 1;
    });

    if (page.length < pageSize) return bills;
    if (newBillCount === 0) {
      throw new Error("API phân trang hóa đơn không trả thêm dữ liệu mới.");
    }

    offset += page.length;
  }
}
