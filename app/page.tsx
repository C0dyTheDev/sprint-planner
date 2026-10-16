import Planner from './planner';
import SignIn from './sign-in';
import { getCurrentUser } from '@/lib/session';
import { missingConfiguration } from '@/lib/configuration';
import { login } from './auth-actions';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export default async function Home(){
 const missing=missingConfiguration();
 if(missing.length)return <main className="boot"><div className="brand-mark">S</div><h1>Sprint Overview</h1><p>Application setup is incomplete. Ask the administrator to complete the deployment settings described in README.md.</p><p>Missing environment variables: {missing.join(', ')}</p></main>;
 const user=await getCurrentUser();
 return user?<Planner displayName={user.displayName}/>:<SignIn action={login}/>;
}
