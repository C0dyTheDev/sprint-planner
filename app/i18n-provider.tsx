'use client';
import {createContext,useContext,useEffect,useState,useMemo,useCallback,type ReactNode} from 'react';
import {translate,translateMessage,formatDate,formatHours,localeFor,type Language} from '@/lib/i18n';
const STORAGE_KEY='sprint-overview-language';
type LanguageContext={language:Language;setLanguage:(language:Language)=>void};
const Context=createContext<LanguageContext>({language:'en',setLanguage:()=>{}});
export function I18nProvider({children,initialLanguage='en'}:{children:ReactNode;initialLanguage?:Language}){
 const [language,setLanguageState]=useState<Language>(initialLanguage);
 useEffect(()=>{let preference:string|null=null;try{preference=localStorage.getItem(STORAGE_KEY);}catch{}setLanguageState(preference==='en'||preference==='cs'?preference:navigator.language.toLowerCase().startsWith('cs')?'cs':'en');},[]);
 useEffect(()=>{document.documentElement.lang=language;document.title=`Sprint Overview · ${translate(language,'Team planning')}`;},[language]);
 const setLanguage=useCallback((next:Language)=>{setLanguageState(next);try{localStorage.setItem(STORAGE_KEY,next);}catch{}},[]);
 return <Context.Provider value={{language,setLanguage}}>{children}</Context.Provider>;
}
export function useI18n(){const {language,setLanguage}=useContext(Context);return useMemo(()=>({language,setLanguage,locale:localeFor(language),t:(key:string,values?:Record<string,string|number>)=>translate(language,key,values),message:(text:string)=>translateMessage(language,text),hours:(minutes:number)=>formatHours(minutes,language),dateLabel:(date:string,options?:Intl.DateTimeFormatOptions)=>formatDate(date,language,options)}),[language,setLanguage]);}
export function LanguageSwitch(){const {language,setLanguage,t}=useI18n();return <div className="language-switch" role="group" aria-label={t('Language')}><button type="button" aria-pressed={language==='cs'} title={t('Czech')} className={language==='cs'?'active':''} onClick={()=>setLanguage('cs')}>CZ</button><button type="button" aria-pressed={language==='en'} title={t('English')} className={language==='en'?'active':''} onClick={()=>setLanguage('en')}>EN</button></div>;}
