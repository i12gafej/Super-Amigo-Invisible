// Ejecutar después de npm run build. Solo usa un servidor HTTP y credenciales ficticias.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash,createHmac} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const appPort=3138,origin=`http://127.0.0.1:${appPort}`;
const secret='disposable-simulation-test-session-secret';
const room={id:'test-simulation-18',name:'Sala ficticia',budget:30,event_date:'2026-12-25',password_hash:'test-room-hash',admin_password_hash:'test-admin-hash',closed:false,revision:18,current_draw_id:null,rules:{op:'pair',giver:'p17',recipient:'p0'}};
const people=Array.from({length:18},(_,i)=>({id:`p${i}`,name:`Persona ${i}`}));
const requests=[];
let allowDeletion=false;const deletionCalls=[];
const upstream=createServer((req,res)=>{
 requests.push({method:req.method,url:req.url});
 res.setHeader('Content-Type','application/json');
 if(req.method!=='GET'){
  if(allowDeletion&&req.method==='POST'&&req.url==='/rest/v1/rpc/delete_participant'){
   let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{deletionCalls.push(JSON.parse(body));res.statusCode=204;res.end();});return;
  }
  res.statusCode=500;res.end('{"message":"Test rejects writes"}');return;
 }
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/rest/v1/rooms')res.end(JSON.stringify([room]));
 else if(url.pathname==='/rest/v1/participants'&&url.searchParams.get('room_id')==='eq.'+room.id)res.end(JSON.stringify(people));
 else {res.statusCode=404;res.end('{"message":"Unexpected test request"}');}
});
upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
const upstreamPort=upstream.address().port;
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(appPort)],{env:{...process.env,APP_ORIGIN:origin,SUPABASE_URL:`http://127.0.0.1:${upstreamPort}`,SUPABASE_SERVICE_ROLE_KEY:'disposable-test-service-key',SESSION_SECRET:secret,TOKEN_ENCRYPTION_KEY:'a'.repeat(64)},stdio:['ignore','pipe','pipe']});
function cookie(role,stamp=createHash('sha256').update(room.admin_password_hash).digest('hex')){
 const payload=Buffer.from(JSON.stringify({role,room:room.id,stamp,exp:Date.now()+60000})).toString('base64url');
 return `sai_${role}=${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;
}
async function simulate(session='',requestOrigin=origin){
 return fetch(origin+'/api/admin/simulate',{method:'POST',headers:{'Content-Type':'application/json',Origin:requestOrigin,...(session?{Cookie:session}:{})},body:'{}'});
}
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Test app startup timed out')),20000);app.once('exit',()=>{clearTimeout(timer);reject(Error('Test app exited during startup'));});app.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve();}});});
 for(const session of ['',cookie('join'),cookie('participant')]){const before=requests.length;const response=await simulate(session);assert.equal(response.status,401);assert.equal(requests.length,before,'Sin sesión administrativa no debe consultar participantes');}
 assert.equal((await simulate(cookie('admin'),'https://other.example.org')).status,403);
 assert.equal((await simulate(cookie('admin','invalid-stamp'))).status,401);
 const snapshot=JSON.stringify({room,people});
 for(let i=0;i<3;i++){
  const response=await simulate(cookie('admin'));assert.equal(response.status,200);const preview=await response.json();
  assert.equal(preview.count,18);assert.equal(new Set(preview.pairs.map(p=>p.giverId)).size,18);assert.equal(new Set(preview.pairs.map(p=>p.recipientId)).size,18);
  for(const pair of preview.pairs){assert.notEqual(pair.giverId,pair.recipientId);assert.equal(pair.recipient,people.find(p=>p.id===pair.recipientId).name);}
  assert.equal(preview.pairs.find(p=>p.giverId==='p17').recipientId,'p0');
 }
 assert.equal(JSON.stringify({room,people}),snapshot);
 room.rules={op:'pair',giver:'p0',recipient:'p0'};
 const response=await simulate(cookie('admin'));assert.equal(response.status,422);
 assert.ok(requests.every(r=>r.method==='GET'),'El endpoint de simulacro solo realiza lecturas');
 assert.ok(requests.every(r=>r.url.startsWith('/rest/v1/rooms?')||r.url.startsWith('/rest/v1/participants?')),'No invoca RPC de sorteo ni de escritura');
 const deleteId='11111111-1111-4111-8111-111111111111';
 async function remove(session,body){return fetch(origin+'/api/admin/delete-participant',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(session?{Cookie:session}:{})},body:JSON.stringify(body)});}
 for(const session of ['',cookie('join'),cookie('participant')])assert.equal((await remove(session,{id:deleteId,confirm:true})).status,401);
 assert.equal((await remove(cookie('admin'),{id:deleteId})).status,400);
 assert.equal((await remove(cookie('admin'),{id:deleteId+'&room_id=eq.other',confirm:true})).status,400);
 assert.equal(deletionCalls.length,0,'No se puede borrar sin confirmación y UUID válido');
 allowDeletion=true;
 assert.equal((await remove(cookie('admin'),{id:deleteId,confirm:true,roomId:'another-room'})).status,200);
 assert.deepEqual(deletionCalls,[{p_room:room.id,p_person:deleteId}],'La sala procede de la sesión administrativa, nunca del cliente');
 console.log('Backend verificado con Supabase HTTP ficticio: simulacro privado sin escrituras y eliminación solo con sesión administrativa, confirmación y sala de la sesión.');
}finally{
 app.kill('SIGTERM');await new Promise(resolve=>upstream.close(resolve));
}
