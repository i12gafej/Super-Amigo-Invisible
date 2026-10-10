import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solveDraw,validateRule} from '../lib/draw.ts';
import {normalizeName,similarName,type Rule} from '../lib/types.ts';
const empty:Rule={op:'AND',rules:[]};
test('normalización y coincidencias toleran acentos y errores pequeños',()=>{assert.equal(normalizeName('  ÁNA   García! '),'ana garcia');assert.ok(similarName('Ana Garcia','Ana García'));assert.ok(similarName('Pablo Martin','Pablo Martn'));assert.equal(similarName('Ana','Dani'),false);});
test('todas las personas dan y reciben exactamente una vez',()=>{for(let n=2;n<40;n++){const ids=Array.from({length:n},(_,i)=>String(i));const a=solveDraw(ids,empty);assert.equal(Object.keys(a).length,n);assert.equal(new Set(Object.values(a)).size,n);for(const id of ids)assert.notEqual(a[id],id);}});
test('AND OR NOT se aplican al conjunto completo',()=>{const rule:Rule={op:'AND',rules:[{op:'OR',rules:[{op:'pair',giver:'a',recipient:'b'},{op:'pair',giver:'a',recipient:'c'}]},{op:'NOT',rule:{op:'pair',giver:'b',recipient:'a'}}]};const a=solveDraw(['a','b','c'],rule);assert.ok(a.a==='b'||a.a==='c');assert.notEqual(a.b,'a');});
test('NOT de AND no equivale a prohibir cada pareja por separado',()=>{const a=solveDraw(['a','b','c'],{op:'NOT',rule:{op:'AND',rules:[{op:'pair',giver:'a',recipient:'b'},{op:'pair',giver:'b',recipient:'c'}]}});assert.equal(a.a==='b'&&a.b==='c',false);});
test('rechaza contradicciones y autoasignaciones forzadas',()=>{assert.throws(()=>solveDraw(['a','b'],{op:'pair',giver:'a',recipient:'a'}),/No hay/);assert.throws(()=>solveDraw(['a','b'],{op:'AND',rules:[{op:'pair',giver:'a',recipient:'b'},{op:'NOT',rule:{op:'pair',giver:'a',recipient:'b'}}]}),/No hay/);});
test('rechaza referencias inexistentes y estructuras inválidas',()=>{assert.throws(()=>validateRule({op:'pair',giver:'x',recipient:'b'},['a','b']));assert.throws(()=>validateRule({op:'OR',rules:[]},['a','b']));assert.throws(()=>solveDraw(['a'],empty));assert.throws(()=>solveDraw(['a','a'],empty));});
test('el motor coincide con enumeración exhaustiva para árboles lógicos anidados',()=>{
 const ids=['a','b','c','d'];
 function matches(rule:Rule,a:Record<string,string>):boolean{if(rule.op==='pair')return a[rule.giver]===rule.recipient;if(rule.op==='NOT')return !matches(rule.rule,a);return rule.op==='AND'?rule.rules.every(r=>matches(r,a)):rule.rules.some(r=>matches(r,a));}
 const candidates:Record<string,string>[]=[];
 function enumerate(a:Record<string,string>,i:number){if(i===ids.length){candidates.push({...a});return;}for(const r of ids){if(r===ids[i]||Object.values(a).includes(r))continue;a[ids[i]]=r;enumerate(a,i+1);delete a[ids[i]];}}
 enumerate({},0);
 let seed=42;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;}
 function tree(depth:number):Rule{if(!depth||random()<.4)return {op:'pair',giver:ids[Math.floor(random()*4)],recipient:ids[Math.floor(random()*4)]};if(random()<.3)return {op:'NOT',rule:tree(depth-1)};return {op:random()<.5?'AND':'OR',rules:[tree(depth-1),tree(depth-1)]};}
 for(let i=0;i<150;i++){const rule=tree(3),possible=candidates.some(a=>matches(rule,a));if(possible)assert.ok(matches(rule,solveDraw(ids,rule,random)));else assert.throws(()=>solveDraw(ids,rule,random),/No hay/);}
});
