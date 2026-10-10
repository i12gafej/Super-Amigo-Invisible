import {normalizeName,type Rule} from './types.ts';
export type RulePerson={id:string;name:string};
export type Condition={kind:'condition';person:string;direction:'give'|'receive';allow:boolean;targets:string[]};
export type RuleGroup={kind:'group';op:'AND'|'OR'|'NOT';children:EditorRule[]};
export type EditorRule=Condition|RuleGroup;
export const emptyRules=():RuleGroup=>({kind:'group',op:'AND',children:[]});
export const newCondition=(person=''):Condition=>({kind:'condition',person,direction:'give',allow:false,targets:[]});
function combine(op:'AND'|'OR',rules:Rule[]):Rule{
 if(rules.length<=30)return {op,rules};
 const groups:Rule[]=[];for(let i=0;i<rules.length;i+=30)groups.push({op,rules:rules.slice(i,i+30)});
 return {op,rules:groups};
}
export function compileEditor(node:EditorRule):Rule{
 if(node.kind==='group'){
  if(node.op==='NOT'){if(node.children.length!==1)throw Error('El grupo NO debe contener exactamente una regla o grupo.');return {op:'NOT',rule:compileEditor(node.children[0])};}
  if(node.op==='OR'&&!node.children.length)throw Error('Añade al menos una regla al grupo ALGUNA.');
  return combine(node.op,node.children.map(compileEditor));
 }
 if(!node.person)throw Error('Selecciona la persona de cada regla.');
 if(!node.targets.length)throw Error('Selecciona al menos una persona de destino u origen.');
 if(node.targets.includes(node.person))throw Error('Nadie puede regalarse a sí mismo. Quita esa persona de su propia regla.');
 const pairs:Rule[]=Array.from(new Set(node.targets)).map(target=>({op:'pair',giver:node.direction==='give'?node.person:target,recipient:node.direction==='give'?target:node.person}));
 const allowed=pairs.length===1&&node.direction==='give'?pairs[0]:combine('OR',pairs);
 return node.allow?allowed:{op:'NOT',rule:allowed};
}
export function decodeEditor(rule:Rule):EditorRule{
 if(rule.op==='pair')return {kind:'condition',person:rule.giver,direction:'give',allow:true,targets:[rule.recipient]};
 if(rule.op==='NOT'){
  const child=decodeEditor(rule.rule);
  if(child.kind==='condition')return {...child,allow:!child.allow};
  return {kind:'group',op:'NOT',children:[child]};
 }
 if(rule.op==='OR'&&rule.rules.length&&rule.rules.every(r=>r.op==='pair')){
  const pairs=rule.rules as Extract<Rule,{op:'pair'}>[];
  if(pairs.length===1)return {kind:'condition',person:pairs[0].recipient,direction:'receive',allow:true,targets:[pairs[0].giver]};
  if(pairs.every(p=>p.giver===pairs[0].giver))return {kind:'condition',person:pairs[0].giver,direction:'give',allow:true,targets:pairs.map(p=>p.recipient)};
  if(pairs.every(p=>p.recipient===pairs[0].recipient))return {kind:'condition',person:pairs[0].recipient,direction:'receive',allow:true,targets:pairs.map(p=>p.giver)};
 }
 return {kind:'group',op:rule.op,children:rule.rules.map(decodeEditor)};
}
export function personLabel(person:RulePerson,people:RulePerson[]):string{
 return people.filter(p=>normalizeName(p.name)===normalizeName(person.name)).length>1?`${person.name} [${person.id}]`:person.name;
}
export function editorToText(node:EditorRule,people:RulePerson[],depth=0):string{
 const indent='  '.repeat(depth);
 if(node.kind==='group'){
  const keyword={AND:'TODAS',OR:'ALGUNA',NOT:'NO'}[node.op];
  return `${indent}${keyword} {\n${node.children.map(c=>editorToText(c,people,depth+1)).join('\n')}\n${indent}}`;
 }
 const label=(id:string)=>{const p=people.find(p=>p.id===id);if(!p)throw Error('La regla contiene una persona que ya no está en la sala.');return JSON.stringify(personLabel(p,people));};
 return `${indent}${label(node.person)} ${node.allow?'solo puede':'no puede'} ${node.direction==='give'?'regalar a':'recibir de'} ${node.targets.map(label).join(', ')}`;
}
function names(value:string):string[]{
 if(value.trim().startsWith('"')){
  try{const parsed:unknown=JSON.parse('['+value+']');if(Array.isArray(parsed)&&parsed.every(n=>typeof n==='string'))return parsed;}catch{}
  throw Error('Revisa las comillas: separa los nombres con comas.');
 }
 return value.split(/[,;|]/).map(n=>n.trim()).filter(Boolean);
}
export function textToEditor(text:string,people:RulePerson[]):EditorRule{
 const root=emptyRules(),stack:RuleGroup[]=[root];
 const resolve=(name:string)=>{const matched=people.filter(p=>normalizeName(personLabel(p,people))===normalizeName(name));if(matched.length!==1)throw Error(`Nombre inexistente o ambiguo: ${name}. Usa el nombre del selector.`);return matched[0].id;};
 for(const [index,raw] of text.split('\n').entries()){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  try{
   if(line==='}'){if(stack.length===1)throw Error('Hay una llave de cierre de más.');stack.pop();continue;}
   const group=line.match(/^(TODAS|ALGUNA|NO)\s*\{$/i);
   if(group){if(stack.length>7)throw Error('Demasiados grupos anidados.');const node:RuleGroup={kind:'group',op:({TODAS:'AND',ALGUNA:'OR',NO:'NOT'} as const)[group[1].toUpperCase() as 'TODAS'|'ALGUNA'|'NO'],children:[]};stack.at(-1)!.children.push(node);stack.push(node);continue;}
   const match=line.match(/^(.+?)\s+(solo puede|no puede|debe)\s+(regalar(?:le)? a|recibir de)\s+(.+)$/i);
   if(!match)throw Error('Usa «Ana no puede regalar a Luis, Marta» o «Ana solo puede recibir de Luis».');
   const from=names(match[1]);if(from.length!==1)throw Error('Cada línea empieza por una sola persona.');
   stack.at(-1)!.children.push({kind:'condition',person:resolve(from[0]),allow:match[2].toLowerCase()!=='no puede',direction:match[3].toLowerCase().startsWith('regalar')?'give':'receive',targets:names(match[4]).map(resolve)});
  }catch(e){throw Error(`Línea ${index+1}: ${e instanceof Error?e.message:'Regla inválida.'}`);}
 }
 if(stack.length!==1)throw Error('Falta cerrar un grupo con }.');
 const result=root.children.length===1&&root.children[0].kind==='group'?root.children[0]:root;
 compileEditor(result);return result;
}
