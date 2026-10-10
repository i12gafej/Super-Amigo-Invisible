import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {newToken,hashToken,sealToken,openToken,signSession,readSession} from '../lib/crypto.ts';
process.env.TOKEN_ENCRYPTION_KEY=randomBytes(32).toString('hex');
process.env.SESSION_SECRET=randomBytes(32).toString('hex');
test('token aleatorio y cifrado autenticado recuperable',()=>{const token=newToken(),cipher=sealToken(token);assert.equal(token.length,43);assert.notEqual(hashToken(token),token);assert.equal(hashToken(token).length,64);assert.equal(openToken(cipher),token);assert.notEqual(sealToken(token),cipher);const damaged=Buffer.from(cipher,'base64url');damaged[30]^=1;assert.throws(()=>openToken(damaged.toString('base64url')));});
test('sesión firmada rechaza manipulación y caducidad',()=>{const s={role:'admin' as const,room:'test',exp:Date.now()+10000};const signed=signSession(s);assert.deepEqual(readSession(signed),s);assert.equal(readSession(signed+'x'),null);assert.equal(readSession(signSession({...s,exp:0})),null);assert.equal(readSession('garbage'),null);});
