import fs from 'fs'; import path from 'path'; import crypto from 'crypto';
const root=path.resolve(process.cwd()); const dataDir=process.env.DATA_DIR||path.join(root,'data'); const file=path.join(dataDir,'db.json'); fs.mkdirSync(dataDir,{recursive:true});
const base={users:[],owners:[],yards:[],categories:[],vehicleTypes:[],assets:[],images:[],storageCharges:[],history:[],inquiries:[],messages:[],auditLogs:[],sessions:[],transactions:[],reservations:[],offers:[],expenses:[],notifications:[],contracts:[],settings:[],locations:[],invoices:[],conditionReports:[],receipts:[],orders:[]};
export function load(){if(!fs.existsSync(file)){fs.writeFileSync(file,JSON.stringify(base,null,2));return structuredClone(base)} try{return {...base,...JSON.parse(fs.readFileSync(file,'utf8'))}}catch{return structuredClone(base)}}
export function save(db){const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2));fs.renameSync(tmp,file)}
export function id(prefix='id'){return `${prefix}_${crypto.randomUUID()}`}
export function now(){return new Date().toISOString()}
export function hashPassword(p){const salt=crypto.randomBytes(16).toString('hex');const derived=crypto.scryptSync(String(p),salt,64).toString('hex');return `scrypt$${salt}$${derived}`}
export function verifyPassword(password,stored){const value=String(stored||'');if(value.startsWith('scrypt$')){const [,salt,expected]=value.split('$');if(!salt||!expected)return false;const actual=crypto.scryptSync(String(password),salt,64);const target=Buffer.from(expected,'hex');return actual.length===target.length&&crypto.timingSafeEqual(actual,target)}const legacy=crypto.createHash('sha256').update(String(password)).digest('hex');return value.length===legacy.length&&crypto.timingSafeEqual(Buffer.from(value),Buffer.from(legacy))}
export function isLegacyPasswordHash(stored){return !String(stored||'').startsWith('scrypt$')}
export function createSession(db,userId){const token=crypto.randomBytes(32).toString('hex');db.sessions.push({token,userId,createdAt:now(),expiresAt:new Date(Date.now()+7*86400000).toISOString()});return token}
export function userByToken(db,token){if(!token)return null;const s=db.sessions.find(x=>x.token===token&&new Date(x.expiresAt)>new Date());return s?db.users.find(u=>u.id===s.userId):null}
