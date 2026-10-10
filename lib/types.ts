export type Rule = { op:'pair'; giver:string; recipient:string } | {op:'AND'|'OR'; rules:Rule[]} | {op:'NOT'; rule:Rule};
export type Person={id:string;name:string;wishlist:string;canEdit:boolean;active:boolean};
export type Draw={id:string;createdAt:string;count:number};
export type Room={id:string;name:string;budget:number;date:string;closed:boolean};
export type Portal={room:Room;person:Person;recipient:Pick<Person,'name'|'wishlist'>|null};
export type Admin={room:Room;people:Person[];draws:Draw[];rules:Rule};
export function normalizeName(value:string){return value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
export function similarName(a:string,b:string){a=normalizeName(a);b=normalizeName(b);if(a===b)return true;if(Math.min(a.length,b.length)<3)return false;const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=old;}}return row[b.length]<=Math.max(1,Math.floor(Math.max(a.length,b.length)*.2));}

export type Simulation={count:number;pairs:{giverId:string;giver:string;recipientId:string;recipient:string}[]};
