'use client';
import {useEffect,useState} from 'react';
import {useTheme} from 'next-themes';
import {Monitor,Moon,Sun} from 'lucide-react';
import {useI18n} from './i18n-provider';
const OPTIONS=[['light',Sun,'Light'],['dark',Moon,'Dark'],['system',Monitor,'Match system']] as const;
export function ThemeSwitch(){const {t}=useI18n();const {theme,setTheme}=useTheme();const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const current=mounted?theme??'system':'';
 return <div className="language-switch theme-switch" role="group" aria-label={t('Theme')}>{OPTIONS.map(([value,Icon,label])=><button key={value} type="button" aria-pressed={current===value} title={t(label)} aria-label={t(label)} className={current===value?'active':''} onClick={()=>setTheme(value)}><Icon size={12}/></button>)}</div>;}
