import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ApiError,field,uuidField,passwordField} from '../lib/validation.ts';
test('las contraseñas preservan espacios y respetan el límite UTF-8 de bcrypt',()=>{
 assert.equal(passwordField({password:'  clave  '}),'  clave  ');
 assert.equal(passwordField({password:'á'.repeat(36)}).length,36);
 assert.throws(()=>passwordField({password:'á'.repeat(37)}),ApiError);
 assert.throws(()=>passwordField({password:''}),ApiError);
});
test('los identificadores no permiten inyectar filtros PostgREST',()=>{
 assert.equal(uuidField({id:'11111111-1111-4111-8111-111111111111'},'id'),'11111111-1111-4111-8111-111111111111');
 assert.throws(()=>uuidField({id:'11111111-1111-4111-8111-111111111111&or=(room_id.eq.other)'},'id'),ApiError);
 assert.throws(()=>uuidField({id:'invalid'},'id'),ApiError);
});
test('las entradas rechazan tipos inesperados y límites excedidos',()=>{
 assert.equal(field({name:'  Ana  '},'name',2,80),'Ana');
 assert.throws(()=>field({name:null},'name',2,80),ApiError);
 assert.throws(()=>field({name:'  '},'name',2,80),ApiError);
 assert.throws(()=>field({wishlist:'a'.repeat(4001)},'wishlist'),ApiError);
 assert.equal(field({wishlist:''},'wishlist'),'');
});
