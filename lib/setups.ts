import type { State } from './planner';

// Categories for 1-point awards, written as "Group / Category" so the form can group them.
export const POINT_CATEGORIES = [
  'Kvalita / Realistické interakce',
  'Kvalita / Audio, které dodává imerzivní pocit',
  'Kvalita / Vizuál, který dodává imerzivní pocit',
  'Kvalita / Jeho práce prošla review bez zásadních připomínek',
  'Efektivita / Vzal si práci navíc a jeho naplánovaná práce byla schválena k odevzdání',
  'Snaha / Řešení akutního problému mimo svoji pracovní dobu a daný problém nebyl odchycen testerem a product ownerem (pokud si problém způsobí sám, jeho chyba)',
  'Snaha / Navrhl a vytvořil užitečný nástroj, který rozšířil mezi lidi',
  'Snaha / Ušetřil čas svým kreativním nápadem',
  'Snaha / Naučil se novou oblast nebo nástroj a použil ho v projektu',
];

// One-time, additive workspace updates. Each runs once per workspace and is recorded in appliedSetups.
const SETUPS: { id: string; detail: string; apply: (state: State) => void }[] = [
  { id: 'award-categories-2026-10', detail: 'Award categories added', apply: state => {
    state.settings.awardCategories = [...state.settings.awardCategories, ...POINT_CATEGORIES.filter(c => !state.settings.awardCategories.includes(c))];
  } },
];

export function applySetups(state: State, audit = true) {
  let changed = false;
  for (const setup of SETUPS) {
    if (state.appliedSetups?.includes(setup.id)) continue;
    setup.apply(state);
    state.appliedSetups = [...(state.appliedSetups ?? []), setup.id];
    if (audit) state.audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), actor: 'System', action: 'settings.save', detail: setup.detail, reason: '' });
    changed = true;
  }
  return changed;
}
