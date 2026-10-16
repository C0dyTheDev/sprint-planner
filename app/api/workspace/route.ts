import { getCurrentUser } from '@/lib/session';
import { readWorkspace, initializeWorkspace, saveWorkspace } from '@/lib/workspace-store';
import { isBootstrapAdmin } from '@/lib/bootstrap';
import { report, type State, type Member } from '@/lib/planner';
import { applyCommand, DomainError } from '@/lib/actions';
import { removePassword } from '@/lib/credentials';
import { z } from 'zod';
import {translate,translateMessage,formatHours,type Language} from '@/lib/i18n';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function context(){
 const user=await getCurrentUser();if(!user)throw new DomainError('Sign in to access Sprint Overview.',401);
 let saved=await readWorkspace();
 if(!saved){if(!isBootstrapAdmin(user.email))throw new DomainError('Your account has not been granted access to this planner.',403);const owner:Member={id:user.userId,email:user.email,name:user.fullName??user.email,role:'admin'};saved=await initializeWorkspace(owner);}
 if(!saved)throw new DomainError('Unable to load workspace.',503);
 const member=saved.state.members.find(m=>m.email.toLowerCase()===user.email.toLowerCase());
 if(!member)throw new DomainError('Your account has not been granted access to this planner.',403);
 return {...saved,member};
}
function present(state:State,member:Member){return member.role==='viewer'?{...state,awards:[],audit:[],members:[]}:member.role==='scrum'?{...state,members:[]}:state;}
function fail(e:unknown){if(e instanceof DomainError)return json({error:e.message},e.status);if(e instanceof z.ZodError)return json({error:e.issues.map(i=>i.message).slice(0,3).join('. ')},400);console.error('Workspace operation failed',e instanceof Error?e.message:'Unknown error');return json({error:'Unable to save or load your plan. Your form has been kept; please try again.'},503);}
export async function GET(request:Request){try{const c=await context();const q=new URL(request.url).searchParams;const language:Language=q.get('lang')==='cs'?'cs':'en';
 if(q.get('export')==='backup'){if(c.member.role!=='admin')throw new DomainError('Administrator access required',403);return new Response(JSON.stringify({revision:c.revision,state:c.state},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="sprint-overview-backup.json"','Cache-Control':'no-store'}});}
 if(q.get('export')==='csv'){const sid=q.get('sprint')??c.state.sprints[0].id;const r=report(c.state,sid);const escape=(value:unknown)=>{let v=String(value??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};const rows=[['Employee','Discipline','Date','Available hours','Allocated hours','Remaining hours','Assignments','Conflicts'].map(label=>translate(language,label)),...r.people.flatMap(p=>p.cells.map(c=>[p.employee.name,translate(language,p.employee.discipline),c.date,formatHours(c.capacity,language),formatHours(c.allocated,language),formatHours(c.capacity-c.allocated,language),c.allocations.map(a=>a.label).join('; '),c.conflicts.map(value=>translateMessage(language,value)).join('; ')]))];return new Response('\uFEFF'+rows.map(row=>row.map(escape).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="sprint-capacity.csv"','Cache-Control':'no-store'}});}
 return json({state:present(c.state,c.member),revision:c.revision,member:c.member,reports:Object.fromEntries(c.state.sprints.map(s=>[s.id,report(c.state,s.id)]))});
 }catch(e){return fail(e);}}
export async function POST(request:Request){try{const origin=request.headers.get('origin');const expected=new URL(request.url).origin;if(!origin||(origin!==expected&&origin!==new URL(process.env.AUTH_URL??request.url).origin))throw new DomainError('This request must come from the planner.',403);const c=await context();const body=z.object({revision:z.number().int().min(0),action:z.string().max(100),payload:z.unknown(),reason:z.string().max(1000).optional()}).strict().parse(await request.json());if(body.revision!==c.revision)throw new DomainError('Another manager updated the planner. Refresh and review your changes before saving.',409);
 const state=applyCommand(c.state,{action:body.action,payload:body.payload,reason:body.reason},c.member);const saved=await saveWorkspace(state,body.revision);if(!saved)throw new DomainError('Another manager saved first. Refresh and review your changes before saving.',409);for(const gone of c.state.members.filter(m=>!state.members.some(n=>n.id===m.id)))await removePassword(gone.email);return json({state:present(state,c.member),revision:c.revision+1,member:c.member,reports:Object.fromEntries(state.sprints.map(s=>[s.id,report(state,s.id)]))});
 }catch(e){return fail(e);}}
