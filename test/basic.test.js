import test from 'node:test';import assert from 'node:assert/strict';import {deriveVisibility} from '../src/server.js';
test('AUTO storage hidden',()=>assert.equal(deriveVisibility('STORAGE','ACTIVE','AUTO'),false));
test('AUTO sale visible',()=>assert.equal(deriveVisibility('SALE','ACTIVE','AUTO'),true));
test('AUTO rent visible',()=>assert.equal(deriveVisibility('RENT','ACTIVE','AUTO'),true));
test('AUTO sale+rent visible',()=>assert.equal(deriveVisibility('SALE_RENT','ACTIVE','AUTO'),true));
test('sold hidden',()=>assert.equal(deriveVisibility('SALE','SOLD','AUTO'),false));
test('rented hidden',()=>assert.equal(deriveVisibility('RENT','RENTED','AUTO'),false));
test('exited hidden',()=>assert.equal(deriveVisibility('SALE','EXITED','AUTO'),false));
test('manual hide',()=>assert.equal(deriveVisibility('SALE','ACTIVE','HIDE'),false));
test('manual show cannot override exited',()=>assert.equal(deriveVisibility('SALE','EXITED','SHOW'),false));

test('reserved sale hidden',()=>assert.equal(deriveVisibility('SALE','RESERVED','AUTO'),false));
test('reserved rent hidden',()=>assert.equal(deriveVisibility('RENT','RESERVED','AUTO'),false));
test('manual show cannot override reserved',()=>assert.equal(deriveVisibility('SALE','RESERVED','SHOW'),false));
