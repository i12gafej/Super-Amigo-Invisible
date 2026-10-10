import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulateDraw} from '../lib/simulation.ts';
import type {Rule,Admin,Portal,Simulation} from '../lib/types.ts';
import {demoRequest} from '../lib/demo.ts';

test('simulacro con 18 personas cumple reglas sin modificar participantes ni restricciones',()=>{
 const people=Object.freeze(Array.from({length:18},(_,i)=>Object.freeze({id:'p'+i,name:'Persona '+i})));
 const rule:Rule={op:'AND',rules:[{op:'pair',giver:'p17',recipient:'p0'},{op:'NOT',rule:{op:'pair',giver:'p0',recipient:'p17'}}]};
 const before=JSON.stringify(rule);const result=simulateDraw(people,rule,()=>.5);
 assert.equal(result.count,18);assert.equal(new Set(result.pairs.map(p=>p.giverId)).size,18);assert.equal(new Set(result.pairs.map(p=>p.recipientId)).size,18);
 for(const pair of result.pairs){assert.notEqual(pair.giverId,pair.recipientId);assert.equal(pair.recipient,people.find(p=>p.id===pair.recipientId)!.name);}
 assert.equal(result.pairs.find(p=>p.giverId==='p17')!.recipientId,'p0');assert.notEqual(result.pairs.find(p=>p.giverId==='p0')!.recipientId,'p17');assert.equal(JSON.stringify(rule),before);
});
test('simulacro imposible falla y los nombres duplicados no mezclan identidades',()=>{
 const people=[{id:'a',name:'Ana'},{id:'b',name:'Ana'}];const result=simulateDraw(people,{op:'AND',rules:[]},()=>.5);
 assert.deepEqual(result.pairs.map(p=>[p.giverId,p.recipientId]),[['a','b'],['b','a']]);
 assert.throws(()=>simulateDraw(people,{op:'pair',giver:'a',recipient:'a'},()=>.5),/No hay/);
});
const storage=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)}});
Object.defineProperty(globalThis,'location',{value:{origin:'https://demo.example.org'}});
test('simulacros antes y después de un sorteo no alteran sala, historial ni destinatarios',async()=>{
 await demoRequest('reset');
 for(const afterRealDraw of [false,true]){
  if(afterRealDraw)await demoRequest('admin/draw',{confirm:true});
  const before=await demoRequest('admin') as Admin;const portal=await demoRequest('portal') as Portal;const saved=storage.get('sai-demo-v2');
  for(let i=0;i<4;i++){const preview=await demoRequest('admin/simulate') as Simulation;assert.equal(preview.count,before.people.length);assert.equal(new Set(preview.pairs.map(p=>p.recipientId)).size,before.people.length);}
  assert.deepEqual(await demoRequest('admin'),before);assert.deepEqual(await demoRequest('portal'),portal);assert.equal(storage.get('sai-demo-v2'),saved);
 }
});
