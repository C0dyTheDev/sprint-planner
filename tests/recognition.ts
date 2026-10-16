import assert from 'node:assert/strict';
import {quarterRange,filterAwards,type RecognitionFilter} from '../lib/recognition';
import {initialState,type Award} from '../lib/planner';
assert.deepEqual(quarterRange(2026,1),{from:'2026-01-01',through:'2026-03-31'});assert.deepEqual(quarterRange(2024,1),{from:'2024-01-01',through:'2024-03-31'});
const filter:RecognitionFilter={personId:'a',period:'quarter',year:2026,quarter:1,from:'',through:''};
const awards=[{id:'first',employeeId:'a',date:'2026-01-01'},{id:'last',employeeId:'a',date:'2026-03-31'},{id:'after',employeeId:'a',date:'2026-04-01'},{id:'other',employeeId:'b',date:'2026-02-01'}] as Award[];
const sprint=initialState({id:'owner',email:'owner@example.com',name:'Owner',role:'admin'}).sprints[0];assert.deepEqual(filterAwards(awards,filter,sprint).map(a=>a.id),['last','first']);assert.equal(filterAwards(awards,{...filter,period:'all'},sprint).length,3);assert.equal(filterAwards(awards,{...filter,year:0},sprint).length,0);console.log('✓ Person and quarter/year recognition filtering preserves inclusive boundaries');
