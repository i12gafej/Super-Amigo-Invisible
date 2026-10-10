import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEditor,decodeEditor,editorToText,textToEditor,personLabel,type Condition} from '../lib/rule-editor.ts';
import {solveDraw,validateRule} from '../lib/draw.ts';
import type {Rule} from '../lib/types.ts';
const people=[{id:'a',name:'Ana García'},{id:'b',name:'Luis Pérez'},{id:'c',name:'Marta Ruiz'},{id:'d',name:'Carlos'}];
const ids=people.map(p=>p.id);
const condition=(direction:Condition['direction'],allow:boolean,targets=['b','c']):Condition=>({kind:'condition',person:'a',direction,allow,targets});
function evaluate(rule:Rule,a:Record<string,string>):boolean{if(rule.op==='pair')return a[rule.giver]===rule.recipient;if(rule.op==='NOT')return !evaluate(rule.rule,a);return rule.op==='AND'?rule.rules.every(r=>evaluate(r,a)):rule.rules.some(r=>evaluate(r,a));}
const assignments:Record<string,string>[]=[];
function permutations(a:Record<string,string>,i:number){if(i===ids.length){assignments.push({...a});return;}for(const target of ids.filter(id=>!Object.values(a).includes(id))){a[ids[i]]=target;permutations(a,i+1);delete a[ids[i]];}}
permutations({},0);
test('las cuatro reglas aplican listas de personas en la dirección correcta',()=>{
 for(const direction of ['give','receive'] as const)for(const allow of [true,false]){
  const rule=compileEditor(condition(direction,allow));
  for(const assignment of assignments){const target=direction==='give'?assignment.a:Object.keys(assignment).find(id=>assignment[id]==='a');assert.equal(evaluate(rule,assignment),allow===['b','c'].includes(target!));}
 }
});
test('solo puede con una persona fija la pareja y las contradicciones impiden el sorteo',()=>{
 const rule=compileEditor(condition('give',true,['b']));assert.equal(solveDraw(ids,rule).a,'b');
 assert.throws(()=>solveDraw(ids,{op:'AND',rules:[rule,compileEditor(condition('give',false,['b']))]}),/No hay/);
 assert.throws(()=>compileEditor(condition('give',true,[])),/al menos una/);
 assert.throws(()=>compileEditor(condition('receive',false,['a'])),/sí mismo/);
});
test('el modo UI y texto mantienen la semántica de árboles AND OR NOT existentes',()=>{
 const rules:Rule[]=[{op:'AND',rules:[]},{op:'OR',rules:[{op:'pair',giver:'b',recipient:'a'},{op:'pair',giver:'c',recipient:'a'}]},{op:'NOT',rule:{op:'AND',rules:[{op:'pair',giver:'a',recipient:'b'},{op:'pair',giver:'b',recipient:'c'}]}},{op:'AND',rules:[compileEditor(condition('give',false)),{op:'OR',rules:[{op:'pair',giver:'b',recipient:'c'},{op:'NOT',rule:{op:'pair',giver:'d',recipient:'b'}}]}]}];
 for(const rule of rules){const ui=decodeEditor(rule);const converted=compileEditor(textToEditor(editorToText(ui,people),people));validateRule(converted,ids);for(const assignment of assignments)assert.equal(evaluate(converted,assignment),evaluate(rule,assignment));}
});
test('texto con nombres, acentos, listas y alias debe se convierte sin usar IDs',()=>{
 const ui=textToEditor('Ana Garcia no puede regalar a Luis Pérez, Marta Ruiz\nCarlos debe recibir de Ana García',people);
 const result=solveDraw(ids,compileEditor(ui));assert.equal(result.a,'d');
});
test('texto inválido y nombres ambiguos no se interpretan silenciosamente',()=>{
 assert.throws(()=>textToEditor('Ana no puede regalar a Desconocido',people),/Línea 1/);
 assert.throws(()=>textToEditor('ALGUNA {\n}',people),/al menos/);
 assert.throws(()=>textToEditor('TODAS {',people),/Falta cerrar/);
 assert.throws(()=>textToEditor('NO {\nCarlos debe regalar a Luis Pérez\nCarlos debe recibir de Marta Ruiz\n}',people),/exactamente una/);
 const duplicates=[...people,{id:'other',name:'Ana García'}];assert.throws(()=>textToEditor('Ana García no puede regalar a Carlos',duplicates),/ambiguo/);
 const uniqueLabel=JSON.stringify(personLabel(duplicates[0],duplicates));assert.doesNotThrow(()=>textToEditor(uniqueLabel+' no puede regalar a "Carlos"',duplicates));
});
test('listas de más de treinta personas respetan los límites por nodo del motor',()=>{
 const many=Array.from({length:80},(_,i)=>'p'+i);const rule=compileEditor({...condition('receive',false,many.slice(1)),person:many[0]});assert.doesNotThrow(()=>validateRule(rule,many));
});

test('la dirección recibir de se conserva al guardar incluso con una persona',()=>{for(const allow of [true,false])assert.deepEqual(decodeEditor(compileEditor(condition('receive',allow,['b']))),condition('receive',allow,['b']));});
