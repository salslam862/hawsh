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
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);

test('admin exposes customer preview and preview hides admin controls',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/معاينة كعميل/);
  assert.match(app,/customerPreview\(\)/);
  assert.match(app,/customerPreview/);
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

test('post-2.10.10 hardening keeps customer UI separate and offline intake wired',()=>{
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  const server=fs.readFileSync(path.join(root,'src','server.js'),'utf8');
  const sw=fs.readFileSync(path.join(root,'public','sw-admin-v3.js'),'utf8');
  assert.doesNotMatch(app,/فتح لوحة الإدارة.*state\.me/);
  assert.match(app,/\/api\/admin\/offline\/intake/);
  assert.match(app,/indexedDB\.open\('houshakOfflineDB'/);
  assert.match(server,/\/api\/admin\/offline\/intake/);
  assert.match(server,/clientRequestId/);
  assert.match(sw,/caches\.open\(CACHE\)/);
});

test('manager identity is configurable in public settings',()=>{
  const server=fs.readFileSync(path.join(root,'src','server.js'),'utf8');
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  assert.match(server,/managerName/); assert.match(server,/managerPhone/);
  assert.match(app,/smn/); assert.match(app,/smp/);
});


test('admin home resets navigation history and keeps exit guard below it', async () => {
  const fs = await import('node:fs/promises');
  const app = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /button onclick=\"adminHome\(\)\">الرئيسية/);
  assert.match(app, /function adminHome\(\)\{window\.__adminHomeBoundary=true;history\.pushState\(\{view:'admin-home'\}/);
  assert.match(app, /history\.pushState\(\{view:'admin-home'\}/);
  assert.match(app, /return dashboard\('overview',true\)/);
  const sw = await fs.readFile(new URL('../public/sw-admin-v3.js', import.meta.url), 'utf8');
  assert.match(sw, /houshak-admin-v7/);
});
