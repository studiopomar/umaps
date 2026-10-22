import {readFile,writeFile,readdir} from 'node:fs/promises';
const root=new URL('../node_modules/',import.meta.url);
const paths=[];
for(const name of await readdir(root)){
 if(name.startsWith('.'))continue;
 if(name.startsWith('@'))for(const child of await readdir(new URL(name+'/',root)))paths.push(`${name}/${child}`);
 else paths.push(name);
}
const notices=[];
for(const name of paths){try{const dir=new URL(name+'/',root),p=JSON.parse(await readFile(new URL('package.json',dir)));const files=(await readdir(dir)).filter(f=>/^licen[cs]e|^copying/i.test(f));for(const f of files)notices.push(`${p.name} ${p.version}\n${await readFile(new URL(f,dir),'utf8')}`);}catch{}}
await writeFile(new URL('../vendor/THIRD-PARTY-NOTICES.txt',import.meta.url),notices.join('\n\n========================================\n\n'));
