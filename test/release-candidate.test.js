import {readFileSync} from 'node:fs';
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
  assert.match(sw, /houshak-admin-v12/);
});


test('customer preview provides direct return to admin without exit confirmation', async () => {
  const fs = await import('node:fs/promises');
  const app = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /customer-preview-bar/);
  assert.match(app, /العودة إلى لوحة الإدارة/);
  assert.match(app, /function returnToAdminPreview\(\).*location\.replace\('\/admin'\)/);
  assert.match(app, /if\(state\.customerPreview&&!location\.pathname\.startsWith\('\/admin'\)\)\{window\.__returningFromCustomerPreview=true;location\.replace\('\/admin'\);return\}/);
  const clientSw = await fs.readFile(new URL('../public/sw-client-v3.js', import.meta.url), 'utf8');
  assert.match(clientSw, /houshak-client-v9/);
});


test('finance transaction supports a selectable historical date and customer gallery is compact and zoomable', async () => {
  const fs = await import('node:fs/promises');
  const app = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const server = await fs.readFile(new URL('../src/server.js', import.meta.url), 'utf8');
  const css = await fs.readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(app, /id="fdate" class="input" type="datetime-local" value="\$\{defaultDate\}"/);
  assert.match(app, /createdAt:createdAt\.toISOString\(\)/);
  assert.match(server, /if\(b\.createdAt!==undefined&&b\.createdAt!==null&&b\.createdAt!==''\)/);
  assert.match(app, /class="gallery-zoom"/);
  assert.match(css, /gallery-zoom/);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});


test('settings save asks for confirmation and admin tabs preserve horizontal scroll', async () => {
  const fs = await import('node:fs/promises');
  const app = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /async function saveSettings\(\)\{if\(!confirm\('هل أنت متأكد من حفظ التغييرات على إعدادات النظام ومحتوى المنصة؟'\)\)return;/);
  assert.match(app, /const previousTabsScroll=document\.querySelector\('\.tabs'\)\?\.scrollLeft\|\|0/);
  assert.match(app, /current\.scrollLeft=previousTabsScroll/);
});


test('sale price supports ON_BID mode across admin, public listings, QR page and receipt',()=>{
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
  const publicAsset=readFileSync(new URL('../public/asset.html',import.meta.url),'utf8');
  const receipt=readFileSync(new URL('../public/receipt.html',import.meta.url),'utf8');
  assert.ok(app.includes('value="ON_BID"') && app.includes('>على السوم</option>'));
  assert.match(app,/salePriceMode:/);
  assert.match(app,/a\.salePriceMode==='ON_BID'.{0,100}على السوم/s);
  assert.match(server,/salePrice:clean\.salePriceMode==='ON_BID'/);
  assert.match(server,/a\.salePriceMode=\['SALE','SALE_RENT'\]\.includes\(a\.purpose\)&&b\.salePriceMode==='ON_BID'/);
  assert.match(publicAsset,/a\.salePriceMode==='ON_BID'.{0,100}على السوم/s);
  assert.match(receipt,/d\.salePriceMode==='ON_BID'.{0,100}على السوم/s);
});

import {hashPassword,verifyPassword,isLegacyPasswordHash} from '../src/db.js';
test('password hashes use salted scrypt and verify correctly',()=>{const h=hashPassword('Strong-test-123');assert.ok(h.startsWith('scrypt$'));assert.equal(verifyPassword('Strong-test-123',h),true);assert.equal(verifyPassword('wrong',h),false);assert.notEqual(h,hashPassword('Strong-test-123'));assert.equal(isLegacyPasswordHash(h),false)});
test('legacy SHA-256 passwords remain verifiable during migration',async()=>{const {default:crypto}=await import('node:crypto');const legacy=crypto.createHash('sha256').update('legacy-pass').digest('hex');assert.equal(verifyPassword('legacy-pass',legacy),true);assert.equal(isLegacyPasswordHash(legacy),true)});
test('public asset response excludes internal plate, entry timestamp, and private notes',()=>{const s=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');assert.match(s,/plateNumber:''/);assert.match(s,/locationCode:''/);assert.match(s,/entryAt:null/);assert.match(s,/publicCustomFields\(a\.customFields\|\|\{\}\)/);assert.doesNotMatch(s,/customFields:\{\.\.\.\(a\.customFields\|\|\{\}\)\},category:c/)});
test('contract forms cover sale rent storage and brokerage with phone snapshots',()=>{const s=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');for(const t of ['SALE','RENT','STORAGE','BROKERAGE_SALE'])assert.ok(s.includes(t));assert.match(s,/sellerPhone:o\?\.phone/);assert.match(s,/partyPhone:String\(b\.partyPhone\)/);assert.match(app,/معاينة \/ طباعة/);assert.match(app,/رقم هاتف البائع/)});
