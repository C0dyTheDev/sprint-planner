import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initialState,dailySchedule,report,rangeReport,workWindows,duration,type State,type Member} from '../lib/planner';
import {applyCommand} from '../lib/actions';
import {czechHolidays} from '../lib/holidays';
import {readXlsx} from '../lib/xlsx';
import {parseCapacityWorkbook,planSheetImport} from '../lib/sheet-import';
const owner:Member={id:'owner',email:'owner@example.com',name:'Owner',role:'admin'};
let checks=0;const test=(label:string,run:()=>void)=>{run();checks++;console.log('✓ '+label);};
const parsed=parseCapacityWorkbook(await readXlsx(new Uint8Array(readFileSync('tests/fixtures/capacity-sample.xlsx'))));
function planner():State{const s=initialState(owner);s.allocations=[];s.absences=[];s.holidays=czechHolidays(2026).map((h,i)=>({...h,id:'h'+i}));s.sprints=[{id:'s1',name:'November',start:'2026-11-09',status:'draft'}];
 s.employees=['Jana Nováková','Petr Dvořák','Eva Svobodová'].map((name,i)=>({...s.employees[0],id:'e'+i,name,patterns:[{from:'2020-01-01',schedule:{},dailyMinutes:dailySchedule()}]}));return s;}
const minutes=(s:State,id:string,date:string)=>duration(workWindows(s.employees.find(e=>e.id===id)!,date,s).available);
const sheet=(s:State)=>applyCommand(s,{action:'sheet.import',payload:parsed},owner);

test('workbook reader finds the quarter, weeks, holidays and every coloured leave day',()=>{
 assert.deepEqual([parsed.label,parsed.start,parsed.end,parsed.weekStarts.length],['Q4 2026','2026-09-28','2026-12-31',13]);assert.deepEqual(parsed.holidays,['2026-10-28','2026-11-17','2026-12-24','2026-12-25']);
 const jana=parsed.people.find(p=>p.name==='Nováková Jana')!;assert.deepEqual(jana.leave,['2026-10-07','2026-10-08','2026-11-16','2026-12-29']);assert.equal(jana.weeks[7],40);
 assert.equal(parsed.people.find(p=>p.name==='Dvořák Petr')!.standardHours,40);assert.deepEqual(parsed.people.find(p=>p.name==='Svobodová Eva')!.leave,['2026-12-01']);assert.deepEqual(parsed.people.find(p=>p.name==='Svoboda Karel')!.leave,['2026-10-05']);
});
test('preview matches people by name in either order and lists the rest',()=>{
 const plan=planSheetImport(planner(),parsed);assert.deepEqual(plan.unmatched,['Svoboda Karel']);assert.deepEqual(plan.people.map(p=>p.name).sort(),['Eva Svobodová','Jana Nováková','Petr Dvořák']);
 const eva=plan.people.find(p=>p.name==='Eva Svobodová')!;assert.deepEqual([eva.standard!.from,eva.standard!.to],[2400,1920]);assert(plan.notes.some(n=>n.values?.name==='Jana Nováková'&&n.values?.capped===24));
});
test('import sets leave, spreads net weekly hours and caps weeks that do not fit',()=>{
 const s=sheet(planner());assert.deepEqual(s.absences.filter(a=>a.employeeId==='e1').map(a=>[a.start,a.end,a.fullDay,a.source]),[['2026-11-09','2026-11-13',true,'sheet']]);
 assert.deepEqual(s.absences.filter(a=>a.employeeId==='e0').map(a=>[a.start,a.end]),[['2026-10-07','2026-10-08'],['2026-11-16','2026-11-16'],['2026-12-29','2026-12-29']]);
 assert.equal(rangeReport(s,'2026-11-16','2026-11-22').people.find(p=>p.employee.id==='e0')!.capacity,1440);assert.equal(report(s,'s1').people.find(p=>p.employee.id==='e1')!.cells.slice(0,5).every(c=>c.capacity===0),true);
 assert.equal(minutes(s,'e2','2026-11-02'),390);assert.equal(minutes(s,'e2','2026-11-06'),375);assert.equal(rangeReport(s,'2026-11-02','2026-11-08').people.find(p=>p.employee.id==='e2')!.capacity,1920);
});
test('re-importing replaces earlier imported entries and keeps manual ones',()=>{
 let s=planner();s=applyCommand(s,{action:'absence.save',payload:{id:'',employeeId:'e0',start:'2026-11-25',end:'2026-11-25',minutesPerDay:120,fullDay:false,category:'Doctor'}},owner);
 s=applyCommand(s,{action:'override.save',payload:{employeeId:'e2',date:'2026-11-03',minutes:60,holidayWork:false}},owner);s=applyCommand(s,{action:'override.save',payload:{employeeId:'e0',date:'2026-11-03',minutes:60,holidayWork:false}},owner);
 s=sheet(s);const once={absences:s.absences.length,overrides:s.overrides.length};s=sheet(s);assert.deepEqual({absences:s.absences.length,overrides:s.overrides.length},once);
 assert(s.absences.some(a=>a.category==='Doctor'&&!a.source));assert.equal(minutes(s,'e2','2026-11-03'),390);assert.equal(minutes(s,'e0','2026-11-03'),60);
});
test('spreadsheet import validates its payload and respects roles',()=>{
 assert.throws(()=>applyCommand(planner(),{action:'sheet.import',payload:parsed},{...owner,role:'viewer'}),/read-only/);assert.throws(()=>applyCommand(planner(),{action:'sheet.import',payload:{...parsed,people:[{...parsed.people[0],weeks:[500]}]}},owner));
 const nobody=planner();nobody.employees=[];assert.throws(()=>applyCommand(nobody,{action:'sheet.import',payload:parsed},owner),/Nothing to import/);
});
console.log(`${checks} spreadsheet import checks passed`);
