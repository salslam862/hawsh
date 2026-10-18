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
    assert.equal(healthPayload.version,'2.10.73');
    const login=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone:'0500000000',password:'Admin@12345'})});
    assert.equal(login.status,200);
    const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
    assert.match(cookie,/^token=/);
    const api=async(pathname,options={})=>fetch(`${base}${pathname}`,{...options,headers:{cookie,'content-type':'application/json',...(options.headers||{})}});
    const managerCreate=await api('/api/admin/users',{method:'POST',body:JSON.stringify({name:'مدير اختبار',phone:'0507776601',password:'Manager@12345',role:'MANAGER',active:true})});assert.equal(managerCreate.status,201,'admin should be able to create a manager');const managerCreatedData=await managerCreate.json();assert.equal(managerCreatedData.role,'MANAGER');const duplicateManager=await api('/api/admin/users',{method:'POST',body:JSON.stringify({name:'تغيير غير مقصود',phone:'0507776601',password:'Other@12345',role:'CUSTOMER'})});assert.equal(duplicateManager.status,409,'creating a user must not silently overwrite an existing account');const editManagerPhoneConflict=await api('/api/admin/users/'+managerCreatedData.id,{method:'PUT',body:JSON.stringify({phone:'0500000000'})});assert.equal(editManagerPhoneConflict.status,409,'editing a user must not assign another account phone');const editManager=await api('/api/admin/users/'+managerCreatedData.id,{method:'PUT',body:JSON.stringify({name:'مدير اختبار معدل',phone:'0507776601',role:'MANAGER',active:true})});assert.equal(editManager.status,200);assert.equal((await editManager.json()).name,'مدير اختبار معدل');
    const managerLogin=await fetch(`${base}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone:'0507776601',password:'Manager@12345'})});assert.equal(managerLogin.status,200);const managerCookie=(managerLogin.headers.get('set-cookie')||'').split(';')[0];const managerApi=async(pathname,options={})=>fetch(`${base}${pathname}`,{...options,headers:{cookie:managerCookie,'content-type':'application/json',...(options.headers||{})}});const managerEscalation=await managerApi('/api/admin/users',{method:'POST',body:JSON.stringify({name:'مدير أعلى',phone:'0507776602',password:'Manager@12345',role:'MANAGER'})});assert.equal(managerEscalation.status,403,'manager must not be able to create another manager');
    const unauthManifest=await fetch(`${base}/api/admin/backup/manifest`);assert.equal(unauthManifest.status,401,'backup manifest must require authentication');
    const manifestResponse=await api('/api/admin/backup/manifest');assert.equal(manifestResponse.status,200);const manifest=await manifestResponse.json();assert.equal(manifest.appVersion,'2.10.73');assert.match(manifest.sha256,/^[a-f0-9]{64}$/);assert.ok(manifest.collectionCounts.assets>=0);
    const backupResponse=await api('/api/admin/export');assert.equal(backupResponse.status,200);const backup=await backupResponse.json();assert.equal(backup.version,'2.10.73');assert.equal(backup.manifest.sha256,crypto.createHash('sha256').update(JSON.stringify(backup.data)).digest('hex'),'backup digest should match exported database payload');
    // Rehearse restore into a separate DATA_DIR and process; never touch the active test database.
    const rehearsalDir=await mkdtemp(path.join(tmpdir(),'houshak-restore-rehearsal-'));let rehearsalChild;
    try{
      const {mkdir,writeFile}=await import('node:fs/promises');await mkdir(rehearsalDir,{recursive:true});await writeFile(path.join(rehearsalDir,'db.json'),JSON.stringify(backup.data));
      const rehearsalPort=await freePort();rehearsalChild=spawn(process.execPath,['src/server.js'],{cwd:root,env:{...process.env,PORT:String(rehearsalPort),DATA_DIR:rehearsalDir,NODE_ENV:'test'},stdio:'ignore'});
      const rehearsalBase=`http://127.0.0.1:${rehearsalPort}`;let rehearsalReady=false,rehearsalHealth;
      for(let i=0;i<80;i++){try{const r=await fetch(`${rehearsalBase}/api/health`);if(r.ok){rehearsalHealth=await r.json();rehearsalReady=true;break}}catch{}await delay(100)}
      assert.equal(rehearsalReady,true,'restored backup should boot in a separate isolated process');assert.equal(rehearsalHealth.version,'2.10.73');
      const rehearsalLogin=await fetch(`${rehearsalBase}/api/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone:'0500000000',password:'Admin@12345'})});assert.equal(rehearsalLogin.status,200,'restored backup should retain a usable seeded admin account');
      const rehearsalCookie=(rehearsalLogin.headers.get('set-cookie')||'').split(';')[0];const rehearsalManifest=await fetch(`${rehearsalBase}/api/admin/backup/manifest`,{headers:{cookie:rehearsalCookie}});assert.equal(rehearsalManifest.status,200);const rehearsalManifestData=await rehearsalManifest.json();assert.equal(rehearsalManifestData.collectionCounts.assets,backup.data.assets.length,'restored asset count should match exported backup');
    }finally{if(rehearsalChild&&!rehearsalChild.killed){rehearsalChild.kill('SIGTERM');await delay(100)}await rm(rehearsalDir,{recursive:true,force:true})}
    const verifyBackup=await api('/api/admin/backup/verify',{method:'POST',body:JSON.stringify(backup)});assert.equal(verifyBackup.status,200);const verifyBackupData=await verifyBackup.json();assert.equal(verifyBackupData.valid,true);assert.equal(verifyBackupData.sha256,backup.manifest.sha256);
    const inspectRestore=await api('/api/admin/backup/inspect-restore',{method:'POST',body:JSON.stringify(backup)});assert.equal(inspectRestore.status,200);const inspectData=await inspectRestore.json();assert.equal(inspectData.restorable,true);assert.equal(inspectData.previewOnly,true);assert.match(inspectData.notice,/لم تُستعد البيانات/);
    const malformedBackup=structuredClone(backup);malformedBackup.data.assets='not-an-array';malformedBackup.manifest.sha256=crypto.createHash('sha256').update(JSON.stringify(malformedBackup.data)).digest('hex');malformedBackup.manifest.bytes=Buffer.byteLength(JSON.stringify(malformedBackup.data),'utf8');const inspectMalformed=await api('/api/admin/backup/inspect-restore',{method:'POST',body:JSON.stringify(malformedBackup)});assert.equal(inspectMalformed.status,422);assert.equal((await inspectMalformed.json()).restorable,false);
    const financialBackup=structuredClone(backup);if(financialBackup.data.invoices.length){financialBackup.data.invoices[0].paid=Number(financialBackup.data.invoices[0].total||0)+999;financialBackup.manifest.sha256=crypto.createHash('sha256').update(JSON.stringify(financialBackup.data)).digest('hex');financialBackup.manifest.bytes=Buffer.byteLength(JSON.stringify(financialBackup.data),'utf8');financialBackup.manifest.collectionCounts=Object.fromEntries(Object.entries(financialBackup.data).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length]));const financialInspection=await api('/api/admin/backup/inspect-restore',{method:'POST',body:JSON.stringify(financialBackup)});assert.equal(financialInspection.status,200);assert.ok((await financialInspection.json()).warnings.some(w=>w.startsWith('INVOICE_FINANCIAL_MISMATCH:')),'financial anomalies should be reported as warnings, not silently repaired')}
    const unauthInspect=await fetch(`${base}/api/admin/backup/inspect-restore`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(backup)});assert.equal(unauthInspect.status,401);
    const tamperedBackup={...backup,data:{...backup.data,settings:[...(backup.data.settings||[]),{id:'tampered',key:'tampered',value:'x'}]}};const verifyTampered=await api('/api/admin/backup/verify',{method:'POST',body:JSON.stringify(tamperedBackup)});assert.equal(verifyTampered.status,422);assert.equal((await verifyTampered.json()).reason,'HASH_MISMATCH');
    const unauthVerify=await fetch(`${base}/api/admin/backup/verify`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(backup)});assert.equal(unauthVerify.status,401);
    const categoriesResponse=await api('/api/admin/categories');
    assert.equal(categoriesResponse.status,200);
    const categories=await categoriesResponse.json();
    const category=categories.find(x=>x.slug==='vehicles');
    assert.ok(category,'seed should include vehicle category');
    const assetResponse=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:'',ownerType:'USER',yardId:'demo-yard',purpose:'SALE',title:'أصل اختبار العقد',salePrice:125000,parkingFeeEnabled:true,parkingFee:250,make:'اختبار',model:'2026'})});
    // Use the authenticated administrator as the asset owner when a seeded account is required.
    let assetData=await assetResponse.json();
    let assetId=assetData.id;
    if(assetResponse.status!==201){
      const me=await api('/api/auth/me');
      const meData=await me.json();
      const retry=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:meData.user.id,ownerType:'USER',yardId:'demo-yard',purpose:'SALE',title:'أصل اختبار العقد',salePrice:125000,parkingFeeEnabled:true,parkingFee:250,make:'اختبار',model:'2026'})});
      assert.equal(retry.status,201,JSON.stringify(await retry.clone().json()));
      assetData=await retry.json();assetId=assetData.id;
    }
    assert.ok(assetId);
    const createdCategoryResponse=await api('/api/admin/categories',{method:'POST',body:JSON.stringify({name:'تصنيف تكاملي',icon:'🚚',allowSale:true,allowRent:true,allowStorage:false,active:true})});assert.equal(createdCategoryResponse.status,201,'admin category creation endpoint should accept the form payload');const createdCategory=await createdCategoryResponse.json();assert.equal(createdCategory.name,'تصنيف تكاملي');
    const createdLocationResponse=await api('/api/admin/locations',{method:'POST',body:JSON.stringify({name:'موقع تكاملي',code:'TEST-LOC-71',zone:'الصف التجريبي',yardId:'demo-yard',active:true})});assert.equal(createdLocationResponse.status,201,'admin yard location creation endpoint should accept the form payload');const createdLocation=await createdLocationResponse.json();assert.equal(createdLocation.code,'TEST-LOC-71');const locationEditResponse=await api('/api/admin/locations',{method:'PUT',body:JSON.stringify({id:createdLocation.id,name:'موقع تكاملي معدل',code:'TEST-LOC-71',yardId:'demo-yard',active:false})});assert.equal(locationEditResponse.status,200);assert.equal((await locationEditResponse.json()).name,'موقع تكاملي معدل');
    const createdConditionResponse=await api('/api/admin/conditions',{method:'POST',body:JSON.stringify({assetId,type:'ENTRY',condition:'جيدة',odometer:'100',engineHours:'3',accessories:'مفتاح',notes:'محضر تكاملي'})});assert.equal(createdConditionResponse.status,201,'admin handover report creation endpoint should accept the form payload');assert.equal((await createdConditionResponse.json()).assetId,assetId);
    assert.equal(assetData.parkingFeeEnabled,true,'sale asset should persist the optional parking-fee toggle');assert.equal(assetData.parkingFee,250,'sale asset should persist the parking fee amount');
    // Public marketplace sync contract: saved edits and new images must be reflected, and unavailable assets must disappear.
    const publicBeforeSync=await fetch(`${base}/api/listings/${assetId}`);assert.equal(publicBeforeSync.status,200);const publicBeforeData=await publicBeforeSync.json();assert.ok(publicBeforeData.updatedAt,'public listing should expose a safe update timestamp for sync');
    const editForSync=await api(`/api/admin/assets/${assetId}`,{method:'PUT',body:JSON.stringify({description:'وصف محدث يظهر للعميل',salePrice:145000,status:'ACTIVE',purpose:'SALE',ownerId:assetData.owner?.id||assetData.ownerId,ownerType:'USER',categoryId:category.id,yardId:'demo-yard'})});assert.equal(editForSync.status,200,JSON.stringify(await editForSync.clone().json()));
    const publicAfterSync=await fetch(`${base}/api/listings/${assetId}`);assert.equal(publicAfterSync.status,200);const publicAfterData=await publicAfterSync.json();assert.equal(publicAfterData.description,'وصف محدث يظهر للعميل');assert.equal(publicAfterData.salePrice,145000);assert.notEqual(publicAfterData.updatedAt,publicBeforeData.updatedAt,'public update timestamp should advance after edits');
    const tinySyncImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT9sAAAAASUVORK5CYII=';const syncImageResponse=await api(`/api/admin/assets/${assetId}/images`,{method:'POST',body:JSON.stringify({dataUrl:tinySyncImage})});assert.equal(syncImageResponse.status,201);const publicAfterImage=await (await fetch(`${base}/api/listings/${assetId}`)).json();assert.equal(publicAfterImage.images.length,1,'customer listing should include the saved image');
    const markUnavailable=await api(`/api/admin/assets/${assetId}`,{method:'PUT',body:JSON.stringify({status:'SOLD',purpose:'SALE',salePrice:145000,ownerId:assetData.owner?.id||assetData.ownerId,ownerType:'USER',categoryId:category.id,yardId:'demo-yard'})});assert.equal(markUnavailable.status,200);const publicUnavailable=await fetch(`${base}/api/listings/${assetId}`);assert.equal(publicUnavailable.status,404,'assets marked sold must disappear from public listings');
    const restoreListing=await api(`/api/admin/assets/${assetId}`,{method:'PUT',body:JSON.stringify({status:'ACTIVE',purpose:'SALE',salePrice:145000,ownerId:assetData.owner?.id||assetData.ownerId,ownerType:'USER',categoryId:category.id,yardId:'demo-yard'})});assert.equal(restoreListing.status,200);assert.equal((await fetch(`${base}/api/listings/${assetId}`)).status,200,'reactivated active asset should return to public listings');
    const invalidDateReservation=await fetch(`${base}/api/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assetId,name:'عميل اختبار',phone:'0501234567',fromAt:'not-a-date',toAt:'also-not-a-date'})});assert.equal(invalidDateReservation.status,400,'invalid reservation dates must be rejected');
    const inquiryBody={assetId,name:'عميل تتبع',phone:'0501234567',message:'أريد تفاصيل الأصل',clientRequestId:'inquiry-test-unique-001'};const inquiryResponse=await fetch(`${base}/api/inquiries`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(inquiryBody)});assert.equal(inquiryResponse.status,201);const inquiry=await inquiryResponse.json();assert.match(inquiry.code,/^INQ-/);assert.ok(inquiry.trackingToken);const inquiryReplay=await fetch(`${base}/api/inquiries`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(inquiryBody)});assert.equal(inquiryReplay.status,200,'duplicate inquiry submission should be idempotent');assert.equal((await inquiryReplay.json()).id,inquiry.id);const wrongPhoneTrack=await fetch(`${base}/api/request-status?token=${encodeURIComponent(inquiry.trackingToken)}&phone=0500000001`);assert.equal(wrongPhoneTrack.status,404,'tracking must not reveal request to a different phone number');const inquiryTrack=await fetch(`${base}/api/request-status?token=${encodeURIComponent(inquiry.trackingToken)}&phone=0501234567`);assert.equal(inquiryTrack.status,200);const inquiryTrackData=await inquiryTrack.json();assert.equal(inquiryTrackData.code,inquiry.code);assert.equal('phone' in inquiryTrackData,false,'public tracking response must not expose the customer phone');assert.equal('trackingToken' in inquiryTrackData,false,'public tracking response must not echo the secret token');const inquiryReply=await api(`/api/admin/inquiries/${inquiry.id}/messages`,{method:'POST',body:JSON.stringify({body:'سنتواصل معك'})});assert.equal(inquiryReply.status,201);const inquiryTrackAfterReply=await fetch(`${base}/api/request-status?token=${encodeURIComponent(inquiry.trackingToken)}&phone=0501234567`);const inquiryTrackAfterReplyData=await inquiryTrackAfterReply.json();assert.equal(inquiryTrackAfterReplyData.status,'IN_PROGRESS','customer tracking should reflect admin reply');assert.equal(inquiryTrackAfterReplyData.latestReply.body,'سنتواصل معك','customer tracking should include the latest admin reply');assert.equal(inquiryTrackAfterReplyData.messages.at(-1).sender,'الإدارة');assert.equal('senderId' in inquiryTrackAfterReplyData.messages.at(-1),false,'public tracking must not expose staff identifiers');assert.equal('phone' in inquiryTrackAfterReplyData.latestReply,false);const closeInquiryWithoutReason=await api(`/api/admin/inquiries/${inquiry.id}/status`,{method:'PUT',body:JSON.stringify({status:'CLOSED',note:'  '})});assert.equal(closeInquiryWithoutReason.status,400,'status changes must require a reason');const closeInquiry=await api(`/api/admin/inquiries/${inquiry.id}/status`,{method:'PUT',body:JSON.stringify({status:'CLOSED',note:'تمت الإجابة على الاستفسار'})});assert.equal(closeInquiry.status,200);assert.equal((await closeInquiry.json()).status,'CLOSED');const inquiryTrackClosed=await fetch(`${base}/api/request-status?token=${encodeURIComponent(inquiry.trackingToken)}&phone=0501234567`);const closedTrack=await inquiryTrackClosed.json();assert.equal(closedTrack.status,'CLOSED');assert.ok(closedTrack.history.some(x=>x.status==='CLOSED'&&x.note==='تمت الإجابة على الاستفسار'));const reopenInquiry=await api(`/api/admin/inquiries/${inquiry.id}/status`,{method:'PUT',body:JSON.stringify({status:'IN_PROGRESS',note:'العميل طلب متابعة إضافية'})});assert.equal(reopenInquiry.status,200);const unauthorizedInquiryStatus=await fetch(`${base}/api/admin/inquiries/${inquiry.id}/status`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({status:'CLOSED',note:'غير مصرح'})});assert.equal(unauthorizedInquiryStatus.status,401);
    const reserveBody={assetId,name:'عميل حجز',phone:'0507654321',clientRequestId:'reservation-test-unique-001'};const reserveResponse=await fetch(`${base}/api/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(reserveBody)});assert.equal(reserveResponse.status,201,JSON.stringify(await reserveResponse.clone().json()));const trackedReservation=await reserveResponse.json();assert.match(trackedReservation.code,/^RES-/);assert.ok(trackedReservation.trackingToken);const reserveReplay=await fetch(`${base}/api/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(reserveBody)});assert.equal(reserveReplay.status,200,'duplicate reservation submission should be idempotent');assert.equal((await reserveReplay.json()).id,trackedReservation.id);const cancelReservation=await api(`/api/admin/reservations/${trackedReservation.id}`,{method:'PUT',body:JSON.stringify({status:'CANCELLED',statusNote:'اختبار إلغاء آمن'})});assert.equal(cancelReservation.status,200);const reservationTrack=await fetch(`${base}/api/request-status?token=${encodeURIComponent(trackedReservation.trackingToken)}&phone=0507654321`);const reservationTrackData=await reservationTrack.json();assert.equal(reservationTrackData.status,'CANCELLED');assert.ok(reservationTrackData.history.some(x=>x.status==='CANCELLED'));
    const offerAssetResponse=await api('/api/admin/assets',{method:'POST',body:JSON.stringify({categoryId:category.id,ownerId:assetData.owner?.id||assetData.ownerId,ownerType:'USER',yardId:'demo-yard',purpose:'SALE',title:'أصل مستقل لاختبار عروض الشراء',salePrice:130000,make:'اختبار',model:'2026'})});assert.equal(offerAssetResponse.status,201,JSON.stringify(await offerAssetResponse.clone().json()));const offerAsset=await offerAssetResponse.json();const offerAssetId=offerAsset.id;const offerBody={assetId:offerAssetId,name:'عميل عرض',phone:'0502222333',amount:99999,note:'عرض اختبار',clientRequestId:'offer-test-unique-001'};const offerResponse=await fetch(`${base}/api/offers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(offerBody)});assert.equal(offerResponse.status,201);const offer=await offerResponse.json();assert.ok(offer.trackingToken);const offerTrack=await fetch(`${base}/api/request-status?token=${encodeURIComponent(offer.trackingToken)}&phone=0502222333`);assert.equal(offerTrack.status,200);assert.equal((await offerTrack.json()).kind,'OFFER');const rejectOffer=await api(`/api/admin/offers/${offer.id}`,{method:'PUT',body:JSON.stringify({status:'REJECTED',statusNote:'عرض تجريبي'})});assert.equal(rejectOffer.status,200);const offerTrackAfter=await fetch(`${base}/api/request-status?token=${encodeURIComponent(offer.trackingToken)}&phone=0502222333`);assert.equal((await offerTrackAfter.json()).status,'REJECTED');const winningOfferResponse=await fetch(`${base}/api/offers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assetId:offerAssetId,name:'عميل العرض المقبول',phone:'0503333444',amount:110000,clientRequestId:'offer-accepted-unique-001'})});assert.equal(winningOfferResponse.status,201);const winningOffer=await winningOfferResponse.json();const competingOfferResponse=await fetch(`${base}/api/offers`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assetId:offerAssetId,name:'عميل عرض منافس',phone:'0504444555',amount:105000,clientRequestId:'offer-competing-unique-001'})});assert.equal(competingOfferResponse.status,201);const competingOffer=await competingOfferResponse.json();const acceptWinningOffer=await api(`/api/admin/offers/${winningOffer.id}`,{method:'PUT',body:JSON.stringify({status:'ACCEPTED',statusNote:'اعتماد العرض بعد المراجعة'})});assert.equal(acceptWinningOffer.status,200,JSON.stringify(await acceptWinningOffer.clone().json()));assert.equal((await acceptWinningOffer.json()).status,'ACCEPTED');const offersAfterAcceptance=await api('/api/admin/offers');const allOffersAfter=await offersAfterAcceptance.json();assert.equal(allOffersAfter.find(x=>x.id===competingOffer.id).status,'REJECTED','competing open offers must be closed after accepting one offer');const secondAcceptance=await api(`/api/admin/offers/${competingOffer.id}`,{method:'PUT',body:JSON.stringify({status:'ACCEPTED'})});assert.equal(secondAcceptance.status,409,'a competing offer cannot be accepted after the asset is reserved');const publicListingAfterOffer=await fetch(`${base}/api/listings/${offerAssetId}`);assert.equal(publicListingAfterOffer.status,404,'accepted offer must remove the asset from public listings');
    const tinyImage='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jT9sAAAAASUVORK5CYII=';
    const contractResponse=await api('/api/admin/contracts',{method:'POST',body:JSON.stringify({assetId,type:'SALE',partyName:'طرف اختبار',partyPhone:'0501111111',partyIdentityType:'PASSPORT',partyIdentityNumber:'P123',amount:125000,terms:'اختبار دورة العقد',sellerIdentityImage:tinyImage,partyIdentityImage:tinyImage})});
    assert.equal(contractResponse.status,201,JSON.stringify(await contractResponse.clone().json()));
    const contract=await contractResponse.json();
    const approveResponse=await api(`/api/admin/contracts/${contract.id}`,{method:'PUT',body:JSON.stringify({status:'APPROVED'})});
    assert.equal(approveResponse.status,200,JSON.stringify(await approveResponse.clone().json()));
    const approved=await approveResponse.json();
    assert.equal(approved.status,'APPROVED');
    assert.ok(approved.approvalSnapshotHash);assert.equal(approved.assetSnapshot.parkingFeeEnabled,true);assert.equal(approved.assetSnapshot.parkingFee,250,'contract snapshot should retain the agreed parking fee');
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
    const lifecycleAuditResponse=await api('/api/admin/assets/lifecycle-audit');assert.equal(lifecycleAuditResponse.status,200);const lifecycleAudit=await lifecycleAuditResponse.json();assert.equal(lifecycleAudit.readOnly,true);assert.ok(Array.isArray(lifecycleAudit.issues));assert.equal(typeof lifecycleAudit.summary.high,'number');
    // Controlled lifecycle correction: only the safe missing-exit-timestamp case is auto-correctable.
    const markExitedForAudit=await api(`/api/admin/assets/${assetId}`,{method:'PUT',body:JSON.stringify({status:'EXITED'})});assert.equal(markExitedForAudit.status,200);
    const missingExitAudit=await api('/api/admin/assets/lifecycle-audit');assert.equal(missingExitAudit.status,200);const missingExitReport=await missingExitAudit.json();assert.ok(missingExitReport.issues.some(x=>x.code==='EXITED_WITHOUT_EXIT_TIMESTAMP'&&String(x.assetId)===String(assetId)));
    const noConfirm=await api('/api/admin/assets/lifecycle-audit/resolve',{method:'POST',body:JSON.stringify({issueCode:'EXITED_WITHOUT_EXIT_TIMESTAMP',assetId,reason:'مراجعة سجل الخروج',confirmed:false})});assert.equal(noConfirm.status,400);
    const unsafeResolve=await api('/api/admin/assets/lifecycle-audit/resolve',{method:'POST',body:JSON.stringify({issueCode:'MULTIPLE_CONFIRMED_RESERVATIONS',assetId,reason:'مراجعة الحجوزات المتعارضة',confirmed:true})});assert.equal(unsafeResolve.status,409);
    const resolved=await api('/api/admin/assets/lifecycle-audit/resolve',{method:'POST',body:JSON.stringify({issueCode:'EXITED_WITHOUT_EXIT_TIMESTAMP',assetId,reason:'مطابقة سجل الاستلام الورقي',confirmed:true})});assert.equal(resolved.status,200,JSON.stringify(await resolved.clone().json()));const resolvedData=await resolved.json();assert.ok(resolvedData.next.exitAt);assert.equal(resolvedData.previous.exitAt,null);assert.equal(resolvedData.reason,'مطابقة سجل الاستلام الورقي');
    const repeatResolve=await api('/api/admin/assets/lifecycle-audit/resolve',{method:'POST',body:JSON.stringify({issueCode:'EXITED_WITHOUT_EXIT_TIMESTAMP',assetId,reason:'محاولة تكرار التصحيح',confirmed:true})});assert.equal(repeatResolve.status,409,'repeat correction must be blocked after state changes');
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
