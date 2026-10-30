import assert from 'node:assert/strict';
import {quarterRange,filterAwards,type RecognitionFilter} from '../lib/recognition';
import {initialState,type Award} from '../lib/planner';
import {applySetups,POINT_CATEGORIES} from '../lib/setups';
import {createWorkspace} from '../lib/bootstrap';
import {applyCommand} from '../lib/actions';
assert.deepEqual(quarterRange(2026,1),{from:'2026-01-01',through:'2026-03-31'});assert.deepEqual(quarterRange(2024,1),{from:'2024-01-01',through:'2024-03-31'});
const filter:RecognitionFilter={personId:'a',period:'quarter',year:2026,quarter:1,from:'',through:''};
const awards=[{id:'first',employeeId:'a',date:'2026-01-01'},{id:'last',employeeId:'a',date:'2026-03-31'},{id:'after',employeeId:'a',date:'2026-04-01'},{id:'other',employeeId:'b',date:'2026-02-01'}] as Award[];
const sprint=initialState({id:'owner',email:'owner@example.com',name:'Owner',role:'admin'}).sprints[0];assert.deepEqual(filterAwards(awards,filter,sprint).map(a=>a.id),['last','first']);assert.equal(filterAwards(awards,{...filter,period:'all'},sprint).length,3);assert.equal(filterAwards(awards,{...filter,year:0},sprint).length,0);console.log('✓ Person and quarter/year recognition filtering preserves inclusive boundaries');
{const owner={id:'owner',email:'owner@example.com',name:'Owner',role:'admin' as const};const s=initialState(owner);const before=[...s.settings.awardCategories];delete s.appliedSetups;
assert.equal(applySetups(s),true);assert.deepEqual(s.settings.awardCategories,[...before,...POINT_CATEGORIES]);assert.equal(s.audit[0].detail,'Award categories added');assert.equal(applySetups(s),false);assert.equal(s.settings.awardCategories.length,before.length+9);
const custom=initialState(owner);custom.settings.awardCategories=['Own',POINT_CATEGORIES[0]];applySetups(custom);assert.deepEqual(custom.settings.awardCategories,['Own',...POINT_CATEGORIES]);
const fresh=createWorkspace(owner);assert(POINT_CATEGORIES.every(c=>fresh.settings.awardCategories.includes(c)));assert.equal(applySetups(fresh),false);assert.equal(fresh.audit.length,0);
const removed=applyCommand(fresh,{action:'settings.save',payload:{...fresh.settings,awardCategories:['Own']}},owner);assert.equal(applySetups(removed),false);assert.deepEqual(removed.settings.awardCategories,['Own']);
const awarded=applyCommand(s,{action:'award.add',payload:{employeeId:'person-0',points:1,category:POINT_CATEGORIES[5],basis:'qualitative',reason:'Fixed the build at night',evidence:'',metric:'',before:'',after:'',unit:'',date:'2026-10-30',sprintId:''}},owner);assert.equal(awarded.awards.at(-1)!.category,POINT_CATEGORIES[5]);
console.log('✓ Point categories are added once, kept when edited, and usable for awards');}
