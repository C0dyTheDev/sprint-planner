import { dayOf, patternDailyMinutes, rangeReport, type Employee, type State } from './planner';

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

export type FreePerson = { employee: Employee; fitDays: number; days: number; freeMinutes: number };

// Ranks active people by how many selected days still have the requested hours free, then by total free time.
export function findFreePeople(state: State, query: { start: string; end: string; weekdays: number[]; minutesPerDay: number; skill?: string; discipline?: string }): FreePerson[] {
  const report = rangeReport(state, query.start, query.end);
  return report.people
    .filter(p => !p.employee.archived && (!query.skill || p.employee.skills.includes(query.skill)) && (!query.discipline || p.employee.discipline === query.discipline))
    .map(p => {
      const cells = p.cells.filter(c => query.weekdays.includes(dayOf(c.date)));
      const free = cells.map(c => c.unknown ? 0 : Math.max(0, c.capacity - c.allocated));
      return { employee: p.employee, days: cells.length, fitDays: free.filter(f => f >= query.minutesPerDay).length, freeMinutes: free.reduce((sum, f) => sum + f, 0) };
    })
    .filter(p => p.freeMinutes > 0)
    .sort((a, b) => b.fitDays - a.fitDays || b.freeMinutes - a.freeMinutes || a.employee.name.localeCompare(b.employee.name));
}
