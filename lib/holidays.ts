import { dateAdd } from './planner';

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
export function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Public holidays under Czech law (zákon č. 245/2000 Sb.); Good Friday applies from 2016.
export function czechHolidays(year: number) {
  const easter = easterSunday(year), at = (md: string) => `${year}-${md}`;
  return [
    { date: at('01-01'), name: 'Den obnovy samostatného českého státu, Nový rok' },
    ...(year >= 2016 ? [{ date: dateAdd(easter, -2), name: 'Velký pátek' }] : []),
    { date: dateAdd(easter, 1), name: 'Velikonoční pondělí' },
    { date: at('05-01'), name: 'Svátek práce' },
    { date: at('05-08'), name: 'Den vítězství' },
    { date: at('07-05'), name: 'Den slovanských věrozvěstů Cyrila a Metoděje' },
    { date: at('07-06'), name: 'Den upálení mistra Jana Husa' },
    { date: at('09-28'), name: 'Den české státnosti' },
    { date: at('10-28'), name: 'Den vzniku samostatného československého státu' },
    { date: at('11-17'), name: 'Den boje za svobodu a demokracii' },
    { date: at('12-24'), name: 'Štědrý den' },
    { date: at('12-25'), name: '1. svátek vánoční' },
    { date: at('12-26'), name: '2. svátek vánoční' },
  ];
}
