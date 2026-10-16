import { getDatabase } from './database';
import { createWorkspace } from './bootstrap';
import type { Member, State } from './planner';

export type SavedWorkspace = { revision: number; state: State };

export async function readWorkspace(): Promise<SavedWorkspace | null> {
  const result = await (await getDatabase()).execute({ sql: 'SELECT revision, data FROM workspaces WHERE id = ?', args: ['main'] });
  const row = result.rows[0];
  return row ? { revision: Number(row.revision), state: JSON.parse(String(row.data)) as State } : null;
}

export async function initializeWorkspace(owner: Member) {
  await (await getDatabase()).execute({
    sql: 'INSERT OR IGNORE INTO workspaces (id, revision, data, updated_at) VALUES (?, ?, ?, ?)',
    args: ['main', 0, JSON.stringify(createWorkspace(owner)), new Date().toISOString()],
  });
  return readWorkspace();
}

export async function saveWorkspace(state: State, expectedRevision: number): Promise<boolean> {
  // A single conditional statement coordinates all concurrent Vercel instances.
  const result = await (await getDatabase()).execute({
    sql: 'UPDATE workspaces SET data = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ?',
    args: [JSON.stringify(state), new Date().toISOString(), 'main', expectedRevision],
  });
  return result.rowsAffected === 1;
}
