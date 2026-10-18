import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, cp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function freePort(){
  const s=net.createServer();
  await new Promise((resolve,reject)=>s.listen(0,'127.0.0.1',resolve).once('error',reject));
  const port=s.address().port;
  await new Promise(resolve=>s.close(resolve));
  return port;
}

test('HTTP integration: create asset → create contract → approve → verify integrity → block edits', {timeout:30000}, async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'houshak-contract-test-'));
  let child;
  try{
    await cp(sourceRoot,root,{recursive:true,filter:(src)=>{
      const rel=path.relative(sourceRoot,src);
      return !rel.startsWith('node_modules')&&!rel.startsWith('.git')&&!rel.startsWith('uploads')&&!rel.startsWith('data/db.json');
    }});
    execFileSync(process.execPath,['src/seed.js'],{cwd:root,stdio:'ignore'});
    const port=await freePort();
    child=spawn(process.execPath,['src/server.js'],{cwd:root,env:{...process.env,PORT:String(port),NODE_ENV:'test'},stdio:'ignore'});
    t.after(async()=>{if(child&&!child.killed){child.kill('SIGTERM');await delay(100)}});
    const base=`http://127.0.0.1:${port}`;
    let ready=false,healthPayload=null;
    for(let i=0;i<80;i++){
      try{const r=await fetch(`${base}/api/health`);if(r.ok){healthPayload=await r.json();ready=true;break}}catch{}
      await delay(100);
    }
    assert.equal(ready,true,'server should start on isolated test database');
    assert.equal(healthPayload.version,'2.10.51');
    const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone:'0500000000',password:'Admin@12345'})});
    assert.equal(login.status,200);
    const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
    assert.match(cookie,/^token=/);
    const api=async(pathname,options={})=>fetch(`${base}${pathname}`,{...options,headers:{cookie,'content-type':'application/json',...(options.headers||{})}});
    const unauthManifest=await fetch(`${base}/api/admin/backup/manifest`);assert.equal(unauthManifest.status,401,'backup manifest must require authentication');
    const manifestResponse=await api('/api/admin/backup/manifest');assert.equal(manifestResponse.status,200);const manifest=await manifestResponse.json();assert.equal(manifest.appVersion,'2.10.51');assert.match(manifest.sha256,/^[a-f0-9]{64}$/);assert.ok(manifest.collectionCounts.assets>=0);
    const backupResponse=await api('/api/admin/export');assert.equal(backupResponse.status,200);const backup=await backupResponse.json();assert.equal(backup.version,'2.10.51');assert.equal(backup.manifest.sha256,crypto.createHash('sha256').update(JSON.stringify(backup.data)).digest('hex'),'backup digest should match exported database payload');
    const verifyBackup=await api('/api/admin/backup/verify',{method:'POST',body:JSON.stringify(backup)});assert.equal(verifyBackup.status,200);const verifyBackupData=await verifyBackup.json();assert.equal(verifyBackupData.valid,true);assert.equal(verifyBackupData.sha256,backup.manifest.sha256);
    const inspectRestore=await api('/api/admin/backup/inspect-restore',{method:'POST',body:JSON.stringify(backup)});assert.equal(inspectRestore.status,200);const inspectData=await inspectRestore.json();assert.equal(inspectData.restorable,true);assert.equal(inspectData.previewOnly,true);assert.match(inspectData.notice,/لم تُستعد البيانات/);
    const malformedBackup=structuredClone(backup);malformedBackup.data.assets='not-an-array';malformedBackup.manifest.sha256=crypto.createHash('sha256').update(JSON.stringify(malformedBackup.data)).digest('hex');malformedBackup.manifest.bytes=Buffer.byteLength(JSON.stringify(malformedBackup.data),'utf8');const inspectMalformed=await api('/api/admin/backup/inspect-restore',{method:'POST',body:JSON.stringify(malformedBackup)});assert.equal(inspectMalformed.status,422);assert.equal((await inspectMalformed.json()).restorable,false);
    const unauthInspect=await fetch(`${base}/api/admin/backup/inspect-restore`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(backup)});assert.equal(unauthInspect.status,401);
    const tamperedBackup={...backup,data:{...backup.data,settings:[...(backup.data.settings||[]),{id:'tampered',key:'tampered',value:'x'}]}};const verifyTampered=await api('/api/admin/backup/verify',{method:'POST',body:JSON.stringify(tamperedBackup)});assert.equal(verifyTampered.status,422);assert.equal((await verifyTampered.json()).reason,'HASH_MISMATCH');
    const unauthVerify=await fetch(`${base}/api/admin/backup/verify`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(backup)});assert.equal(unauthVerify.status,401);
    const categoriesResponse=await api('/api/admin/categories');
    assert.equal(categoriesResponse.status,200);
    const categories=await categoriesResponse.json();
    const category=categories.find(x=>x.slug==='vehicles');
    assert.ok(category,'seed should include vehicle category');
    const assetResponse=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:'',ownerType:'USER',yardId:'demo-yard',purpose:'SALE',title:'أصل اختبار العقد',salePrice:125000,make:'اختبار',model:'2026'})});
    // Use the authenticated administrator as the asset owner when a seeded account is required.
    let assetData=await assetResponse.json();
    let assetId=assetData.id;
    if(assetResponse.status!==201){
      const me=await api('/api/auth/me');
      const meData=await me.json();
      const retry=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:meData.user.id,ownerType:'USER',yardId:'demo-yard',purpose:'SALE',title:'أصل اختبار العقد',salePrice:125000,make:'اختبار',model:'2026'})});
      assert.equal(retry.status,201,JSON.stringify(await retry.clone().json()));
      assetData=await retry.json();assetId=assetData.id;
    }
    assert.ok(assetId);
    const invalidDateReservation=await fetch(`${base}/api/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assetId,name:'عميل اختبار',phone:'0501234567',fromAt:'not-a-date',toAt:'also-not-a-date'})});assert.equal(invalidDateReservation.status,400,'invalid reservation dates must be rejected');
    const tinyImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT9sAAAAASUVORK5CYII=';
    const contractResponse=await api('/api/admin/contracts',{method:'POST',body:JSON.stringify({assetId,type:'SALE',partyName:'طرف اختبار',partyPhone:'0501111111',partyIdentityType:'PASSPORT',partyIdentityNumber:'P123',amount:125000,terms:'اختبار دورة العقد',sellerIdentityImage:tinyImage,partyIdentityImage:tinyImage})});
    assert.equal(contractResponse.status,201,JSON.stringify(await contractResponse.clone().json()));
    const contract=await contractResponse.json();
    const approveResponse=await api(`/api/admin/contracts/${contract.id}`,{method:'PUT',body:JSON.stringify({status:'APPROVED'})});
    assert.equal(approveResponse.status,200,JSON.stringify(await approveResponse.clone().json()));
    const approved=await approveResponse.json();
    assert.equal(approved.status,'APPROVED');
    assert.ok(approved.approvalSnapshotHash);
    assert.ok(approved.approvedAt);
    assert.ok(approved.approvedById);
    const contractsResponse=await api('/api/admin/contracts');
    assert.equal(contractsResponse.status,200);
    const saved=(await contractsResponse.json()).find(x=>x.id===contract.id);
    assert.equal(saved.integrityStatus,'VERIFIED');
    assert.equal(saved.partyIdentityImage,tinyImage);
    const editResponse=await api(`/api/admin/contracts/${contract.id}`,{method:'PUT',body:JSON.stringify({partyName:'اسم معدل بعد الاعتماد'})});
    assert.equal(editResponse.status,409);
    const conflictingContractResponse=await api('/api/admin/contracts',{method:'POST',body:JSON.stringify({assetId,type:'SALE',partyName:'طرف ثانٍ',partyPhone:'0502222222',amount:125000,terms:'اختبار تعارض عقد'})});
    assert.equal(conflictingContractResponse.status,201);
    const conflictingContract=await conflictingContractResponse.json();
    const conflictingApproval=await api(`/api/admin/contracts/${conflictingContract.id}`,{method:'PUT',body:JSON.stringify({status:'APPROVED'})});
    assert.equal(conflictingApproval.status,409,'a second approved sale/rent agreement for the same asset must be blocked');
    const wrongTypeInvoice=await api('/api/admin/invoices',{method:'POST',body:JSON.stringify({contractId:contract.id,assetId,partyName:'طرف اختبار',type:'RENT',subtotal:125000,paid:0})});
    assert.equal(wrongTypeInvoice.status,409,'invoice type must agree with the linked contract type');
    const invoiceResponse=await api('/api/admin/invoices',{method:'POST',body:JSON.stringify({contractId:contract.id,assetId,partyName:'طرف اختبار',partyPhone:'0501111111',subtotal:125000,discount:0,tax:0,paid:5000,notes:'فاتورة مرتبطة بعقد اختبار'})});
    assert.equal(invoiceResponse.status,201,JSON.stringify(await invoiceResponse.clone().json()));
    const invoice=await invoiceResponse.json();
    assert.equal(invoice.contractId,contract.id);
    assert.equal(invoice.contractCode,contract.code);
    assert.equal(invoice.assetId,assetId);
    assert.equal(invoice.balance,120000);
    const duplicateInvoice=await api('/api/admin/invoices',{method:'POST',body:JSON.stringify({contractId:contract.id,assetId,partyName:'طرف اختبار',subtotal:125000,paid:0})});
    assert.equal(duplicateInvoice.status,409,'only one invoice may be linked to a contract');
    const invoicesResponse=await api('/api/admin/invoices');
    assert.equal(invoicesResponse.status,200);
    const listedInvoice=(await invoicesResponse.json()).find(x=>x.id===invoice.id);
    assert.equal(listedInvoice.contract.code,contract.code);
    const paymentKey='integration-payment-001';
    const paymentResponse=await api(`/api/admin/invoices/${invoice.id}/payments`,{method:'POST',body:JSON.stringify({amount:1000,clientRequestId:paymentKey})});
    assert.equal(paymentResponse.status,201,JSON.stringify(await paymentResponse.clone().json()));
    const payment=await paymentResponse.json();
    assert.equal(payment.invoice.paid,6000);
    assert.equal(payment.invoice.balance,119000);
    const replayPayment=await api(`/api/admin/invoices/${invoice.id}/payments`,{method:'POST',body:JSON.stringify({amount:1000,clientRequestId:paymentKey})});
    assert.equal(replayPayment.status,200);
    assert.equal((await replayPayment.json()).idempotentReplay,true);
    const conflictingReplay=await api(`/api/admin/invoices/${invoice.id}/payments`,{method:'POST',body:JSON.stringify({amount:2000,clientRequestId:paymentKey})});
    assert.equal(conflictingReplay.status,409);
    const excessivePayment=await api(`/api/admin/invoices/${invoice.id}/payments`,{method:'POST',body:JSON.stringify({amount:200000,clientRequestId:'integration-payment-too-large'})});
    assert.equal(excessivePayment.status,409);
    const refundKey='integration-refund-001';
    const refundResponse=await api(`/api/admin/invoices/${invoice.id}/refunds`,{method:'POST',body:JSON.stringify({amount:500,reason:'تصحيح مبلغ مدفوع',clientRequestId:refundKey})});
    assert.equal(refundResponse.status,201,JSON.stringify(await refundResponse.clone().json()));
    const refunded=await refundResponse.json();
    assert.equal(refunded.invoice.paid,5500);
    assert.equal(refunded.invoice.balance,119500);
    assert.equal(refunded.transaction.type,'EXPENSE');
    const refundReplay=await api(`/api/admin/invoices/${invoice.id}/refunds`,{method:'POST',body:JSON.stringify({amount:500,reason:'تصحيح مبلغ مدفوع',clientRequestId:refundKey})});
    assert.equal(refundReplay.status,200);
    assert.equal((await refundReplay.json()).idempotentReplay,true);
    const conflictingRefund=await api(`/api/admin/invoices/${invoice.id}/refunds`,{method:'POST',body:JSON.stringify({amount:700,reason:'تصحيح مبلغ مدفوع',clientRequestId:refundKey})});
    assert.equal(conflictingRefund.status,409);
    const excessiveRefund=await api(`/api/admin/invoices/${invoice.id}/refunds`,{method:'POST',body:JSON.stringify({amount:6000,reason:'مبلغ زائد للاسترداد',clientRequestId:'integration-refund-too-large'})});
    assert.equal(excessiveRefund.status,409);

    const reconciliationResponse=await api('/api/admin/finance/reconciliation');
    assert.equal(reconciliationResponse.status,200);
    const reconciliation=await reconciliationResponse.json();
    assert.equal(reconciliation.contractInvoiceMismatches.length,0);
    assert.equal(reconciliation.invoiceMismatches.length,0);
    for(const key of ['invoiceBalanceMismatches','transactionIntegrityIssues','contractIntegrityIssues','reservationDateIssues','duplicateInvoiceNumbers'])assert.ok(Array.isArray(reconciliation[key]),`reconciliation should include ${key}`);
    const exportResponse=await api('/api/admin/export');
    assert.equal(exportResponse.status,200);
    const exported=(await exportResponse.json()).data;
    assert.equal(exported.contracts.find(x=>x.id===contract.id).partyName,'طرف اختبار');
    assert.equal((exported.transactions||[]).length,3,'initial payment, one idempotent follow-up payment, and one invoice refund create exactly three financial transactions');
    assert.ok(exported.transactions.every(t=>t.invoiceId===invoice.id));
    assert.equal(exported.transactions.filter(t=>t.clientRequestId===paymentKey).length,1,'idempotent retry must not duplicate the ledger entry');
    assert.equal((exported.invoices||[]).length,1,'invoice is created explicitly, not implicitly by contract approval');

    // Reservation lifecycle: confirm books the asset and posts one deposit; cancellation refunds it once and releases the asset.
    const reserveAssetResponse=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:'',ownerType:'USER',yardId:'demo-yard',purpose:'SALE',title:'أصل اختبار الحجز',salePrice:45000,make:'اختبار',model:'2026'})});
    let reserveAsset=await reserveAssetResponse.json();
    if(reserveAssetResponse.status!==201){
      const me=await api('/api/auth/me');const meData=await me.json();
      const retry=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:meData.user.id,ownerType:'USER',yardId:'demo-yard',purpose:'SALE',title:'أصل اختبار الحجز',salePrice:45000,make:'اختبار',model:'2026'})});
      assert.equal(retry.status,201,JSON.stringify(await retry.clone().json()));reserveAsset=await retry.json();
    }
    const reservationResponse=await fetch(`${base}/api/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assetId:reserveAsset.id,name:'عميل حجز اختبار',phone:'0503333333'})});
    assert.equal(reservationResponse.status,201,JSON.stringify(await reservationResponse.clone().json()));
    const reservation=await reservationResponse.json();
    const confirmReservation=await api(`/api/admin/reservations/${reservation.id}`,{method:'PUT',body:JSON.stringify({status:'CONFIRMED',agreedAmount:45000,depositAmount:5000})});
    assert.equal(confirmReservation.status,200,JSON.stringify(await confirmReservation.clone().json()));
    assert.equal((await confirmReservation.json()).status,'CONFIRMED');
    const confirmedAsset=await api(`/api/admin/assets/${reserveAsset.id}`);
    assert.equal(confirmedAsset.status,200);
    assert.equal((await confirmedAsset.json()).status,'RESERVED');
    const cancelled=await api(`/api/admin/reservations/${reservation.id}`,{method:'PUT',body:JSON.stringify({status:'CANCELLED'})});
    assert.equal(cancelled.status,200,JSON.stringify(await cancelled.clone().json()));
    const cancelledData=await cancelled.json();
    assert.ok(cancelledData.depositRefundTransactionId);
    const terminalRepeat=await api(`/api/admin/reservations/${reservation.id}`,{method:'PUT',body:JSON.stringify({status:'CANCELLED'})});
    assert.equal(terminalRepeat.status,409,'terminal reservation cannot be processed twice');
    const reserveAssetAfterCancel=await api(`/api/admin/assets/${reserveAsset.id}`);
    assert.equal((await reserveAssetAfterCancel.json()).status,'ACTIVE');
    const exportAfterReservation=await api('/api/admin/export');
    const exportedAfterReservation=(await exportAfterReservation.json()).data;
    const depositTxns=exportedAfterReservation.transactions.filter(t=>t.sourceType==='RESERVATION_DEPOSIT'&&t.sourceId===reservation.id);
    const refundTxns=exportedAfterReservation.transactions.filter(t=>t.sourceType==='RESERVATION_DEPOSIT_REFUND'&&t.sourceId===reservation.id);
    assert.equal(depositTxns.length,1);
    assert.equal(refundTxns.length,1);
    assert.equal(refundTxns[0].type,'EXPENSE');
    // Rental lifecycle: reservation → linked approved contract → invoice → handover → return.
    const rentAssetResponse=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:'',ownerType:'USER',yardId:'demo-yard',purpose:'RENT',title:'أصل اختبار دورة الإيجار',salePrice:25000,make:'اختبار',model:'2026'})});
    let rentAsset=await rentAssetResponse.json();
    if(rentAssetResponse.status!==201){const me=await api('/api/auth/me');const meData=await me.json();const retry=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:meData.user.id,ownerType:'USER',yardId:'demo-yard',purpose:'RENT',title:'أصل اختبار دورة الإيجار',salePrice:25000,make:'اختبار',model:'2026'})});assert.equal(retry.status,201,JSON.stringify(await retry.clone().json()));rentAsset=await retry.json();}
    const rentFrom=new Date(Date.now()+3600000).toISOString(),rentTo=new Date(Date.now()+86400000).toISOString();
    const rentReservationResponse=await fetch(`${base}/api/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assetId:rentAsset.id,name:'عميل إيجار اختبار',phone:'0504444444',fromAt:rentFrom,toAt:rentTo})});
    assert.equal(rentReservationResponse.status,201,JSON.stringify(await rentReservationResponse.clone().json()));
    const rentReservation=await rentReservationResponse.json();
    const rentConfirm=await api(`/api/admin/reservations/${rentReservation.id}`,{method:'PUT',body:JSON.stringify({status:'CONFIRMED',agreedAmount:25000,depositAmount:5000})});
    assert.equal(rentConfirm.status,200,JSON.stringify(await rentConfirm.clone().json()));
    const rentContractResponse=await api('/api/admin/contracts',{method:'POST',body:JSON.stringify({assetId:rentAsset.id,reservationId:rentReservation.id,type:'RENT',partyName:'عميل إيجار اختبار',partyPhone:'0504444444',amount:25000,startAt:rentFrom,endAt:rentTo,terms:'عقد إيجار للاختبار'})});
    assert.equal(rentContractResponse.status,201,JSON.stringify(await rentContractResponse.clone().json()));
    const rentContract=await rentContractResponse.json();
    const rentApprove=await api(`/api/admin/contracts/${rentContract.id}`,{method:'PUT',body:JSON.stringify({status:'APPROVED'})});
    assert.equal(rentApprove.status,200,JSON.stringify(await rentApprove.clone().json()));
    const linkedRentInvoice=await api('/api/admin/invoices',{method:'POST',body:JSON.stringify({contractId:rentContract.id,reservationId:rentReservation.id,assetId:rentAsset.id,partyName:'عميل إيجار اختبار',partyPhone:'0504444444',type:'RENT',subtotal:25000,paid:0})});
    assert.equal(linkedRentInvoice.status,201,JSON.stringify(await linkedRentInvoice.clone().json()));
    const rentInvoice=await linkedRentInvoice.json();assert.equal(rentInvoice.reservationId,rentReservation.id);
    const rentComplete=await api(`/api/admin/reservations/${rentReservation.id}`,{method:'PUT',body:JSON.stringify({status:'COMPLETED'})});
    assert.equal(rentComplete.status,200,JSON.stringify(await rentComplete.clone().json()));
    const rentCompleteData=await rentComplete.json();assert.equal(rentCompleteData.rentalStatus,'ACTIVE');assert.equal(rentCompleteData.assetStatus,'RENTED');
    const rentReturn=await api(`/api/admin/reservations/${rentReservation.id}/return`,{method:'POST',body:JSON.stringify({note:'عاد الأصل بحالة جيدة'})});
    assert.equal(rentReturn.status,200,JSON.stringify(await rentReturn.clone().json()));assert.equal((await rentReturn.json()).assetStatus,'ACTIVE');
    const duplicateRentReturn=await api(`/api/admin/reservations/${rentReservation.id}/return`,{method:'POST',body:JSON.stringify({note:'محاولة مكررة'})});assert.equal(duplicateRentReturn.status,409);
    const rentAssetAfterReturn=await api(`/api/admin/assets/${rentAsset.id}`);assert.equal((await rentAssetAfterReturn.json()).status,'ACTIVE');

    const reconciliationAfterReservation=await api('/api/admin/finance/reconciliation');
    assert.equal(reconciliationAfterReservation.status,200);
    const reconciliationData=await reconciliationAfterReservation.json();
    assert.ok(Array.isArray(reconciliationData.reservationLifecycleMismatches));
    assert.ok(Array.isArray(reconciliationData.reservationContractMismatches));
    assert.ok(Array.isArray(reconciliationData.rentalLifecycleMismatches));
    assert.equal(reconciliationData.rentalLifecycleMismatches.some(x=>x.reservationId===rentReservation.id),false);
    assert.equal(reconciliationData.reservationContractMismatches.some(x=>x.contractId===rentContract.id),false);
    assert.equal(reconciliationData.reservationLifecycleMismatches.some(x=>x.reservationId===reservation.id),false);

  } finally {
    if(child&&!child.killed)child.kill('SIGTERM');
    await rm(root,{recursive:true,force:true});
  }
});
