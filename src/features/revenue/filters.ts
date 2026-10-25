export function quickRange(preset: string, now = new Date()): [string, string] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end);
  if (preset === 'yesterday') { start.setUTCDate(start.getUTCDate() - 1); end.setUTCDate(end.getUTCDate() - 1); }
  if (preset === 'week') start.setUTCDate(start.getUTCDate() - 6);
  if (preset === 'month') start.setUTCDate(1);
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}

export function validRange(from: string, to: string): boolean {
  const a = new Date(`${from}T00:00:00Z`), b = new Date(`${to}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)
    && Number.isFinite(+a) && Number.isFinite(+b) && a.toISOString().slice(0, 10) === from
    && b.toISOString().slice(0, 10) === to && +b >= +a && (+b - +a) / 86400000 <= 92;
}

export function loginRevenueTarget(value: string | null): string | null {
  return value && /^\/(?:doanh-thu|revenue)(?:\?[^\\\r\n]*)?$/.test(value) ? value.replace(/^\/revenue(?=\?|$)/, '/doanh-thu') : null;
}
