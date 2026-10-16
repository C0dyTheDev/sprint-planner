import nextEnv from '@next/env';
const {loadEnvConfig}=nextEnv;
import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
loadEnvConfig(process.cwd());
const filename=process.argv[2];
if(!filename||process.argv.length!==3)throw new Error('Usage: pnpm db:import /secure/path/sprint-overview-backup.json');
const email=process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
if(!email||!email.includes('@'))throw new Error('Set BOOTSTRAP_ADMIN_EMAIL to the administrator sign-in email');
if(!process.env.TURSO_DATABASE_URL)throw new Error('Set TURSO_DATABASE_URL');
const backup=JSON.parse(await readFile(filename,'utf8'));
const state=backup.state;
if(!state||state.version!==1||!Number.isSafeInteger(backup.revision)||backup.revision<0)throw new Error('Unsupported or invalid backup');
for(const key of ['employees','teams','projects','sprints','allocations','absences','overrides','holidays','awards','members','audit']){
 if(!Array.isArray(state[key]))throw new Error('Invalid backup collection: '+key);
 if(state[key].some(item=>!item||typeof item.id!=='string'))throw new Error('Invalid records in '+key);
}
if(!state.sprints.length||!state.settings?.timezone||!Array.isArray(state.settings.awardCategories))throw new Error('Backup is missing required planning settings');
if(state.members.some(m=>typeof m.email!=='string'||!['admin','scrum','viewer'].includes(m.role)))throw new Error('Invalid workspace membership');
if(state.employees.length>300||state.allocations.length>15000||state.sprints.length>200)throw new Error('Backup exceeds the supported workspace size');
const existing=state.members.find(m=>m.email.toLowerCase()===email);
if(existing)existing.role='admin';else state.members.push({id:randomUUID(),name:'Workspace administrator',email,role:'admin'});
state.audit.unshift({id:randomUUID(),at:new Date().toISOString(),actor:'Workspace import',action:'workspace.import',detail:'Imported planning backup',reason:'Migrated to the Vercel deployment.'});
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try{
 await db.executeMultiple(await readFile(new URL('../db/schema.sql',import.meta.url),'utf8'));
 const result=await db.execute({sql:'INSERT OR IGNORE INTO workspaces (id,revision,data,updated_at) VALUES (?,?,?,?)',args:['main',backup.revision,JSON.stringify(state),new Date().toISOString()]});
 if(result.rowsAffected!==1)throw new Error('Import refused: this database already has a workspace. Use a fresh database; existing data was not changed.');
 console.log(`Imported ${state.employees.length} employee records, ${state.sprints.length} sprints, and ${state.allocations.length} allocations. Administrator email configured.`);
}finally{db.close();}
