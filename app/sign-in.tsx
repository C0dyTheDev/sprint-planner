'use client';
import {LanguageSwitch,useI18n} from './i18n-provider';
export default function SignIn({action}:{action:()=>Promise<void>}){const {t}=useI18n();return <main className="signin"><div className="signin-language"><LanguageSwitch/></div><div className="signin-card"><div className="brand-mark">S</div><h1>Sprint Overview</h1><p>{t('A shared plan for people, teams, and the work ahead.')}</p><form action={action}><button className="signin-button" type="submit">{t('Sign in with GitHub')}</button></form><small>{t('Access is limited to authorized planning managers.')}</small></div></main>;}
