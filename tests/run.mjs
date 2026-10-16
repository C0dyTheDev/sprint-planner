import { build } from 'esbuild';
import { writeFile,unlink } from 'node:fs/promises';
for(const entry of ['domain','daily-planning','api','auth-policy','migration','localization','recognition']){
 const result=await build({entryPoints:[`tests/${entry}.ts`],bundle:true,platform:'node',jsx:'automatic',format:'esm',write:false,packages:'external',plugins:entry==='api'?[{name:'session-test',setup(b){b.onResolve({filter:/lib\/session$/},()=>({path:'session',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export async function getCurrentUser(){return globalThis.__testAuth;}'}));}}]:[]});
 const file=new URL(`./.${entry}-run.mjs`,import.meta.url);await writeFile(file,result.outputFiles[0].text);
 try{await import(file.href);}finally{await unlink(file);}
}
