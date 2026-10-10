import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveDraw} from '../lib/draw.ts';
import {compileEditor,decodeEditor,editorToText,textToEditor,type Condition} from '../lib/rule-editor.ts';
import type {Rule} from '../lib/types.ts';
const ids=Array.from({length:18},(_,i)=>'p'+i);
const people=ids.map((id,i)=>({id,name:'Persona '+(i+1)}));
const durations:number[]=[];
let verified=0;
function random(seed:number){let state=seed;return ()=>((state=(state*1664525+1013904223)>>>0)/4294967296);}
function matches(rule:Rule,a:Record<string,string>):boolean{if(rule.op==='pair')return a[rule.giver]===rule.recipient;if(rule.op==='NOT')return !matches(rule.rule,a);return rule.op==='AND'?rule.rules.every(r=>matches(r,a)):rule.rules.some(r=>matches(r,a));}
function verify(rule:Rule,seed:number){const start=performance.now();const a=solveDraw(ids,rule,random(seed));durations.push(performance.now()-start);verified++;assert.deepEqual(Object.keys(a).sort(),[...ids].sort());assert.deepEqual(Object.values(a).sort(),[...ids].sort());for(const id of ids)assert.notEqual(a[id],id);assert.ok(matches(rule,a),'El sorteo debe cumplir todas las restricciones según un evaluador independiente.');return a;}
const leaf=(person:string,direction:Condition['direction'],allow:boolean,targets:string[])=>compileEditor({kind:'condition',person,direction,allow,targets});
const and=(rules:Rule[]):Rule=>({op:'AND',rules});
test('18 personas: 200 sorteos sin restricciones son biyecciones sin autoasignación',()=>{for(let seed=1;seed<=200;seed++)verify(and([]),seed);});
test('18 personas: 100 sorteos excluyen a los miembros de seis familias de tres',()=>{
 const rule=and(ids.map((id,i)=>leaf(id,'give',false,ids.filter((other,j)=>other!==id&&Math.floor(j/3)===Math.floor(i/3)))));
 for(let seed=1;seed<=100;seed++)verify(rule,seed);
});
test('18 personas: 100 sorteos excluyen a nueve parejas en ambos sentidos',()=>{
 const rule=and(ids.map((id,i)=>leaf(id,'give',false,[ids[i%2===0?i+1:i-1]])));
 for(let seed=1;seed<=100;seed++)verify(rule,seed);
});
test('18 personas: 100 sorteos con las 18 parejas obligatorias conservan la única solución',()=>{
 const rule=and(ids.map((id,i)=>leaf(id,'give',true,[ids[(i+1)%18]])));
 for(let seed=1;seed<=100;seed++){const a=verify(rule,seed);for(let i=0;i<18;i++)assert.equal(a[ids[i]],ids[(i+1)%18]);}
});
test('18 personas: 200 regresiones con donantes situados al final de la lista',()=>{
 const rule=and([leaf('p0','receive',true,['p16']),leaf('p1','receive',true,['p17'])]);
 for(let seed=1;seed<=200;seed++){const a=verify(rule,seed);assert.equal(a.p16,'p0');assert.equal(a.p17,'p1');}
});
function knownCase(seed:number):Rule{
 const rnd=random(seed),order=[...ids];for(let i=order.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 const witness=Object.fromEntries(order.map((id,i)=>[id,order[(i+1)%18]]));
 const rules:Rule[]=[];
 for(let i=0;i<18;i++){
  const person=ids[i],direction=i%2?'give':'receive';const target=direction==='give'?witness[person]:ids.find(id=>witness[id]===person)!;
  const alternatives=ids.filter(id=>id!==person&&id!==target);
  if(i%4<2)rules.push(leaf(person,direction,true,[target,alternatives[Math.floor(rnd()*alternatives.length)],alternatives[Math.floor(rnd()*alternatives.length)]]));
  else {const excluded=alternatives.filter(()=>rnd()<.25);rules.push(leaf(person,direction,false,excluded.length?excluded:[alternatives[0]]));}
 }
 const falseTarget=ids.find(id=>id!==ids[0]&&id!==witness[ids[0]])!;
 rules.push({op:'NOT',rule:{op:'AND',rules:[{op:'pair',giver:ids[0],recipient:falseTarget},{op:'pair',giver:ids[1],recipient:witness[ids[1]]}]}});
 rules.push({op:'OR',rules:[{op:'pair',giver:ids[2],recipient:witness[ids[2]]},{op:'NOT',rule:{op:'pair',giver:ids[0],recipient:falseTarget}}]});
 const rule=and(rules);assert.ok(matches(rule,witness),'La instancia generada tiene una solución conocida.');return rule;
}
test('18 personas: 200 casos generados mezclan las cuatro reglas, AND OR NOT y listas múltiples',()=>{
 for(let seed=1;seed<=200;seed++)verify(knownCase(seed),seed+3000);
});
test('18 personas: 100 reglas mixtas sobreviven al recorrido UI → texto → UI → motor',()=>{
 for(let seed=201;seed<=300;seed++){const original=knownCase(seed);const text=editorToText(decodeEditor(original),people);const converted=compileEditor(textToEditor(text,people));const result=verify(converted,seed+4000);assert.ok(matches(original,result));}
});
test('18 personas: 35 casos imposibles se rechazan sin devolver sorteos parciales',()=>{
 const cases:Rule[]=[
  and([leaf('p16','give',true,['p0']),leaf('p17','give',true,['p0'])]),
  leaf('p0','receive',false,ids.slice(1)),
  and(ids.slice(0,4).map(id=>leaf(id,'give',true,['p4','p5','p6']))),
  and([leaf('p0','receive',true,['p17']),leaf('p0','receive',false,['p17'])]),
  {op:'pair',giver:'p0',recipient:'p0'},
  {op:'NOT',rule:{op:'OR',rules:ids.slice(1).map(recipient=>({op:'pair',giver:'p0',recipient}))}},
  {op:'OR',rules:[{op:'pair',giver:'p0',recipient:'p0'},and([leaf('p1','give',true,['p2']),leaf('p1','give',false,['p2'])])]}
 ];
 for(const rule of cases)for(let seed=1;seed<=5;seed++)assert.throws(()=>solveDraw(ids,rule,random(seed)),/No hay un sorteo posible/);
});
test('informe de rendimiento de los 1000 sorteos válidos con 18 personas',t=>{
 assert.equal(verified,1000);const sorted=[...durations].sort((a,b)=>a-b);
 t.diagnostic(JSON.stringify({participants:18,validDraws:verified,impossibleCases:35,medianMs:+sorted[Math.floor(sorted.length*.5)].toFixed(2),p95Ms:+sorted[Math.floor(sorted.length*.95)].toFixed(2),maxMs:+sorted.at(-1)!.toFixed(2)}));
});

test('18 personas: 300 árboles anidados contrastados con todas las soluciones de un subgrupo de cuatro',()=>{
 const subset=ids.slice(0,4),fixed=ids.slice(4),possible:Record<string,string>[]=[];
 const baseline=Object.fromEntries(fixed.map((id,i)=>[id,fixed[(i+1)%fixed.length]]));
 function enumerate(a:Record<string,string>,i:number){if(i===subset.length){possible.push({...baseline,...a});return;}for(const target of subset){if(target===subset[i]||Object.values(a).includes(target))continue;a[subset[i]]=target;enumerate(a,i+1);delete a[subset[i]];}}
 enumerate({},0);assert.equal(possible.length,9);
 const base:Rule[]=fixed.map((id,i)=>({op:'pair',giver:id,recipient:fixed[(i+1)%fixed.length]}));
 base.push(...subset.map(id=>leaf(id,'give',true,subset.filter(other=>other!==id))));
 const rnd=random(180018);
 function tree(depth:number):Rule{if(!depth||rnd()<.4)return {op:'pair',giver:subset[Math.floor(rnd()*4)],recipient:subset[Math.floor(rnd()*4)]};if(rnd()<.3)return {op:'NOT',rule:tree(depth-1)};return {op:rnd()<.5?'AND':'OR',rules:[tree(depth-1),tree(depth-1)]};}
 for(let i=0;i<300;i++){const rule=and([...base,tree(3)]),exists=possible.some(a=>matches(rule,a));if(exists){const result=solveDraw(ids,rule,rnd);assert.ok(matches(rule,result));assert.equal(new Set(Object.values(result)).size,18);for(const id of ids)assert.notEqual(result[id],id);}else assert.throws(()=>solveDraw(ids,rule,rnd),/No hay un sorteo posible/);}
});
