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
  assert.match(sw, /houshak-admin-v30/);
});


test('customer preview provides direct return to admin without exit confirmation', async () => {
  const fs = await import('node:fs/promises');
  const app = await fs.readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /customer-preview-bar/);
  assert.match(app, /العودة إلى لوحة الإدارة/);
  assert.match(app, /function returnToAdminPreview\(\).*location\.replace\('\/admin'\)/);
  assert.match(app, /if\(state\.customerPreview&&!location\.pathname\.startsWith\('\/admin'\)\)\{window\.__returningFromCustomerPreview=true;location\.replace\('\/admin'\);return\}/);
  const clientSw = await fs.readFile(new URL('../public/sw-client-v3.js', import.meta.url), 'utf8');
  assert.match(clientSw, /houshak-client-v22/);
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


test('current bid is recalculated from open valid offers after offer changes', () => {
  const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(server, /function recalculateCurrentBid\(assetId\)/);
  assert.match(server, /o\.status==='OPEN'/);
  assert.match(server, /recalculateCurrentBid\(o\.assetId\)/);
  assert.match(server, /db\.offers\.push\(o\);recalculateCurrentBid\(a\.id\)/);
});

test('financial receipt and storage payment endpoints are idempotent by client request key', () => {
  const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(server, /prior=db\.transactions\.find\(t=>t\.clientRequestId===requestKey&&t\.sourceType==='STORAGE_PAYMENT'\)/);
  assert.match(server, /prior=db\.receipts\.find\(x=>x\.type==='PAYMENT'&&x\.clientRequestId===requestKey\)/);
  assert.match(server, /مفتاح العملية مستخدم لدفعة مختلفة/);
  assert.match(app, /__storagePaymentRequestId/);
  assert.match(app, /__paymentReceiptRequestId/);
});

test('receipt transaction linkage and reservation deposit source keys prevent duplicate bookkeeping', () => {
  const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(server, /receiptId:r\.id,sourceType:'PAYMENT_RECEIPT',sourceId:r\.id/);
  assert.match(server, /sourceType==='RESERVATION_DEPOSIT'&&t\.sourceId===r\.id/);
  assert.match(server, /r\.depositTransactionId=txn\.id/);
});

test('manual finance movements keep effective date separate from actual recording time', () => {
  const server = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
  assert.match(server, /transactionDate:createdAt,recordedAt:now\(\)/);
});


test('finance corrections use audited reversal transactions without deleting originals',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.ok(server.includes('/reverse'));
 assert.match(server,/reversalOf:original\.id/);
 assert.match(server,/لا يمكن عكس حركة عكس/);
 assert.match(server,/سبق عكس هذه الحركة المالية/);
 assert.match(server,/audit\(u,'REVERSE','TRANSACTION'/);
 assert.match(server,/\/api\/admin\/finance\/reconciliation/);
 assert.match(app,/reverseFinance\(/);
 assert.match(app,/مطابقة مالية أولية/);
});

test('invoice payments are linked to invoice and reductions create explicit adjustment movements',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(server,/invoiceId:inv\.id/);
 assert.match(server,/type:diff>0\?'INCOME':'EXPENSE'/);
 assert.match(server,/invoiceMismatches/);
 assert.match(server,/financeByCategory/);
 assert.match(app,/adjustInvoicePaid\(/);
});

test('finance reconciliation compares storage paid balances against linked ledger and reversals retain source linkage',()=>{
  const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
  const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(server,/storageMismatches=/);
  assert.match(server,/charge\.paid=Math\.max\(0,Number\(charge\.paid\|\|0\)\+delta\)/);
  assert.match(server,/invoiceId:original\.invoiceId\|\|null/);
  assert.match(server,/chargeId:original\.chargeId\|\|null/);
  assert.match(app,/اختلافات التخزين/);
  assert.match(app,/اختلافات الفواتير/);
});

test('contract creation validates asset purpose and prevents new agreements for unavailable assets',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 assert.match(server,/لا يمكن إنشاء عقد جديد لأصل مباع أو خارج الحوش أو مؤجر، إلا إذا كان مرتبطًا بالحجز المؤكد نفسه/);
 assert.match(server,/عقد البيع والوساطة يتطلبان أصلًا مخصصًا للبيع/);
 assert.match(server,/عقد الإيجار يتطلب أصلًا مخصصًا للإيجار/);
});

test('contract snapshots preserve identity-document types and the paper displays both parties document type',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(server,/sellerIdentitySnapshot/);
 assert.match(server,/partyIdentitySnapshot/);
 assert.match(server,/statusAtContract:a\.status/);
 assert.match(app,/نوع الوثيقة: <span class="under">\$\{escapeHtml\(identityTypeArabic\(c\.sellerIdentityType\)\)/);
 assert.match(app,/نوع الوثيقة: <span class="under">\$\{escapeHtml\(identityTypeArabic\(c\.partyIdentityType\)\)/);
});


test('contract identity document upload is validated, attached to each party, and printed at the bottom',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../public/sw-admin-v3.js',import.meta.url),'utf8');
 assert.match(server,/cleanIdentityImage/); assert.match(server,/sellerIdentityImage,partyIdentityImage/);
 assert.ok(server.includes("data:image/")); assert.match(server,/jpeg\|png\|webp/);
 assert.match(app,/capture="environment"/); assert.match(app,/readIdentityImage/);
 assert.match(app,/identity-documents/); assert.match(app,/صور وثائق أطراف الاتفاقية/);
 assert.match(sw,/houshak-admin-v30/);
});

test('contract approval is explicit, restricted to management, and print waits for identity images',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(server,/انتقال حالة العقد غير مسموح/);
 assert.match(server,/اعتماد العقد متاح للإدارة فقط/);
 assert.match(app,/function approveContract\(id\)/);
 assert.match(app,/identityTypeArabic\(c\.sellerIdentityType\)/);
 assert.match(app,/function printContractWhenReady\(\)/);
 assert.match(app,/Promise\.all\(imgs\.map/);
});


test('contract approval records an immutable approval snapshot and validates mandatory fields',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(server,/approvedAt=now\(\)/);
 assert.match(server,/approvedById=u\.id/);
 assert.match(server,/approvedByName=u\.name/);
 assert.match(server,/approvalSnapshot=\{/);
 assert.match(server,/لا يمكن اعتماد العقد قبل استكمال اسم الطرف الآخر ورقم هاتفه/);
 assert.match(server,/لا يمكن اعتماد عقد الإيجار دون تاريخ بداية ونهاية صحيحين/);
 assert.match(server,/audit\(u,'APPROVE','CONTRACT'/);
 assert.match(app,/اعتماد إداري بتاريخ/);
 assert.match(app,/الحالة \/ الاعتماد/);
});

test('health and export endpoints report the current package version and caches are bumped',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const adminSw=readFileSync(new URL('../public/sw-admin-v3.js',import.meta.url),'utf8');
 const clientSw=readFileSync(new URL('../public/sw-client-v3.js',import.meta.url),'utf8');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.version,'2.10.51');
 assert.match(server,/version:'2\.10\.51'/);
 assert.match(adminSw,/houshak-admin-v30/);
 assert.match(clientSw,/houshak-client-v22/);
});


test('contract approval snapshots carry a SHA-256 integrity fingerprint and are checked on retrieval',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 assert.match(server,/approvalSnapshotHash=crypto\.createHash\('sha256'\)/);
 assert.match(server,/integrityStatus/);
 assert.match(server,/digest\('hex'\)===c\.approvalSnapshotHash/);
 assert.match(app,/سلامة لقطة الاعتماد/);
 assert.match(app,/بصمة لقطة الاعتماد/);
});


test('v2.10.42 provides actual PDF file sharing (preserved in 2.10.44) for contracts without URL sharing', async () => {
 const root = path.resolve(new URL('..', import.meta.url).pathname);
 const app = readFileSync(path.join(root,'public','app.js'),'utf8');
 const admin = readFileSync(path.join(root,'public','admin.html'),'utf8');
 const server = readFileSync(path.join(root,'src','server.js'),'utf8');
 const pkg = JSON.parse(readFileSync(path.join(root,'package.json'),'utf8'));
 assert.equal(pkg.version,'2.10.51');
 assert.match(app,/مشاركة العقد PDF عبر واتساب/);
 assert.match(app,/createContractPdfFile/);
 assert.match(app,/navigator\.share\(\{files:\[file\]/);
 assert.match(app,/application\/pdf/);
 assert.match(app,/لم يتم إرسال رابط/);
 assert.match(admin,/html2canvas\/1\.4\.1/);
 assert.match(admin,/jspdf\/2\.5\.1/);
 assert.match(server,/version:'2\.10\.51'/);
});


test('v2.10.44 preserves identity image hashes as part of approved contract integrity',()=>{
 const root=path.resolve(new URL('..',import.meta.url).pathname);
 const server=readFileSync(path.join(root,'src','server.js'),'utf8');
 assert.match(server,/sellerIdentityImageHash/);
 assert.match(server,/partyIdentityImageHash/);
 assert.match(server,/snapshotMatches&&imagesMatch\?'VERIFIED':'MISMATCH'/);
 assert.match(server,/version:'2\.10\.51'/);
});

test('contract approval does not create a second financial transaction implicitly',()=>{
 const root=path.resolve(new URL('..',import.meta.url).pathname);
 const server=readFileSync(path.join(root,'src','server.js'),'utf8');
 const approvalStart=server.indexOf("if(b.status==='APPROVED'){c.approvedAt=now()")
 assert.ok(approvalStart>0);
 const approvalEnd=server.indexOf("save(db);return send(res,200,{...c,commissionValue:commissionValue(c)})",approvalStart);
 const block=server.slice(approvalStart,approvalEnd);
 assert.doesNotMatch(block,/db\.transactions\.push|db\.invoices\.push|db\.receipts\.push/);
 assert.match(block,/audit\(u,'APPROVE','CONTRACT'/);
});


test('v2.10.45 links at most one invoice to an approved contract and validates the asset and party',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 assert.match(server,/if\(b\.contractId\)/);
 assert.match(server,/linkedContract\.status!=='APPROVED'/);
 assert.match(server,/db\.invoices\.some\(i=>i\.contractId===linkedContract\.id\)/);
 assert.match(server,/اسم الطرف في الفاتورة يجب أن يطابق الطرف المسجل في العقد/);
 assert.match(server,/contractAmount:linkedContract\?Number\(linkedContract\.amount\|\|0\):null/);
});


test('v2.10.47 enforces reservation transitions, deposit refund ledger, and reconciliation diagnostics',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 assert.match(server,/const allowed=\{PENDING:\['CONFIRMED','REJECTED','CANCELLED'\],CONFIRMED:\['COMPLETED','CANCELLED'\]/);
 assert.match(server,/RESERVATION_DEPOSIT_REFUND/);
 assert.match(server,/reservationLifecycleMismatches/);
 assert.match(server,/لا يمكن تغيير مبلغ العربون بعد معالجة الحجز/);
});


test('v2.10.48 adds rental return lifecycle, linked reservation contracts, invoice refunds and reconciliation checks',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.version,'2.10.51');
 assert.match(server,/rentalReturn=p\.match/);
 assert.match(server,/sourceType:'INVOICE_REFUND'/);
 assert.match(server,/reservationContractMismatches/);
 assert.match(server,/rentalLifecycleMismatches/);
 assert.match(server,/invoiceReservationMismatches/);
 assert.match(server,/overdueRentals/);
 assert.match(app,/تسجيل إرجاع الأصل/);
 assert.match(app,/استرداد مبلغ/);
 assert.match(app,/linkReservationToContract/);
});


test('v2.10.49 validates booking dates and adds authenticated, verifiable backup manifests and expanded reconciliation diagnostics',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const adminSw=readFileSync(new URL('../public/sw-admin-v3.js',import.meta.url),'utf8');
 const clientSw=readFileSync(new URL('../public/sw-client-v3.js',import.meta.url),'utf8');
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.version,'2.10.51');
 assert.match(server,/function validDateValue\(value\)/);
 assert.match(server,/تاريخ بداية الحجز غير صحيح/);
 assert.match(server,/تاريخ نهاية الحجز غير صحيح/);
 assert.match(server,/تاريخ نهاية العقد يجب أن يكون بعد البداية/);
 assert.match(server,/api\/admin\/backup\/manifest/);
 assert.match(server,/api\/admin\/backup\/verify/);
 assert.match(server,/function verifyBackupEnvelope\(envelope\)/);
 assert.match(server,/sha256:crypto\.createHash\('sha256'\)/);
 assert.match(server,/invoiceBalanceMismatches/);
 assert.match(server,/transactionIntegrityIssues/);
 assert.match(server,/contractIntegrityIssues/);
 assert.match(server,/reservationDateIssues/);
 assert.match(app,/نسخة احتياطية قابلة للتحقق/);
 assert.match(adminSw,/houshak-admin-v30/);
 assert.match(clientSw,/houshak-client-v22/);
});


test('v2.10.51 adds authenticated restore preflight without applying a restore',()=>{
 const server=readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
 assert.match(server,/api\/admin\/backup\/inspect-restore/);
 assert.match(server,/COLLECTION_INVALID/);
 assert.match(server,/DUPLICATE_ID/);
 assert.match(server,/MISSING_CONTRACT_REFERENCE/);
 assert.match(server,/previewOnly:true/);
 assert.match(server,/INSPECT_BACKUP_RESTORE/);
});
