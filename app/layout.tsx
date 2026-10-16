import type { Metadata } from 'next';
import './globals.css';
import {I18nProvider} from './i18n-provider';
export const metadata:Metadata={title:'Sprint Overview · Team planning',description:'Shared sprint planning for developers and designers.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><I18nProvider>{children}</I18nProvider></body></html>;}
