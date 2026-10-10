import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoRequest} from '../lib/demo.ts';
import {ruleContainsPerson} from '../lib/participant-removal.ts';
import type {Admin,Rule} from '../lib/types.ts';
const storage=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)}});
Object.defineProperty(globalThis,'location',{value:{origin:'https://demo.example.org'}});

test('las referencias de participantes se detectan como donante y receptor dentro de AND OR NOT',()=>{
 const rule:Rule={op:'NOT',rule:{op:'OR',rules:[{op:'AND',rules:[{op:'pair',giver:'ana',recipient:'pablo'}]}]}};
 assert.ok(ruleContainsPerson(rule,'ana'));assert.ok(ruleContainsPerson(rule,'pablo'));assert.equal(ruleContainsPerson(rule,'lucia'),false);
});
test('eliminar requiere confirmación, borra datos y token y permite volver a registrarse',async()=>{
 await demoRequest('reset');const token=await demoRequest('admin/token',{id:'pablo',action:'copy'}) as {link:string};
 const before=await demoRequest('admin') as Admin;await assert.rejects(demoRequest('admin/delete-participant',{id:'pablo'}),/Confirma/);assert.deepEqual(await demoRequest('admin'),before);
 await demoRequest('admin/delete-participant',{id:'pablo',confirm:true});const after=await demoRequest('admin') as Admin;assert.equal(after.people.length,before.people.length-1);assert.equal(after.people.some(p=>p.id==='pablo'),false);
 await assert.rejects(demoRequest('exchange',{token:token.link.split('#')[1]}),/inválido/);await assert.rejects(demoRequest('admin/delete-participant',{id:'pablo',confirm:true}),/inexistente/);
 assert.deepEqual(await demoRequest('matches',{name:'Pablo Martín'}),[]);await assert.doesNotReject(demoRequest('register',{name:'Pablo Martín'}));
});
test('eliminar a la identidad actual invalida su portal y las reglas bloquean el borrado',async()=>{
 await demoRequest('reset');await demoRequest('admin/rules',{rules:{op:'NOT',rule:{op:'pair',giver:'ana',recipient:'pablo'}}});const before=await demoRequest('admin');
 await assert.rejects(demoRequest('admin/delete-participant',{id:'ana',confirm:true}),/restricciones/);await assert.rejects(demoRequest('admin/delete-participant',{id:'pablo',confirm:true}),/restricciones/);assert.deepEqual(await demoRequest('admin'),before);
 await demoRequest('admin/rules',{rules:{op:'AND',rules:[]}});await demoRequest('admin/delete-participant',{id:'ana',confirm:true});await assert.rejects(demoRequest('portal'),/inexistente/);
});
test('el historial impide eliminar participantes y conserva los sorteos completos',async()=>{
 await demoRequest('reset');await demoRequest('admin/draw',{confirm:true});const before=await demoRequest('admin') as Admin;const history=await demoRequest('admin/history',{id:before.draws[0].id});
 await assert.rejects(demoRequest('admin/delete-participant',{id:'ana',confirm:true}),/sorteo/);assert.deepEqual(await demoRequest('admin'),before);assert.deepEqual(await demoRequest('admin/history',{id:before.draws[0].id}),history);
});
