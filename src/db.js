import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const root=path.resolve(process.cwd()); const dataDir=process.env.DATA_DIR||path.join(root,'data'); const file=path.join(dataDir,'db.json'); fs.mkdirSync(dataDir,{recursive:true});
const base={users:[],owners:[],yards:[],categories:[],vehicleTypes:[],assets:[],images:[],storageCharges:[],history:[],inquiries:[],messages:[],auditLogs:[],sessions:[],transactions:[],reservations:[],offers:[],expenses:[],notifications:[],contracts:[],settings:[],locations:[],invoices:[],conditionReports:[],receipts:[]};
export function load(){if(!fs.existsSync(file)){fs.writeFileSync(file,JSON.stringify(base,null,2));return structuredClone(base)} try{return {...base,...JSON.parse(fs.readFileSync(file,'utf8'))}}catch{return structuredClone(base)}}
export function save(db){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,file)}
export function id(prefix='id'){return `${prefix}_${crypto.randomUUID()}`}
export function now(){return new Date().toISOString()}
export function hashPassword(p){return crypto.createHash('sha256').update(String(p)).digest('hex')}
export function createSession(db,userId){const token=crypto.randomBytes(32).toString('hex');db.sessions.push({token,userId,createdAt:now(),expiresAt:new Date(Date.now()+7*86400000).toISOString()});return token}
export function userByToken(db,token){if(!token)return null;const s=db.sessions.find(x=>x.token===token&&new Date(x.expiresAt)>new Date());return s?db.users.find(u=>u.id===s.userId):null}
