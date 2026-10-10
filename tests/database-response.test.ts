import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readDatabaseResponse} from '../lib/database-response.ts';
import {ApiError} from '../lib/validation.ts';

test('RPC void completada con respuesta vacía no convierte un guardado en error',async()=>{
 for(const response of [new Response('',{status:200}),new Response(null,{status:204})]){
  assert.equal(await readDatabaseResponse(response),null);
 }
});
test('mantiene las respuestas JSON de consultas y funciones',async()=>{
 assert.deepEqual(await readDatabaseResponse(new Response('[{"wishlist":"Un libro"}]')),[{wishlist:'Un libro'}]);
 assert.equal(await readDatabaseResponse(new Response('true')),true);
 assert.equal(await readDatabaseResponse(new Response('null')),null);
});
test('una respuesta no vacía malformada sigue siendo un error sin revelar el cuerpo',async()=>{
 await assert.rejects(readDatabaseResponse(new Response('private response details')),e=>e instanceof ApiError&&e.status===503&&!e.message.includes('private'));
});
