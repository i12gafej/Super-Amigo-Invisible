import type {Rule} from './types';
export type Assignment=Record<string,string>;
export function validateRule(value:unknown,ids:string[],depth=0):asserts value is Rule {
 if(depth>8||!value||typeof value!=='object')throw Error('Restricción no válida o demasiado profunda.');
 const v=value as Record<string,unknown>;
 if(v.op==='pair'){if(typeof v.giver!=='string'||typeof v.recipient!=='string'||!ids.includes(v.giver)||!ids.includes(v.recipient))throw Error('La restricción incluye participantes inexistentes.');return;}
 if(v.op==='NOT'){validateRule(v.rule,ids,depth+1);return;}
 if((v.op==='AND'||v.op==='OR')&&Array.isArray(v.rules)&&v.rules.length<=30&&(v.op==='AND'||v.rules.length>0)){v.rules.forEach(r=>validateRule(r,ids,depth+1));return;}throw Error('Usa pair, AND, OR o NOT.');
}
function evaluate(rule:Rule,a:Assignment):boolean|undefined{
 if(rule.op==='pair')return a[rule.giver]===undefined?undefined:a[rule.giver]===rule.recipient;
 if(rule.op==='NOT'){const v=evaluate(rule.rule,a);return v===undefined?undefined:!v;}
 const values=rule.rules.map(r=>evaluate(r,a));
 if(rule.op==='AND')return values.includes(false)?false:values.includes(undefined)?undefined:true;
 return values.includes(true)?true:values.includes(undefined)?undefined:false;
}
export function solveDraw(ids:string[],rule:Rule,random:()=>number=Math.random):Assignment{
 if(ids.length<2||ids.length>80||new Set(ids).size!==ids.length)throw Error('El sorteo necesita entre 2 y 80 participantes únicos.');validateRule(rule,ids);
 const shuffled=[...ids];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const a:Assignment={},used=new Set<string>();let nodes=0;
 function visit(i:number):boolean{if(++nodes>250000)throw Error('Restricciones demasiado complejas. Simplifícalas antes de sortear.');if(i===ids.length)return evaluate(rule,a)===true;
 const giver=ids[i];for(const recipient of shuffled){if(giver===recipient||used.has(recipient))continue;a[giver]=recipient;used.add(recipient);if(evaluate(rule,a)!==false&&visit(i+1))return true;used.delete(recipient);delete a[giver];}return false;}
 if(!visit(0))throw Error('No hay un sorteo posible con estas restricciones.');return a;
}
