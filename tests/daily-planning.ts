import assert from 'node:assert/strict';
import {initialState,report,rangeReport,mondayOf,isoWeek,sprintOnDate,dateAdd,workWindows,duration,dailySchedule,allocationMinutes,type State,type Member} from '../lib/planner';
import {applyCommand} from '../lib/actions';
import {standardWeeklyMinutes,findFreePeople} from '../lib/roster';
import {czechHolidays,easterSunday} from '../lib/holidays';
const owner:Member={id:'owner',email:'owner@example.com',name:'Owner',role:'admin'};
let checks=0;const test=(label:string,run:()=>void)=>{run();checks++;console.log('✓ '+label);};
function clean(){const s=initialState(owner);s.allocations=[];s.absences=[];s.employees=s.employees.slice(0,1);s.sprints=[{id:'s1',name:'October A',start:'2026-10-12',status:'draft'},{id:'s2',name:'October B',start:'2026-10-26',status:'draft'}];return s;}
function booking(props:Record<string,unknown>={}){return {id:'',employeeId:'person-0',teamId:'platform',projectId:'core',category:'project',label:'Daily work',start:'2026-10-19',end:'2026-10-30',minutesPerDay:240,weekdays:[1,2,3,4,5],issueUrl:'',...props};}
function save(s:State,p=booking(),reason=''){return applyCommand(s,{action:'allocation.save',payload:p,reason},owner);}
const active=(s:State,id:string)=>applyCommand(s,{action:'sprint.activate',payload:{id}},owner);

test('Monday windows and ISO weeks handle Sundays and year boundaries',()=>{
 assert.equal(mondayOf('2026-10-18'),'2026-10-12');assert.equal(mondayOf('2026-10-19'),'2026-10-19');assert.equal(mondayOf('2027-01-01'),'2026-12-28');assert.deepEqual(isoWeek('2027-01-01'),{year:2026,week:53});assert.deepEqual(isoWeek('2027-01-04'),{year:2027,week:1});
});
test('one daily booking splits correctly across sprint boundaries',()=>{
 const s=save(clean());assert.equal(s.allocations.length,2);assert.deepEqual(s.allocations.map(a=>[a.sprintId,a.start,a.end,a.minutesPerDay]),[['s1','2026-10-19','2026-10-23',240],['s2','2026-10-26','2026-10-30',240]]);assert(s.allocations.every(a=>a.windows.length===0));
 const r=rangeReport(s,'2026-10-19','2026-11-01');assert.equal(r.allocated,2400);assert.equal(r.capacity,4800);assert.equal(r.conflictDays,0);assert.equal(r.people[0].cells[7].sprintId,'s2');
});
test('focus totals exclude context weeks; gaps retain capacity but no allocations',()=>{
 let s=save(clean(),booking({start:'2026-10-12',end:'2026-10-30',minutesPerDay:60}));const focused=rangeReport(s,'2026-10-19','2026-11-01'),context=rangeReport(s,'2026-10-12','2026-11-08');assert.equal(focused.allocated,600);assert.equal(context.allocated,900);assert.equal(focused.capacity,4800);assert.equal(context.capacity,9600);const gap=rangeReport(s,'2026-11-09','2026-11-15');assert.equal(gap.people[0].cells[0].sprintId,undefined);assert.equal(gap.capacity,2400);assert.equal(gap.allocated,0);assert.equal(context.people[0].cells[21].capacity,480);assert.equal(context.people[0].cells[21].allocated,0);
 assert.equal(sprintOnDate(s,'2026-10-25')!.id,'s1');assert.equal(sprintOnDate(s,'2026-10-26')!.id,'s2');assert.equal(sprintOnDate(s,'2026-11-09'),undefined);
});
test('daily work shared across teams reaches capacity without clock overlap conflicts',()=>{
 let s=save(clean(),booking({start:'2026-10-12',end:'2026-10-12',minutesPerDay:300}));s=save(s,booking({start:'2026-10-12',end:'2026-10-12',minutesPerDay:180,teamId:'vr',projectId:'rehab'}));assert.equal(report(s,'s1').conflictDays,0);s=save(s,booking({start:'2026-10-12',end:'2026-10-12',minutesPerDay:15,category:'internal'}));assert.deepEqual(report(s,'s1').people[0].cells[0].conflicts,['0.25 h over capacity']);assert.equal(report(s,'s1').internal,15);
});
test('cross-sprint moves retain identity and remove the old booking',()=>{
 let s=save(clean(),booking({start:'2026-10-12',end:'2026-10-16'}));const a=s.allocations[0];const {windows,...fields}=a;s=save(s,booking({...fields,start:'2026-10-26',end:'2026-10-30'}));assert.equal(s.allocations.length,1);assert.equal(s.allocations[0].id,a.id);assert.equal(s.allocations[0].sprintId,'s2');assert.equal(report(s,'s1').allocated,0);assert.equal(report(s,'s2').allocated,1200);
});
test('missing, closed, invalid, or uncovered dates cannot partially save a multi-sprint plan',()=>{
 const s=clean();assert.throws(()=>save(s,booking({end:'2026-11-13'})),/Create a sprint/);assert.equal(s.allocations.length,0);
 const closed=applyCommand(active(s,'s2'),{action:'sprint.close',payload:{id:'s2'}},owner);assert.throws(()=>save(closed),/Closed sprints/);assert.equal(closed.allocations.length,0);
 assert.throws(()=>save(s,booking({start:'2026-02-30'})));assert.throws(()=>save(s,booking({minutesPerDay:17})));assert.throws(()=>save(s,booking({minutesPerDay:0})));assert.throws(()=>save(s,booking({start:'2026-10-24',end:'2026-10-25'})),/No selected working day/);
});
test('active sprints require reasons and validate the entire multi-sprint write',()=>{
 let s=active(clean(),'s2');assert.throws(()=>save(s),/Add a reason/);s=save(s,booking(),'Plan upcoming work');assert.equal(report(s,'s2').allocated,1200);
 assert.throws(()=>save(s,booking({minutesPerDay:300}),'Additional work'),/daily capacity/);assert.equal(s.allocations.length,2);assert.equal(report(s,'s1').allocated,1200);
});
test('closed cells in a mixed window retain final capacity and bookings',()=>{
 let s=save(clean());s=applyCommand(active(s,'s1'),{action:'sprint.close',payload:{id:'s1'}},owner);s.employees[0].patterns=[{from:'2000-01-01',schedule:{},dailyMinutes:{...dailySchedule(),'1':120,'2':120,'3':120,'4':120,'5':120}}];const r=rangeReport(s,'2026-10-19','2026-11-01');assert.equal(r.people[0].cells[0].capacity,480);assert.equal(r.people[0].cells[7].capacity,120);assert.equal(r.allocated,2400);assert.equal(r.conflictDays,5);assert.equal(report(s,'s1').conflictDays,0);
});
test('an archived person visible in closed context does not inflate future capacity',()=>{
 let s=save(clean(),booking({start:'2026-10-12',end:'2026-10-16'}));s=applyCommand(active(s,'s1'),{action:'sprint.close',payload:{id:'s1'}},owner);s.employees[0].archived=true;const context=rangeReport(s,'2026-10-19','2026-11-15');assert.equal(context.people.length,1);assert.equal(context.people[0].cells[0].capacity,480);assert.equal(context.people[0].cells[7].capacity,0);assert.equal(rangeReport(s,'2026-10-26','2026-11-08').capacity,0);
});
test('daily employee capacity, overrides and partial leave deduct quantities without lunch',()=>{
 let s=clean();const e=s.employees[0];s=applyCommand(s,{action:'employee.save',payload:{id:e.id,name:e.name,discipline:'Developer',skills:e.skills,color:e.color,employmentStart:'',employmentEnd:'',effectiveFrom:'2026-10-12',dailyMinutes:dailySchedule()}},owner);
 assert.equal(standardWeeklyMinutes(s.employees[0],'2026-10-12'),2400);assert.equal(duration(workWindows(s.employees[0],'2026-10-12',s).available),480);
 s=applyCommand(s,{action:'absence.save',payload:{id:'',employeeId:e.id,start:'2026-10-12',end:'2026-10-12',minutesPerDay:120,fullDay:false,category:'Personal time'}},owner);assert.equal(report(s,'s1').people[0].cells[0].capacity,360);
 s=applyCommand(s,{action:'override.save',payload:{employeeId:e.id,date:'2026-10-12',minutes:420,holidayWork:false}},owner);assert.equal(report(s,'s1').people[0].cells[0].capacity,300);
 s=applyCommand(s,{action:'absence.save',payload:{id:'',employeeId:e.id,start:'2026-10-13',end:'2026-10-13',minutesPerDay:0,fullDay:true,category:'Leave'}},owner);assert.equal(report(s,'s1').people[0].cells[1].capacity,0);
});
test('legacy lunch-separated bookings preserve total daily effort',()=>{
 const s=clean();s.allocations=[{...booking({start:'2026-10-12',end:'2026-10-12'}),id:'old',sprintId:'s1',minutesPerDay:undefined,windows:[[540,720],[780,1080]]} as any];assert.equal(allocationMinutes(s.allocations[0]),480);assert.equal(report(s,'s1').people[0].cells[0].allocated,480);assert.equal(report(s,'s1').conflictDays,0);
});
test('multi-day bookings fit each day to that day\'s capacity; existing unflagged bookings still report overflow',()=>{
 let s=active(clean(),'s1');s=applyCommand(s,{action:'override.save',payload:{employeeId:'person-0',date:'2026-10-13',minutes:240,holidayWork:false}},owner);s=save(s,booking({start:'2026-10-12',end:'2026-10-14',minutesPerDay:480}),'Plan the week');const cells=report(s,'s1').people[0].cells;assert.deepEqual(cells.slice(0,3).map(c=>c.allocated),[480,240,480]);assert.equal(report(s,'s1').conflictDays,0);assert.equal(report(s,'s1').allocated,1200);
 assert.throws(()=>save(s,booking({start:'2026-10-13',end:'2026-10-13',minutesPerDay:60,category:'internal'}),'Meeting'),/daily capacity/);
 s=applyCommand(s,{action:'absence.save',payload:{id:'',employeeId:'person-0',start:'2026-10-14',end:'2026-10-14',minutesPerDay:0,fullDay:true,category:'Leave'}},owner);assert.equal(report(s,'s1').conflictDays,1);
 const legacy=clean();legacy.overrides=[{id:'o',employeeId:'person-0',date:'2026-10-13',windows:[],minutes:240,holidayWork:false}];legacy.allocations=[{...booking({start:'2026-10-12',end:'2026-10-14',minutesPerDay:480}),id:'old',sprintId:'s1',windows:[]} as any];assert.equal(report(legacy,'s1').conflictDays,1);
});
test('fitted days grow back automatically when capacity frees up, but never past free time',()=>{
 let s=applyCommand(clean(),{action:'override.save',payload:{employeeId:'person-0',date:'2026-10-13',minutes:240,holidayWork:false}},owner);s=save(s,booking({start:'2026-10-12',end:'2026-10-14',minutesPerDay:480}));s=save(s,booking({start:'2026-10-13',end:'2026-10-13',minutesPerDay:60,category:'internal'}));
 s=applyCommand(s,{action:'override.save',payload:{employeeId:'person-0',date:'2026-10-13',minutes:360,holidayWork:false}},owner);assert.equal(report(s,'s1').people[0].cells[1].allocated,360);assert.equal(report(s,'s1').conflictDays,0);
 s=applyCommand(s,{action:'override.remove',payload:{employeeId:'person-0',date:'2026-10-13'}},owner);const fitted=s.allocations.find(a=>a.minutesPerDay===480)!;assert.equal(allocationMinutes(fitted,'2026-10-13'),420);
 s=applyCommand(s,{action:'allocation.remove',payload:{id:s.allocations.find(a=>a.category==='internal')!.id}},owner);assert.equal(s.allocations[0].dayMinutes,undefined);assert.equal(report(s,'s1').allocated,1440);
});
test('Czech public holidays follow Easter and import only missing dates',()=>{
 assert.equal(easterSunday(2026),'2026-04-05');assert.equal(easterSunday(2027),'2027-03-28');const y=czechHolidays(2026);assert.equal(y.length,13);assert(y.some(h=>h.date==='2026-04-03'&&h.name==='Velký pátek'));assert(y.some(h=>h.date==='2026-04-06'));assert.equal(czechHolidays(2015).length,12);
 let s=clean();s.holidays=[{id:'own',date:'2026-12-24',name:'Company day'}];s=applyCommand(s,{action:'holiday.import',payload:{year:2026}},owner);assert.equal(s.holidays.length,13);assert.equal(s.holidays.find(h=>h.date==='2026-12-24')!.name,'Company day');assert.equal(report(s,'s2').people[0].cells[2].capacity,0);
 assert.throws(()=>applyCommand(s,{action:'holiday.import',payload:{year:2026}},owner),/already added/);assert.throws(()=>applyCommand(clean(),{action:'holiday.import',payload:{year:2026}},{...owner,role:'scrum'}),/Administrator/);
});
test('free-people finder ranks by days with enough free hours and filters by skill',()=>{
 const s=initialState(owner);s.allocations=[];s.absences=[];s.sprints=[{id:'s1',name:'A',start:'2026-10-12',status:'draft'}];let st=save(s,booking({start:'2026-10-12',end:'2026-10-14',minutesPerDay:360}));
 const q={start:'2026-10-12',end:'2026-10-16',weekdays:[1,2,3,4,5],minutesPerDay:240};const all=findFreePeople(st,q);const emma=all.find(r=>r.employee.id==='person-0')!;assert.deepEqual([emma.fitDays,emma.days,emma.freeMinutes],[2,5,1320]);assert.equal(all[0].fitDays,5);assert(all.findIndex(r=>r.employee.id==='person-0')>all.findIndex(r=>r.employee.id==='person-1'));
 assert.deepEqual(findFreePeople(st,{...q,skill:'Blender'}).map(r=>r.employee.id).sort(),['person-2','person-4']);assert.equal(findFreePeople(st,{...q,skill:'Blender'}).find(r=>r.employee.id==='person-2')!.fitDays,0);
});
test('public holidays count as zero planned hours, so bookings across them never conflict',()=>{
 let s=save(clean(),booking({start:'2026-10-26',end:'2026-10-30',minutesPerDay:480}));s.holidays=[{id:'h',date:'2026-10-28',name:'Den vzniku státu'}];let cell=report(s,'s2').people[0].cells[2];
 assert.deepEqual([cell.capacity,cell.allocated,cell.conflicts.length],[0,0,0]);assert.equal(report(s,'s2').conflictDays,0);assert.equal(report(s,'s2').people[0].allocated,1920);
 s=active(s,'s2');s=applyCommand(s,{action:'override.save',payload:{employeeId:'person-0',date:'2026-10-28',minutes:240,holidayWork:true}},owner);cell=report(s,'s2').people[0].cells[2];assert.deepEqual([cell.capacity,cell.allocated],[240,480]);assert.equal(cell.conflicts.length,1);
 const leave=applyCommand(save(clean(),booking({start:'2026-10-26',end:'2026-10-26',minutesPerDay:480})),{action:'absence.save',payload:{id:'',employeeId:'person-0',start:'2026-10-26',end:'2026-10-26',minutesPerDay:0,fullDay:true,category:'Leave'}},owner);assert.equal(report(leave,'s2').conflictDays,1);
});
console.log(`${checks} daily planning checks passed`);
