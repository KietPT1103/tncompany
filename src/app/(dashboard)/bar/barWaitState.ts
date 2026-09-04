export type BarWaitState = "normal" | "warning" | "urgent";

export const BAR_WAIT_WARNING_MINUTES = 6;
export const BAR_WAIT_URGENT_MINUTES = 12;
export const BAR_URGENT_PULSE_INTERVAL_MS = 800;
export const BAR_URGENT_REMINDER_INTERVAL_MS = 60_000;

export function getBarWaitState(elapsedMinutes: number): BarWaitState {
  if (elapsedMinutes >= BAR_WAIT_URGENT_MINUTES) return "urgent";
  if (elapsedMinutes >= BAR_WAIT_WARNING_MINUTES) return "warning";
  return "normal";
}

export function getBarUrgentPulsePhase(timestamp: number): boolean {
  return (
    Math.floor(timestamp / BAR_URGENT_PULSE_INTERVAL_MS) % 2 === 0
  );
}
