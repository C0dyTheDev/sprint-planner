import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// Each bundled test imports an isolated database singleton.
const folder=await mkdtemp(join(tmpdir(),'sprint-auth-'));
process.env.TURSO_DATABASE_URL='file:'+join(folder,'auth.db');process.env.BOOTSTRAP_ADMIN_EMAIL='owner@example.com';process.env.BOOTSTRAP_ADMIN_PASSWORD='deployment-secret';
const {getDatabase}=await import('../lib/database');const db=await getDatabase();
const {canSignIn,authorizeCredentials}=await import('../lib/auth-policy');
const {setPassword,removePassword,hashPassword,verifyHash,passwordProblem}=await import('../lib/credentials');
const {initializeWorkspace,saveWorkspace,readWorkspace}=await import('../lib/workspace-store');
const login=(email:string,password:string)=>authorizeCredentials({email,password});
try{
 const stored=await hashPassword('correct horse');assert.equal(await verifyHash('correct horse',stored),true);assert.equal(await verifyHash('wrong horse',stored),false);assert.notEqual(stored,await hashPassword('correct horse'));
 assert.equal(passwordProblem('short'),'Password must be at least 10 characters.');assert.equal(passwordProblem('long enough'),null);
 assert.equal(await canSignIn('owner@example.com'),true);assert.equal(await canSignIn('stranger@example.com'),false);
 assert.equal(await login('owner@example.com','wrong-password'),null);
 assert.equal((await login(' OWNER@example.com ','deployment-secret'))?.email,'owner@example.com');
 assert.equal(await login('stranger@example.com','deployment-secret'),null);
 await setPassword('stranger@example.com','stranger-password');assert.equal(await login('stranger@example.com','stranger-password'),null,'a password alone does not grant access');
 await initializeWorkspace({id:'owner',email:'owner@example.com',name:'Owner',role:'admin'});
 assert.equal(await canSignIn('stranger@example.com'),false);
 const saved=(await readWorkspace())!;saved.state.members.push({id:'member',email:'member@example.com',name:'Member',role:'scrum'});await saveWorkspace(saved.state,saved.revision);assert.equal(await canSignIn('MEMBER@example.com'),true);
 assert.equal(await login('member@example.com','deployment-secret'),null,'the deployment password only applies to the bootstrap administrator');
 await setPassword('member@example.com','member-password');assert.equal((await login('Member@example.com','member-password'))?.email,'member@example.com');
 await setPassword('owner@example.com','changed-owner-password');assert.equal(await login('owner@example.com','deployment-secret'),null,'the deployment password stops working once changed');assert.ok(await login('owner@example.com','changed-owner-password'));
 for(let i=0;i<5;i++)assert.equal(await login('member@example.com','wrong-password'),null);
 assert.equal(await login('member@example.com','member-password'),null,'repeated failures lock the account temporarily');
 await db.execute("UPDATE credentials SET locked_until = '2000-01-01T00:00:00.000Z' WHERE email = 'member@example.com'");assert.ok(await login('member@example.com','member-password'));
 await removePassword('member@example.com');assert.equal(await login('member@example.com','member-password'),null);
 const rows=(await db.execute('SELECT password_hash FROM credentials')).rows;assert(rows.every(row=>String(row.password_hash).startsWith('scrypt$')));assert(!String((await readWorkspace())!.state.members.map(m=>JSON.stringify(m))).includes('scrypt'));
 console.log('✓ Email and password sign-in: hashed storage, bootstrap password, membership admission, lockout and password removal');
}finally{db.close();await rm(folder,{recursive:true,force:true});}
