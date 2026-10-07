import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveVisibility} from '../src/testable.js';

test('release candidate visibility matches production rules',()=>{
  assert.equal(deriveVisibility('SALE','ACTIVE','AUTO'),true);
  assert.equal(deriveVisibility('SALE','RESERVED','AUTO'),false);
  assert.equal(deriveVisibility('SALE','RESERVED','SHOW'),false);
  assert.equal(deriveVisibility('SALE','SOLD','SHOW'),false);
  assert.equal(deriveVisibility('STORAGE','ACTIVE','AUTO'),false);
});

import { readFileSync } from 'node:fs';

test('admin exposes customer preview and preview hides admin controls',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/معاينة كعميل/);
  assert.match(app,/customerPreview\(\)/);
  assert.match(app,/state\.me&&!state\.customerPreview/);
});

test('customer location settings and secure admin logout are wired',()=>{
  const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(server,/latitude:setting\('latitude'/);
  assert.match(server,/longitude:setting\('longitude'/);
  assert.match(server,/mapsUrl:setting\('mapsUrl'/);
  assert.match(server,/'latitude','longitude','mapsUrl'/);
  assert.match(app,/الخروج النهائي من التطبيق/);
  assert.match(app,/localStorage\.removeItem\('houshakAuth'\)/);
  assert.match(app,/الوصول إلى موقع الحوش/);
});

test('current bid is optional, separate from asking price, and public-facing',()=>{
  const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(server,/currentBid/);
  assert.match(server,/currentBidAt/);
  assert.match(server,/قيمة السوم غير صحيحة/);
  assert.match(app,/السوم الحالي/);
  assert.match(app,/سعر البيع المطلوب/);
  assert.match(app,/currentBid:\$\('#acb'\)\?\.value\|\|null/);
});
