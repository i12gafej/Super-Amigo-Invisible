import {solveDraw} from './draw';
import {similarName,type Admin,type Portal,type Rule} from './types';
const history:Record<string,{rules:Rule;pairs:{giver:string;recipient:string}[]}>={};
const initial:Admin={room:{id:'navidad-2026',name:'Navidad en familia',budget:30,date:'2026-12-25',closed:false},people:[{id:'ana',name:'Ana García',wishlist:'Un libro que te haya gustado.\nCafé de especialidad. Mucho café.',canEdit:false,active:true},{id:'pablo',name:'Pablo Martín',wishlist:'Calcetines de montaña, talla 42.\nUn juego de mesa para dos.',canEdit:false,active:true},{id:'lucia',name:'Lucía López',wishlist:'Una planta que sobreviva a mí.\nUna libreta bonita.',canEdit:false,active:true},{id:'dani',name:'Dani Ruiz',wishlist:'Auriculares o algo para cocinar.',canEdit:false,active:true}],draws:[],rules:{op:'AND',rules:[]}};
let state=structuredClone(initial),current='ana',assignments:Record<string,string>={},loaded=false;
function restore(){if(loaded)return;loaded=true;try{const saved=localStorage.getItem('sai-demo');if(saved){const value=JSON.parse(saved);if(value.state?.room?.id===initial.room.id&&Array.isArray(value.state.people)){state=value.state;current=value.current;assignments=value.assignments;Object.assign(history,value.history||{});}}}catch{localStorage.removeItem('sai-demo');}}
function save(){localStorage.setItem('sai-demo',JSON.stringify({state,current,assignments,history}));}
export async function demoRequest(path:string,data:Record<string,unknown>={}):Promise<unknown>{
 restore();try{
 if(path==='exchange'){const id=String(data.token).replace(/^demo-/,'');if(!state.people.some(p=>p.id===id&&p.active))throw Error('Enlace demo inválido o revocado.');current=id;return {};}
 if(path==='join')return state.room;
 if(path==='matches')return state.people.filter(p=>similarName(p.name,String(data.name))).map(p=>({name:p.name}));
 if(path==='register'){if(state.room.closed)throw Error('Registro cerrado.');if(!data.confirmDuplicate&&state.people.some(p=>similarName(p.name,String(data.name))))throw Error('Confirma el aviso de nombre parecido.');current=crypto.randomUUID();state.people.push({id:current,name:String(data.name),wishlist:'',canEdit:false,active:true});return {link:location.origin+'/demo#demo-'+current};}
 if(path==='portal'){const person=state.people.find(p=>p.id===current);if(!person?.active)throw Error('Enlace demo revocado.');const r=state.people.find(p=>p.id===assignments[current]);return {room:state.room,person,recipient:r?{name:r.name,wishlist:r.wishlist}:null} satisfies Portal;}
 if(path==='wishlist'){const p=state.people.find(p=>p.id===current)!;if(state.room.closed&&!p.canEdit)throw Error('La lista está cerrada.');p.wishlist=String(data.wishlist);return {};}
 if(path==='admin/history')return history[String(data.id)]||{rules:state.rules,pairs:[]};
 if(path==='admin/login'||path==='admin')return structuredClone(state);
 if(path==='admin/wishlist'){state.people.find(p=>p.id===data.id)!.wishlist=String(data.wishlist);return {};}
 if(path==='admin/permission'){state.people.find(p=>p.id===data.id)!.canEdit=Boolean(data.enabled);return {};}
 if(path==='admin/token'){const p=state.people.find(p=>p.id===data.id)!;p.active=data.action!=='revoke';return {link:data.action==='revoke'?null:location.origin+'/demo#demo-'+p.id};}
 if(path==='admin/rules'){solveDraw(state.people.map(p=>p.id),data.rules as Rule);state.rules=data.rules as Rule;return {};}
 if(path==='admin/validate'){solveDraw(state.people.map(p=>p.id),state.rules);return {message:'Restricciones válidas. Existe un sorteo posible.'};}
 if(path==='admin/draw'){if(!data.confirm)throw Error('Confirma el nuevo sorteo.');assignments=solveDraw(state.people.map(p=>p.id),state.rules);state.room.closed=true;state.draws.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),count:state.people.length});history[state.draws[0].id]={rules:structuredClone(state.rules),pairs:Object.entries(assignments).map(([giver,recipient])=>({giver:state.people.find(p=>p.id===giver)!.name,recipient:state.people.find(p=>p.id===recipient)!.name}))};return {};}
 if(path==='logout'){state=structuredClone(initial);assignments={};return {};}
 throw Error('Acción de demo desconocida.');
 }finally{save();}
}
