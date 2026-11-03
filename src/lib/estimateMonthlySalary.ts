type EstimatedShift = { date: string; role?: string; hours: number };

export function getMonthlyEstimateCosts(monthlySalary: number, shifts: EstimatedShift[]) {
  const days = new Map<string, EstimatedShift[]>();
  for (const shift of shifts) {
    if (!shift.date || shift.hours <= 0) continue;
    const day = days.get(shift.date) || [];
    day.push(shift);
    days.set(shift.date, day);
  }

  const dailySalary = Math.max(0, monthlySalary || 0) / 30;
  const roleSalaries: Record<string, number> = {};
  for (const day of days.values()) {
    const hours = day.reduce((sum, shift) => sum + shift.hours, 0);
    for (const shift of day) {
      const role = shift.role || "";
      roleSalaries[role] = (roleSalaries[role] || 0) + dailySalary * shift.hours / hours;
    }
  }
  return { salary: dailySalary * days.size, roleSalaries };
}
