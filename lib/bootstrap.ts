import { initialState, dateAdd, dateDiff, today, type Member, type State } from './planner';
import { applySetups } from './setups';

export function isBootstrapAdmin(email: string) {
  const expected = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(expected && email.trim().toLowerCase() === expected);
}

export function createWorkspace(owner: Member): State {
  const state = initialState(owner);
  // Public source contains no imported employee roster or live planning data.
  state.employees = [];
  state.allocations = [];
  state.absences = [];
  state.overrides = [];
  state.holidays = [];
  state.awards = [];
  state.projects = [];
  state.audit = [];
  state.teams = [
    ['VR Rescue', '#507fde'], ['VR Prevent', '#9a73ca'], ['VR School', '#e4a853'],
    ['VR Medical', '#39a69e'], ['VR Training', '#6aa76b'], ['XRA', '#d78091'],
  ].map(([name, color], index) => ({ id: `team-${index + 1}`, name, color, archived: false }));
  // Retain the requested two-week cadence, including after October 2026.
  const anchor = '2026-10-19';
  const current = dateAdd(anchor, Math.floor(dateDiff(anchor, today(state.settings.timezone)) / 14) * 14);
  state.sprints = [
    { id: 'sprint-current', name: 'Current sprint', start: current, status: 'draft' },
    { id: 'sprint-next', name: 'Next sprint', start: dateAdd(current, 14), status: 'draft' },
  ];
  applySetups(state, false);
  return state;
}
