import type { Metadata } from 'next';
import './globals.css';
import './dark.css';
import {ThemeProvider} from 'next-themes';
import {I18nProvider} from './i18n-provider';
export const metadata:Metadata={title:'Sprint Overview · Team planning',description:'Shared sprint planning for developers and designers.',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><I18nProvider>{children}</I18nProvider></ThemeProvider></body></html>;}
