function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatLocalDateTime(date: Date) {
  return [
    date.getFullYear(),
    "-",
    padDatePart(date.getMonth() + 1),
    "-",
    padDatePart(date.getDate()),
    "T",
    padDatePart(date.getHours()),
    ":",
    padDatePart(date.getMinutes()),
  ].join("");
}

export function toApiDateTime(value: string | null) {
  if (!value) return null;

  const normalized = value.trim().replace("T", " ");
  if (!normalized) return null;

  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized.slice(0, 19);
}

export function resolvePublishedAt(
  nextPublished: boolean,
  currentValue: string | null,
  now = new Date(),
) {
  if (!nextPublished) return null;
  return currentValue || formatLocalDateTime(now);
}

export function combinePublishDateTime(date: string, time: string) {
  if (!date || !time) return null;
  return `${date}T${time}`;
}
