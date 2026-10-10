import {solveDraw} from './draw.ts';
import type {Rule,Simulation} from './types.ts';

// Resultado efímero: esta función no tiene acceso a almacenamiento ni modifica entradas.
export function simulateDraw(people:readonly {id:string;name:string}[],rules:Rule,random:()=>number):Simulation{
 const assignments=solveDraw(people.map(p=>p.id),rules,random);
 const names=new Map(people.map(p=>[p.id,p.name]));
 return {count:people.length,pairs:people.map(p=>({giverId:p.id,giver:p.name,recipientId:assignments[p.id],recipient:names.get(assignments[p.id])!}))};
}
