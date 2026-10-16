import { patternDailyMinutes, type Employee } from './planner';

export const DISCIPLINES = ['Developer', '3D designer'] as const;

export function standardWeeklyMinutes(employee: Employee, date: string) {
  const pattern = [...employee.patterns]
    .sort((a, b) => b.from.localeCompare(a.from))
    .find(p => p.from <= date);
  return pattern
    ? Array.from({ length: 7 }, (_, day) => patternDailyMinutes(pattern, day))
      .reduce((sum, value) => sum + value, 0)
    : null;
}
