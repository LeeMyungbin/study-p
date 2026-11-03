import { current,db,fail,isAdmin,now } from '../../server';
export const runtime='edge';
const MAX_PHOTO=180_000;
const MAX_TOTAL=350_000_000;

export async function POST(req:Request){
 try{
  const u=await current(req);
  if(!u||u.status!=='active'||isAdmin(u))return fail('학생 계정에서 사진을 올려 주세요.',403);
  const fd=await req.formData(),f=fd.get('file');
  if(!(f instanceof File)||f.size===0||f.size>MAX_PHOTO||f.type!=='image/jpeg')return fail('사진을 압축하지 못했어요. 다른 사진을 선택해 주세요.');
  await db().prepare('DELETE FROM photo_evidence WHERE owner_id=? AND created_at<? AND NOT EXISTS (SELECT 1 FROM point_requests WHERE photo_key=photo_evidence.key)').bind(u.id,new Date(Date.now()-86400000).toISOString()).run();
  const used=await db().prepare('SELECT COALESCE(SUM(LENGTH(data)),0) AS bytes FROM photo_evidence').first<{bytes:number}>();
  if((used?.bytes||0)+Math.ceil(f.size*4/3)>MAX_TOTAL)return fail('사진 저장 공간이 찼어요. 선생님께 오래된 사진 정리를 요청해 주세요.',507);
  const bytes=new Uint8Array(await f.arrayBuffer());
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const key=`${u.id}/${crypto.randomUUID()}`;
  await db().prepare('INSERT INTO photo_evidence(key,owner_id,mime,data,created_at) VALUES(?,?,?,?,?)').bind(key,u.id,'image/jpeg',btoa(binary),now()).run();
  return Response.json({key});
 }catch(e){console.error(e);return fail('사진을 올리지 못했어요.',500)}
}

export async function GET(req:Request){
 try{
  const u=await current(req);if(!u||u.status!=='active')return fail('로그인이 필요해요.',401);
  const key=new URL(req.url).searchParams.get('key');if(!key)return fail('사진을 찾지 못했어요.',404);
  const photo=await db().prepare('SELECT student_id FROM point_requests WHERE photo_key=?').bind(key).first<{student_id:string}>();
  if(!photo||(!isAdmin(u)&&photo.student_id!==u.id))return fail('사진에 접근할 수 없어요.',403);
  const object=await db().prepare('SELECT mime,data FROM photo_evidence WHERE key=?').bind(key).first<{mime:string;data:string}>();
  if(!object)return fail('사진을 찾지 못했어요.',404);
  const binary=atob(object.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  return new Response(bytes,{headers:{'Content-Type':object.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){console.error(e);return fail('사진을 불러오지 못했어요.',500)}
}
