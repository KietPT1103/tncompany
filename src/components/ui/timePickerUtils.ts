const padTimePart = (value: number) => String(value).padStart(2, "0");

export function normalizeTimeValue(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

export function setTimePart(
  currentValue: string,
  part: "hour" | "minute",
  nextValue: number,
) {
  const normalized = normalizeTimeValue(currentValue) || "00:00";
  const [currentHour, currentMinute] = normalized.split(":").map(Number);
  const hour = part === "hour" ? nextValue : currentHour;
  const minute = part === "minute" ? nextValue : currentMinute;

  return `${padTimePart(hour)}:${padTimePart(minute)}`;
}

export function getMinuteOptions(currentValue: string) {
  const minute = Number((normalizeTimeValue(currentValue) || "00:00").slice(3));
  return Array.from(
    new Set([...Array.from({ length: 12 }, (_, index) => index * 5), minute]),
  ).sort((left, right) => left - right);
}

export function formatTimeValue(date: Date) {
  return `${padTimePart(date.getHours())}:${padTimePart(date.getMinutes())}`;
}
