export const DATE_RANGE_WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export const parseDateValue = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day, 12, 0, 0, 0);

  return date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
    ? date
    : null;
};

export const formatDateValue = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

export const formatDisplayDate = (value: string) => {
  const date = parseDateValue(value);
  return date
    ? date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "--/--/----";
};

export const getMonthStart = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);

export const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0, 0);

export const buildCalendarDays = (month: Date) => {
  const firstDay = getMonthStart(month);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
};

export const isSameDay = (left: Date, right: Date | null) =>
  Boolean(
    right &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );

export const getToday = () => {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
};
