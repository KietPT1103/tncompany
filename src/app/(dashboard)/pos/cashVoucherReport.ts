export type VoucherFilter = 'all' | 'income' | 'expense';
export function cashVoucherReport<T extends { type: 'income' | 'expense'; amount: number; isCancelled?: boolean }>(vouchers: T[], filter: VoucherFilter) {
const items = vouchers.filter(v => !v.isCancelled && (filter === 'all' || v.type === filter));
return { items, income: items.filter(v => v.type === 'income').reduce((sum,v) => sum + v.amount,0), expense: items.filter(v => v.type === 'expense').reduce((sum,v) => sum + v.amount,0) };
}
