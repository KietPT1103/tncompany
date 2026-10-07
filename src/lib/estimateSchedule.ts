export function removeEstimateRole(schedule: Record<string, string[]>, role: string): Record<string, string[]> {
  return Object.fromEntries(Object.entries(schedule).filter(([key]) => key.split('__')[1] !== role));
}
