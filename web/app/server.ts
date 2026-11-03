import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
export const db=()=>env.DB as D1Database;
export const now=()=>new Date().toISOString();
export const fail=(error:string,status=400)=>Response.json({error},{status});
export const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
export async function passwordHash(password:string,salt=crypto.randomUUID()){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return `${salt}:${Array.from(new Uint8Array(bits)).map(x=>x.toString(16).padStart(2,'0')).join('')}`}
export async function verifyPassword(password:string,stored:string){const salt=stored.split(':')[0];return await passwordHash(password,salt)===stored}
export async function current(req?:Request){const bearer=req?.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];const cookie=bearer||req?.headers.get('Cookie')?.match(/(?:^|;\s*)study_p_session=([^;]+)/)?.[1]||(await cookies()).get('study_p_session')?.value;if(!cookie)return null;let token=await hash(cookie);return await db().prepare(`SELECT u.id,u.name,u.grade,u.username,u.role,u.status FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`).bind(token,now()).first<{id:string;name:string;grade:string;username:string;role:string;status:string}>()}
export async function issue(userId:string){let token=crypto.randomUUID()+crypto.randomUUID();await db().prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hash(token),userId,new Date(Date.now()+30*86400000).toISOString()).run();return {token,cookie:`study_p_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30*86400}`}}
export const isAdmin=(u:Awaited<ReturnType<typeof current>>)=>u?.role==='admin'&&u.status==='active';
export async function total(id:string){let r=await db().prepare('SELECT COALESCE(SUM(points),0) n FROM point_history WHERE student_id=?').bind(id).first<{n:number}>();return r?.n||0}
export function dayKorea(date:string){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date))}
