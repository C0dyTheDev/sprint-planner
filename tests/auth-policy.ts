import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Each bundled test imports an isolated database singleton.
const folder=await mkdtemp(join(tmpdir(),'sprint-auth-'));
process.env.TURSO_DATABASE_URL='file:'+join(folder,'auth.db');process.env.BOOTSTRAP_ADMIN_EMAIL='owner@example.com';
const {getDatabase}=await import('../lib/database');const db=getDatabase();await db.execute(await readFile('db/schema.sql','utf8'));
const {canSignIn,hasVerifiedGitHubEmail}=await import('../lib/auth-policy');
const {initializeWorkspace,saveWorkspace,readWorkspace}=await import('../lib/workspace-store');
try{
 assert.equal(await canSignIn('owner@example.com'),true);assert.equal(await canSignIn('stranger@example.com'),false);
 await initializeWorkspace({id:'owner',email:'owner@example.com',name:'Owner',role:'admin'});
 assert.equal(await canSignIn('stranger@example.com'),false);
 const saved=(await readWorkspace())!;saved.state.members.push({id:'member',email:'member@example.com',name:'Member',role:'scrum'});await saveWorkspace(saved.state,saved.revision);assert.equal(await canSignIn('MEMBER@example.com'),true);
 const oldFetch=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json([{email:'member@example.com',verified:false}]);assert.equal(await hasVerifiedGitHubEmail('member@example.com','test-token'),false);globalThis.fetch=async()=>Response.json([{email:'member@example.com',verified:true}]);assert.equal(await hasVerifiedGitHubEmail('MEMBER@example.com','test-token'),true);assert.equal(await hasVerifiedGitHubEmail('someone@example.com','test-token'),false);}finally{globalThis.fetch=oldFetch;}
 console.log('✓ Sign-in rejects unknown users and unverified GitHub email addresses; workspace roles control admission');
}finally{db.close();await rm(folder,{recursive:true,force:true});}
