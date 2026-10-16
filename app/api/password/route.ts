import { getCurrentUser } from '@/lib/session';
import { readWorkspace } from '@/lib/workspace-store';
import { passwordProblem, setPassword, verifyPassword, PASSWORD_MAX_LENGTH } from '@/lib/credentials';
import { z } from 'zod';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
// Administrators set a member's password by email; everyone else changes their own with the current password.
const body=z.union([
 z.object({email:z.string().trim().toLowerCase().email().max(200),password:z.string().max(PASSWORD_MAX_LENGTH)}).strict(),
 z.object({currentPassword:z.string().max(PASSWORD_MAX_LENGTH),password:z.string().max(PASSWORD_MAX_LENGTH)}).strict(),
]);
export async function POST(request:Request){try{
 const origin=request.headers.get('origin');if(!origin||(origin!==new URL(request.url).origin&&origin!==new URL(process.env.AUTH_URL??request.url).origin))return json({error:'This request must come from the planner.'},403);
 const user=await getCurrentUser();if(!user)return json({error:'Sign in to access Sprint Overview.'},401);
 const members=(await readWorkspace())?.state.members??[];const member=members.find(m=>m.email.toLowerCase()===user.email);if(!member)return json({error:'Your account has not been granted access to this planner.'},403);
 const parsed=body.safeParse(await request.json().catch(()=>null));if(!parsed.success)return json({error:'Invalid'},400);const input=parsed.data;
 const problem=passwordProblem(input.password);if(problem)return json({error:problem},400);
 if('email' in input&&input.email!==user.email){
  if(member.role!=='admin')return json({error:'Administrator access required'},403);
  if(!members.some(m=>m.email.toLowerCase()===input.email))return json({error:'User not found'},404);
  await setPassword(input.email,input.password);return json({ok:true});
 }
 if(!('currentPassword' in input)||!await verifyPassword(user.email,input.currentPassword))return json({error:'Current password is incorrect.'},403);
 await setPassword(user.email,input.password);return json({ok:true});
}catch(e){console.error('Password update failed',e instanceof Error?e.message:'Unknown error');return json({error:'Planning storage is unavailable. Please try again.'},503);}}
