type ShiftDayInfo = { id?: string; openedAt?: { seconds: number } };
export function businessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function isPreviousDayShift(shift?: ShiftDayInfo | null, now = new Date()): boolean {
  return !!shift?.openedAt && businessDate(new Date(shift.openedAt.seconds * 1000)) < businessDate(now);
}
export function shiftAcknowledgementKey(shift: ShiftDayInfo, now = new Date()): string {
  return `shift-overnight:${shift.id}:${shift.openedAt?.seconds}:${businessDate(now)}`;
}
export function hasShiftAcknowledgement(shift: ShiftDayInfo): boolean {
  try { return sessionStorage.getItem(shiftAcknowledgementKey(shift)) === 'confirmed'; } catch { return false; }
}
export function acknowledgePreviousDayShift(shift: ShiftDayInfo): void {
  try { sessionStorage.setItem(shiftAcknowledgementKey(shift), 'confirmed'); } catch { /* The current POS view still records the explicit acknowledgement. */ }
}
