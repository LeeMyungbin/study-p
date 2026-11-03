import { env } from 'cloudflare:workers';
import { current,db,fail,isAdmin,now,total,dayKorea,passwordHash } from '../../server';
export const runtime='edge';
const values:Record<string,number>={attendance:20,textbook:100,worksheet:100,assessment:100,homework:100,review:500,other:0};
const testPrefix='portfolio-test-';
const isoAt=(year:number,month:number,day:number,hour=7)=>new Date(Date.UTC(year,month-1,day,hour)).toISOString();
const notionText=(content:string)=>({rich_text:[{type:'text',text:{content}}]});
async function notion(path:string,init:RequestInit={}){
 const token=env.NOTION_TOKEN,databaseId=env.NOTION_DATABASE_ID;
 if(!token||!databaseId)throw Error('NOTION_NOT_CONFIGURED');
 const response=await fetch(`https://api.notion.com/v1${path}`,{...init,headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2022-06-28','Content-Type':'application/json',...(init.headers||{})}});
 const result=await response.json() as Record<string,any>;
 if(!response.ok){console.error('Notion API',response.status,result.code,result.message);throw Error('NOTION_API_FAILED')}
 return result;
}
export async function POST(req:Request){try{let u=await current(req);if(!u||u.status!=='active')return fail('로그인이 필요해요.',401);let b=await req.json() as Record<string,any>,a=String(b.action),admin=isAdmin(u),time=now(),id=crypto.randomUUID(),d=db();
 if(a==='request'){
 if(admin)return fail('학생 계정에서 요청해 주세요.',403);let type=String(b.type),points=values[type];if(points===undefined)return fail('활동을 다시 선택해 주세요.');let details=String(b.details||'').trim();if(details.length>500||type==='other'&&!details)return fail('세부사항을 확인해 주세요.');let photoKey=b.photoKey?String(b.photoKey):null;if(photoKey&&!photoKey.startsWith(`${u.id}/`))return fail('사진을 확인해 주세요.',403);
 if(photoKey){let owned=await d.prepare('SELECT key FROM photo_evidence WHERE key=? AND owner_id=?').bind(photoKey,u.id).first();if(!owned)return fail('첨부 사진을 다시 확인해 주세요.',403)}
 if(type==='attendance'){let day=dayKorea(time),start=new Date(Date.parse(`${day}T00:00:00+09:00`)).toISOString(),end=new Date(Date.parse(`${day}T00:00:00+09:00`)+86400000).toISOString();let previous=await d.prepare("SELECT id FROM point_requests WHERE student_id=? AND type='attendance' AND requested_at>=? AND requested_at<? LIMIT 1").bind(u.id,start,end).first();if(previous)return fail('등원 포인트는 하루에 한 번만 요청할 수 있어요.')}
 await d.prepare('INSERT INTO point_requests(id,student_id,type,points,details,photo_key,status,requested_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,u.id,type,points,details,photoKey,'pending',time).run();return Response.json({ok:true})}
 if(a==='rewardRequest'){if(admin)return fail('학생 계정에서 요청해 주세요.',403);let amount=Number(b.amount);if(![5000,10000].includes(amount))return fail('카드를 다시 선택해 주세요.');let setting=await d.prepare('SELECT value FROM settings WHERE key=?').bind(`card${amount}`).first<{value:string}>(),cost=Number(setting?.value||amount);if(await total(u.id)<cost)return fail('포인트가 부족해요.');await d.prepare('INSERT INTO reward_requests(id,student_id,amount,cost,status,delivery_status,requested_at) VALUES(?,?,?,?,?,?,?)').bind(id,u.id,amount,cost,'pending','not_started',time).run();return Response.json({ok:true})}
 if(!admin)return fail('관리자만 처리할 수 있어요.',403);
 if(a==='seedTestData'){
  const existing=await d.prepare("SELECT COUNT(*) count FROM users WHERE id LIKE ? OR username LIKE 'test_%'").bind(`${testPrefix}%`).first<{count:number}>();
  if(existing?.count)return fail('테스트 학생이 이미 있어요. 기존 테스트 데이터를 삭제한 뒤 다시 만들어 주세요.');
  const today=new Date(),year=today.getUTCFullYear(),month=today.getUTCMonth()+1,lastDay=Math.max(7,Math.min(today.getUTCDate(),28));
  const students=[
   {id:`${testPrefix}a`,name:'[TEST] 학생 A',grade:'초6',username:'test_a',password:'1111'},
   {id:`${testPrefix}b`,name:'[TEST] 학생 B',grade:'중1',username:'test_b',password:'2222'},
   {id:`${testPrefix}c`,name:'[TEST] 학생 C',grade:'초5',username:'test_c',password:'3333'},
  ];
  const patterns:Record<string,Array<[number,string,string]>>={
   a:[[1,'attendance','등원'],[2,'homework','과제 확인'],[4,'worksheet','맞춤학습지 100점'],[7,'attendance','등원'],[8,'homework','과제 확인'],[10,'textbook','교재 2페이지 연속 만점'],[14,'attendance','등원'],[15,'homework','과제 확인'],[17,'assessment','단원평가 85점'],[21,'attendance','등원'],[22,'homework','과제 확인']],
   b:[[1,'attendance','등원'],[3,'attendance','등원'],[6,'attendance','등원'],[8,'attendance','등원'],[10,'worksheet','맞춤학습지 100점'],[13,'attendance','등원'],[15,'attendance','등원'],[20,'attendance','등원'],[22,'attendance','등원']],
   c:[[1,'attendance','등원'],[2,'homework','과제 확인'],[3,'worksheet','맞춤학습지 100점'],[5,'attendance','등원'],[6,'assessment','단원평가 90점'],[8,'homework','과제 확인'],[10,'textbook','교재 2페이지 연속 만점'],[12,'attendance','등원'],[18,'attendance','등원']],
  };
  const ops:D1PreparedStatement[]=[];
  for(const student of students)ops.push(d.prepare('INSERT INTO users(id,name,grade,username,password_hash,role,status,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(student.id,student.name,student.grade,student.username,await passwordHash(student.password),'student','active',isoAt(year,month,1)));
  for(const student of students){
   const key=student.id.slice(-1),rows=patterns[key].filter(([day])=>day<=lastDay);
   for(let index=0;index<rows.length;index++){
    const [day,type,details]=rows[index],requestId=`${testPrefix}${key}-request-${index}`,historyId=`${testPrefix}${key}-history-${index}`,created=isoAt(year,month,day),points=values[type];
    ops.push(d.prepare('INSERT INTO point_requests(id,student_id,type,points,details,status,requested_at,reviewed_at,reviewed_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(requestId,student.id,type,points,`[가상 기록] ${details}`,'approved',created,created,u.id));
    ops.push(d.prepare('INSERT INTO point_history(id,student_id,points,type,reason,request_id,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(historyId,student.id,points,type,`[가상 기록] ${details}`,requestId,u.id,created));
    if(type==='attendance')ops.push(d.prepare('INSERT INTO attendance(id,student_id,day,request_id) VALUES(?,?,?,?)').bind(`${testPrefix}${key}-attendance-${index}`,student.id,dayKorea(created),requestId));
   }
  }
  const heldAt=isoAt(year,month,Math.min(lastDay,19));
  ops.push(d.prepare('INSERT INTO point_requests(id,student_id,type,points,details,status,reason,requested_at,reviewed_at,reviewed_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(`${testPrefix}b-held`,`${testPrefix}b`,'homework',100,'[가상 기록] 과제 인증 사진 확인 필요','held','증빙 내용을 다시 확인해 주세요.',heldAt,heldAt,u.id));
  const rejectedAt=isoAt(year,month,Math.min(lastDay,20));
  ops.push(d.prepare('INSERT INTO point_requests(id,student_id,type,points,details,status,reason,requested_at,reviewed_at,reviewed_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(`${testPrefix}c-rejected`,`${testPrefix}c`,'worksheet',100,'[가상 기록] 점수 확인 불가','rejected','점수가 보이도록 다시 촬영해 주세요.',rejectedAt,rejectedAt,u.id));
  await d.batch(ops);
  return Response.json({ok:true,students:students.map(({name,username,password})=>({name,username,password})),records:ops.length});
 }
 if(a==='deleteTestData'){
  const testUsers=await d.prepare('SELECT id FROM users WHERE id LIKE ?').bind(`${testPrefix}%`).all<{id:string}>();
  if(!testUsers.results.length)return Response.json({ok:true,deleted:0});
  const ops:D1PreparedStatement[]=[];
  for(const student of testUsers.results){
   ops.push(d.prepare('DELETE FROM sessions WHERE user_id=?').bind(student.id));
   ops.push(d.prepare('DELETE FROM attendance WHERE student_id=?').bind(student.id));
   ops.push(d.prepare('DELETE FROM point_history WHERE student_id=?').bind(student.id));
   ops.push(d.prepare('DELETE FROM reward_requests WHERE student_id=?').bind(student.id));
   ops.push(d.prepare('DELETE FROM point_requests WHERE student_id=?').bind(student.id));
   ops.push(d.prepare('DELETE FROM users WHERE id=?').bind(student.id));
  }
  await d.batch(ops);return Response.json({ok:true,deleted:testUsers.results.length});
 }
 if(a==='syncNotionTestReports'){
  if(!env.NOTION_TOKEN||!env.NOTION_DATABASE_ID)return fail('노션 연결 설정이 아직 끝나지 않았어요. 배포 설정을 확인해 주세요.');
  const month=new Date().toISOString().slice(0,7),monthStart=`${month}-01`;
  const students=await d.prepare("SELECT id,name,grade FROM users WHERE id LIKE ? AND role='student' AND status='active' ORDER BY name").bind(`${testPrefix}%`).all<{id:string;name:string;grade:string}>();
  if(!students.results.length)return fail('먼저 테스트학생 3명을 만들어 주세요.');
  let created=0,updated=0;
  for(const student of students.results){
   const history=await d.prepare("SELECT type,points,created_at FROM point_history WHERE student_id=? AND points>0 AND substr(created_at,1,7)=? ORDER BY created_at").bind(student.id,month).all<{type:string;points:number;created_at:string}>();
   const rows=history.results,attendance=rows.filter(x=>x.type==='attendance').length,types=new Set(rows.map(x=>x.type)).size;
   const early=rows.filter(x=>Number(x.created_at.slice(8,10))<=15).length,late=rows.length-early;
   let finding='활동 기록을 더 모은 뒤 패턴을 확인할 수 있어요.',goal='이번 달 활동 기록을 꾸준히 쌓습니다.';
   if(rows.length&&attendance/rows.length>=0.7){finding='등원은 꾸준하지만 학습 성과 활동이 출석에 비해 적어요.';goal='다음 달에는 과제 또는 학습지 인증을 주 1회 이상 기록합니다.'}
   else if(early>=4&&late<=early*0.5){finding='월 전반부보다 후반부의 학습 활동이 감소했어요.';goal='수업 당일 과제 확인을 통해 후반부 참여를 유지합니다.'}
   else if(types>=4&&rows.length>=8){finding='여러 학습 활동에 고르게 참여하며 꾸준한 흐름을 보였어요.';goal='현재의 주별 학습 활동 흐름을 다음 달에도 유지합니다.'}
   const reportName=`${student.name} · ${month.slice(0,4)}년 ${Number(month.slice(5))}월`;
   const properties={
    '이름':{title:[{type:'text',text:{content:reportName}}]},
    '대상 월':{date:{start:monthStart}},'학년':notionText(student.grade),'Study P ID':notionText(student.id),
    '활동 건수':{number:rows.length},'획득 포인트':{number:rows.reduce((sum,x)=>sum+Number(x.points),0)},
    '분석 결과':notionText(finding),'다음 달 지도 목표':notionText(goal),'검토 상태':{status:{name:'시작 전'}}
   };
   const found=await notion(`/databases/${env.NOTION_DATABASE_ID}/query`,{method:'POST',body:JSON.stringify({page_size:1,filter:{property:'이름',title:{equals:reportName}}})});
   if(found.results?.[0]?.id){await notion(`/pages/${found.results[0].id}`,{method:'PATCH',body:JSON.stringify({properties})});updated++}
   else{await notion('/pages',{method:'POST',body:JSON.stringify({parent:{database_id:env.NOTION_DATABASE_ID},properties})});created++}
  }
  return Response.json({ok:true,created,updated,total:students.results.length});
 }
 if(a==='deleteOldPhotos'){
 const days=Number(b.days);
 if(![30,90,180].includes(days))return fail('보관 기간을 확인해 주세요.');
 const cutoff=new Date(Date.now()-days*86400000).toISOString();
 const photos=await d.prepare("SELECT id,photo_key FROM point_requests WHERE photo_key IS NOT NULL AND requested_at<? AND status IN ('approved','rejected') ORDER BY requested_at ASC LIMIT 50").bind(cutoff).all<{id:string;photo_key:string}>();
 let deleted=0;
 for(const photo of photos.results){
   await d.prepare('DELETE FROM photo_evidence WHERE key=?').bind(photo.photo_key).run();
   const result=await d.prepare('UPDATE point_requests SET photo_key=NULL WHERE id=? AND photo_key=?').bind(photo.id,photo.photo_key).run();
   deleted+=result.meta.changes||0;
 }
 return Response.json({ok:true,deleted,more:photos.results.length===50});
 }
 if(a==='studentStatus'){let target=await d.prepare("SELECT id,status FROM users WHERE id=? AND role='student'").bind(b.studentId).first<{id:string;status:string}>();if(!target||target.status!=='pending'||!['active','rejected'].includes(b.status))return fail('가입 요청을 확인해 주세요.');await d.prepare("UPDATE users SET status=? WHERE id=? AND status='pending'").bind(b.status,b.studentId).run();return Response.json({ok:true})}
 if(a==='resetPassword'){let target=await d.prepare("SELECT id FROM users WHERE id=? AND role='student' AND status='active'").bind(b.studentId).first();if(!target)return fail('학생 계정을 확인해 주세요.');let temporary=String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0');await d.batch([d.prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await passwordHash(temporary),b.studentId),d.prepare('DELETE FROM sessions WHERE user_id=?').bind(b.studentId)]);return Response.json({ok:true,temporary})}
 if(a==='batchReview'){
  let ids=Array.isArray(b.ids)?[...new Set(b.ids.map(String))]:[];if(!ids.length||ids.length>100)return fail('승인할 요청을 선택해 주세요.');
  let rows=[] as any[];for(const requestId of ids){let row=await d.prepare('SELECT * FROM point_requests WHERE id=?').bind(requestId).first<any>();if(!row||!['pending','held'].includes(row.status)||row.type==='other')return fail('일괄 승인할 요청 상태를 다시 확인해 주세요.');rows.push(row)}
  let attendance=new Set<string>();for(const row of rows){if(row.type!=='attendance')continue;let day=dayKorea(row.requested_at),key=`${row.student_id}:${day}`;if(attendance.has(key)||await d.prepare('SELECT id FROM attendance WHERE student_id=? AND day=?').bind(row.student_id,day).first())return fail('이미 지급한 등원 포인트가 포함되어 있어요.');attendance.add(key)}
  let ops=[] as D1PreparedStatement[];for(const row of rows){ops.push(d.prepare("UPDATE point_requests SET status='approved',reason=NULL,reviewed_at=?,reviewed_by=? WHERE id=? AND status IN ('pending','held')").bind(time,u.id,row.id),d.prepare('INSERT INTO point_history(id,student_id,points,type,reason,request_id,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),row.student_id,row.points,row.type,row.details||'관리자 일괄 승인',row.id,u.id,time));if(row.type==='attendance')ops.push(d.prepare('INSERT INTO attendance(id,student_id,day,request_id) VALUES(?,?,?,?)').bind(crypto.randomUUID(),row.student_id,dayKorea(row.requested_at),row.id))}
  await d.batch(ops);return Response.json({ok:true,count:rows.length});
 }
 if(a==='review'){let r=await d.prepare('SELECT * FROM point_requests WHERE id=?').bind(b.id).first<any>();if(!r||!['pending','held'].includes(r.status)||!['approved','held','rejected'].includes(b.status))return fail('요청 상태를 다시 확인해 주세요.');let reason=String(b.reason||'').trim();if(b.status==='held'&&!reason)return fail('보류 사유를 입력해 주세요.');if(b.status==='approved'){
 if(r.type==='attendance'){let day=dayKorea(r.requested_at),existing=await d.prepare('SELECT id FROM attendance WHERE student_id=? AND day=?').bind(r.student_id,day).first();if(existing)return fail('해당 날짜의 출석 포인트를 이미 지급했어요.')}
 let grant=r.type==='other'?Number(b.points):r.points;if(!Number.isInteger(grant)||grant<1||grant>100000)return fail('지급 포인트를 확인해 주세요.');let ops=[d.prepare("UPDATE point_requests SET status='approved',points=?,reason=NULL,reviewed_at=?,reviewed_by=? WHERE id=? AND status IN ('pending','held')").bind(grant,time,u.id,r.id),d.prepare('INSERT INTO point_history(id,student_id,points,type,reason,request_id,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,r.student_id,grant,r.type,r.details||'관리자 승인',r.id,u.id,time)];if(r.type==='attendance')ops.push(d.prepare('INSERT INTO attendance(id,student_id,day,request_id) VALUES(?,?,?,?)').bind(crypto.randomUUID(),r.student_id,dayKorea(r.requested_at),r.id));await d.batch(ops);return Response.json({ok:true})}
 await d.prepare("UPDATE point_requests SET status=?,reason=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status IN ('pending','held')").bind(b.status,reason,time,u.id,r.id).run();return Response.json({ok:true})}
 if(a==='adjust'){let target=await d.prepare("SELECT id FROM users WHERE id=? AND role='student' AND status='active'").bind(b.studentId).first();let points=Number(b.points),reason=String(b.reason||'').trim();if(!target||!Number.isInteger(points)||!points||Math.abs(points)>100000||!reason||reason.length>300)return fail('학생, 포인트, 사유를 확인해 주세요.');await d.prepare('INSERT INTO point_history(id,student_id,points,type,reason,actor_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,b.studentId,points,points>0?'special':'deduction',reason,u.id,time).run();return Response.json({ok:true})}
 if(a==='settings'){let v=[Number(b.card5000),Number(b.card10000)];if(v.some(x=>!Number.isInteger(x)||x<1||x>1000000))return fail('교환 포인트를 확인해 주세요.');await d.batch(['card5000','card10000'].map((k,i)=>d.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(k,String(v[i]))));return Response.json({ok:true})}
 if(a==='rewardReview'){let r=await d.prepare('SELECT * FROM reward_requests WHERE id=?').bind(b.id).first<any>();if(!r||!['pending','held'].includes(r.status)||!['approved','held','rejected'].includes(b.status))return fail('카드 요청 상태를 확인해 주세요.');let reason=String(b.reason||'').trim();if(b.status==='held'&&!reason)return fail('보류 사유를 입력해 주세요.');if(b.status==='approved'){if(await total(r.student_id)<r.cost)return fail('현재 잔액이 부족해요.');await d.batch([d.prepare("UPDATE reward_requests SET status='approved',delivery_status='waiting',reason=NULL,reviewed_at=?,reviewed_by=? WHERE id=? AND status IN ('pending','held')").bind(time,u.id,r.id),d.prepare('INSERT INTO point_history(id,student_id,points,type,reason,request_id,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,r.student_id,-r.cost,'reward',`${r.amount.toLocaleString()}원 카드 교환`,r.id,u.id,time)]);return Response.json({ok:true})}await d.prepare("UPDATE reward_requests SET status=?,reason=?,reviewed_at=?,reviewed_by=? WHERE id=? AND status IN ('pending','held')").bind(b.status,reason,time,u.id,r.id).run();return Response.json({ok:true})}
 if(a==='delivered'){let result=await d.prepare("UPDATE reward_requests SET delivery_status='complete' WHERE id=? AND status='approved' AND delivery_status='waiting'").bind(b.id).run();if(!result.meta.changes)return fail('지급 대기 요청을 확인해 주세요.');return Response.json({ok:true})}
 return fail('요청을 확인해 주세요.')}catch(e){console.error(e);return fail('처리 중 문제가 생겼어요. 다시 확인해 주세요.',500)}}
