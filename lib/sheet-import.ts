import { dateAdd, dates, dayOf, mondayOf, patternDailyMinutes, type Employee, type Pattern, type State } from './planner';
import { cellRef, columnIndex, excelDate, type Sheet } from './xlsx';

// Capacity spreadsheet ("Dovolená & Kapacity"): a Kapacity sheet with standard and weekly hours per person,
// and a Dovolená sheet with month calendars where coloured days are leave.
export type SheetPerson = { name: string; role: string; standardHours: number | null; weeks: (number | null)[]; leave: string[] };
// end covers the weekly hours and every calendar date with leave; weekStarts are the quarter's weeks.
export type ParsedSheet = { label: string; start: string; end: string; weekStarts: string[]; holidays: string[]; people: SheetPerson[] };
export type ImportNote = { message: string; values?: Record<string, string | number> };
export type PersonPlan = { employeeId: string; name: string; sheetName: string; standard?: { from: number | null; to: number; daily: Record<string, number> }; overrides: { date: string; minutes: number }[]; leave: { start: string; end: string }[]; leaveDays: number };
export type ImportPlan = { people: PersonPlan[]; unmatched: string[]; notes: ImportNote[] };

const MONTHS = ['LEDEN', 'ÚNOR', 'BŘEZEN', 'DUBEN', 'KVĚTEN', 'ČERVEN', 'ČERVENEC', 'SRPEN', 'ZÁŘÍ', 'ŘÍJEN', 'LISTOPAD', 'PROSINEC'];
const WEEKDAYS: Record<string, number> = { PO: 1, ÚT: 2, ST: 3, ČT: 4, PÁ: 5, SO: 6, NE: 0 };
export const normalizeName = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[\s,]+/).filter(Boolean).sort().join(' ');
const text = (v: unknown) => v === null || v === undefined ? '' : String(v).trim();
const number = (v: unknown) => typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d+([.,]\d+)?\s*$/.test(v) ? Number(v.replace(',', '.')) : null;
const toMinutes = (hours: number) => Math.round(hours * 4) * 15;

export function parseCapacityWorkbook(sheets: Sheet[]): ParsedSheet {
  const capacity = sheets.find(s => [...s.cells.entries()].some(([ref, c]) => ref.startsWith('A') && /^jméno$/i.test(text(c.value))));
  if (!capacity) throw new Error('No sheet with a "Jméno" column was found');
  const at = (s: Sheet, col: number, row: number) => s.cells.get(cellRef(col, row))?.value ?? null;
  const setting = (label: string) => { for (const [ref, c] of capacity.cells) if (text(c.value) === label) return at(capacity, columnIndex(ref) + 1, Number(ref.match(/\d+/)![0])); return null; };
  const startSerial = number(setting('ZacatekKvartalu') ?? setting('Začátek')), endSerial = number(setting('KonecKvartalu') ?? setting('Konec'));
  if (startSerial === null || endSerial === null) throw new Error('The quarter start and end dates were not found in the Kapacity sheet');
  const start = excelDate(startSerial), quarterEnd = excelDate(endSerial), defaultHours = number(setting('VychoziHodinTydne')), weekCount = number(setting('PocetTydnu'));
  const headerRow = Number([...capacity.cells.entries()].find(([ref, c]) => ref.startsWith('A') && /^jméno$/i.test(text(c.value)))![0].slice(1));
  const weekColumns: number[] = [];
  for (let col = 1; col <= 60; col++) if (/^týden \d+$/i.test(text(at(capacity, col, headerRow)))) weekColumns.push(col);
  const weekStarts = weekColumns.map((_, i) => dateAdd(mondayOf(start), i * 7)).filter((w, i) => w <= quarterEnd && (weekCount === null || i < weekCount));
  let end = quarterEnd;
  const people: SheetPerson[] = [];
  for (let row = headerRow + 1; text(at(capacity, 1, row)); row++) {
    const standardCell = capacity.cells.get(cellRef(3, row));
    people.push({ name: text(at(capacity, 1, row)), role: text(at(capacity, 2, row)), standardHours: number(standardCell?.value) ?? (standardCell?.formula ? defaultHours : null), weeks: weekStarts.map((_, i) => number(at(capacity, weekColumns[i], row))), leave: [] });
  }
  const holidays = new Set<string>(), calendar = sheets.find(s => s !== capacity && [...s.cells.values()].some(c => MONTHS.includes(text(c.value).toUpperCase())));
  if (calendar) {
    const startYear = Number(start.slice(0, 4)), startMonth = Number(start.slice(5, 7)), columns = new Map<number, { month: number; weekday: number }>();
    let month = 0, lastRow = 0;
    for (const ref of calendar.cells.keys()) lastRow = Math.max(lastRow, Number(ref.match(/\d+/)![0]));
    for (let col = 2; col <= 60; col++) {
      const m = MONTHS.indexOf(text(at(calendar, col, 1)).toUpperCase());
      if (m >= 0) month = m + 1;
      const weekday = WEEKDAYS[text(at(calendar, col, 2)).toUpperCase()];
      if (month && weekday !== undefined) columns.set(col, { month, weekday });
    }
    const days: { owner: number; date: string; fill: string | null }[] = [], owners: string[] = [];
    for (let row = 3; row <= lastRow; row++) {
      if (text(at(calendar, 1, row))) owners.push(text(at(calendar, 1, row)));
      if (!owners.length) continue;
      for (const [col, { month: m, weekday }] of columns) {
        const cell = calendar.cells.get(cellRef(col, row)), day = number(cell?.value);
        if (!cell || day === null || day < 1 || day > 31) continue;
        const date = `${m >= startMonth ? startYear : startYear + 1}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (dayOf(date) === weekday) { days.push({ owner: owners.length - 1, date, fill: cell.fill }); if (date > end) end = date; }
      }
    }
    // Fills used on many days are backgrounds; a fill most people share on one date marks a holiday; any other fill is leave.
    const counts = new Map<string | null, number>();
    for (const d of days) counts.set(d.fill, (counts.get(d.fill) ?? 0) + 1);
    const background = new Set([...counts].filter(([, n]) => n >= days.length * 0.1).map(([f]) => f));
    const shared = new Map<string, number>();
    for (const d of days) if (!background.has(d.fill)) shared.set(d.date + '|' + d.fill, (shared.get(d.date + '|' + d.fill) ?? 0) + 1);
    for (const [key, n] of shared) if (n > owners.length / 2) holidays.add(key.split('|')[0]);
    for (const d of days) {
      if (background.has(d.fill) || (shared.get(d.date + '|' + d.fill) ?? 0) > owners.length / 2) continue;
      const surname = normalizeName(owners[d.owner]), matches = people.filter(p => normalizeName(p.name.split(/\s+/)[0]) === surname);
      if (matches.length === 1 && !matches[0].leave.includes(d.date)) matches[0].leave.push(d.date);
    }
  }
  for (const p of people) p.leave.sort();
  return { label: text(setting('NazevKvartalu')) || `${start} – ${end}`, start, end, weekStarts, holidays: [...holidays].sort(), people };
}

// Spreads a total over the given days in 15-minute steps; earlier days take the remainder.
function spread(total: number, days: string[]) {
  const units = Math.round(total / 15), base = Math.floor(units / days.length), extra = units - base * days.length;
  return Object.fromEntries(days.map((d, i) => [d, (base + (i < extra ? 1 : 0)) * 15]));
}
const patternAt = (patterns: Pattern[], date: string) => [...patterns].sort((a, b) => b.from.localeCompare(a.from)).find(p => p.from <= date);
const isSheetEntry = (x: { source?: string }) => x.source === 'sheet';

export function planSheetImport(state: Pick<State, 'employees' | 'overrides' | 'holidays'>, sheet: ParsedSheet): ImportPlan {
  const notes: ImportNote[] = [], unmatched: string[] = [], plans: PersonPlan[] = [];
  const known = new Set(state.holidays.map(h => h.date)), missingHolidays = sheet.holidays.filter(d => !known.has(d));
  if (missingHolidays.length) notes.push({ message: 'The spreadsheet marks {count} holidays that are not in the planner. Import Czech holidays first so those days have no capacity.', values: { count: missingHolidays.length } });
  const offDays = new Set([...known, ...sheet.holidays]);
  for (const person of sheet.people) {
    const matches = state.employees.filter(e => !e.archived && normalizeName(e.name) === normalizeName(person.name));
    if (matches.length !== 1) { unmatched.push(person.name); continue; }
    const e: Employee = matches[0], plan: PersonPlan = { employeeId: e.id, name: e.name, sheetName: person.name, overrides: [], leave: [], leaveDays: 0 };
    let patterns = e.patterns;
    const current = patternAt(patterns, sheet.start), currentDaily = Array.from({ length: 7 }, (_, d) => patternDailyMinutes(current, d));
    if (person.standardHours !== null) {
      const workdays = currentDaily.some(m => m > 0) ? [0, 1, 2, 3, 4, 5, 6].filter(d => currentDaily[d] > 0) : [1, 2, 3, 4, 5];
      const spreadDays = spread(toMinutes(person.standardHours), workdays.map(String)), daily = Object.fromEntries(Array.from({ length: 7 }, (_, d) => [String(d), spreadDays[String(d)] ?? 0]));
      if (Array.from({ length: 7 }, (_, d) => daily[String(d)] !== currentDaily[d]).some(Boolean)) {
        plan.standard = { from: current ? currentDaily.reduce((a, b) => a + b, 0) : null, to: toMinutes(person.standardHours), daily };
        patterns = [...patterns.filter(p => p.from !== sheet.start), { from: sheet.start, dailyMinutes: daily, schedule: {} }];
      }
    }
    const leave = new Set(person.leave.filter(d => d >= sheet.start && d <= sheet.end && !offDays.has(d)));
    sheet.weekStarts.forEach((week, i) => {
      const hours = person.weeks[i];
      if (hours === null || hours === undefined) return;
      const days = dates(week, dateAdd(week, 6)).filter(d => d >= sheet.start && d <= sheet.end), pattern = (d: string) => patternDailyMinutes(patternAt(patterns, d), dayOf(d));
      const working = days.some(d => pattern(d) > 0) ? days.filter(d => pattern(d) > 0) : days.filter(d => dayOf(d) >= 1 && dayOf(d) <= 5);
      const available = working.filter(d => !leave.has(d) && !offDays.has(d)), minutes = toMinutes(hours);
      if (!available.length) { if (minutes > 0) notes.push({ message: '{name}: week of {date} has {hours} h but every working day is leave or a holiday.', values: { name: e.name, date: week, hours } }); return; }
      const share = spread(minutes, available), cap = (d: string) => Math.max(pattern(d), Math.ceil(minutes / working.length / 15) * 15);
      const capped = available.reduce((sum, d) => sum + Math.min(share[d], cap(d)), 0);
      if (capped < minutes && working.some(d => leave.has(d))) notes.push({ message: '{name}: week of {date} lists {hours} h, more than fits around leave and holidays; {capped} h will be planned.', values: { name: e.name, date: week, hours, capped: capped / 60 } });
      for (const d of working) {
        if (known.has(d) || leave.has(d)) continue;
        const value = Math.min(1440, share[d] === undefined ? 0 : Math.min(share[d], cap(d))), existing = state.overrides.find(o => o.employeeId === e.id && o.date === d);
        if (value !== pattern(d) || existing) plan.overrides.push({ date: d, minutes: value });
      }
    });
    // Leave days become full-day absences; runs separated only by weekends or holidays are joined.
    const sorted = [...leave].sort();
    for (const d of sorted) {
      const last = plan.leave.at(-1), gap = last ? dates(dateAdd(last.end, 1), dateAdd(d, -1)) : [];
      if (last && gap.length < 7 && gap.every(g => offDays.has(g) || patternDailyMinutes(patternAt(patterns, g), dayOf(g)) === 0)) last.end = d;
      else plan.leave.push({ start: d, end: d });
    }
    plan.leaveDays = sorted.length;
    if (plan.standard || plan.overrides.length || plan.leave.length) plans.push(plan);
  }
  return { people: plans, unmatched, notes };
}

// Replaces this range's earlier spreadsheet entries for the matched people; manual entries stay unless the sheet sets that day's hours.
// The plan is made before old entries are removed, so importing the same file again gives the same result.
export function applySheetImport(state: State, sheet: ParsedSheet) {
  const names = new Set(sheet.people.map(p => normalizeName(p.name))), matched = new Set(state.employees.filter(e => !e.archived && names.has(normalizeName(e.name))).map(e => e.id));
  const plan = planSheetImport(state, sheet);
  state.overrides = state.overrides.filter(o => !(matched.has(o.employeeId) && isSheetEntry(o) && o.date >= sheet.start && o.date <= sheet.end));
  state.absences = state.absences.filter(a => !(matched.has(a.employeeId) && isSheetEntry(a) && a.start >= sheet.start && a.end <= sheet.end));
  for (const p of plan.people) {
    const e = state.employees.find(v => v.id === p.employeeId)!;
    if (p.standard) e.patterns = [...e.patterns.filter(x => x.from !== sheet.start), { from: sheet.start, dailyMinutes: p.standard.daily, schedule: Object.fromEntries(Object.entries(p.standard.daily).map(([d, m]) => [d, m ? [[0, m]] : []])) }];
    for (const o of p.overrides) {
      state.overrides = state.overrides.filter(x => !(x.employeeId === e.id && x.date === o.date));
      state.overrides.push({ id: crypto.randomUUID(), employeeId: e.id, date: o.date, windows: [], minutes: o.minutes, holidayWork: false, source: 'sheet' });
    }
    for (const l of p.leave) state.absences.push({ id: crypto.randomUUID(), employeeId: e.id, start: l.start, end: l.end, windows: [], minutesPerDay: 0, fullDay: true, category: 'Leave', source: 'sheet' });
  }
  return plan;
}
