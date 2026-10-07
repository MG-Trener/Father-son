import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage; create schema extensions;
create table auth.users(id uuid primary key,email text,phone text,email_confirmed_at timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
create table auth.mfa_amr_claims(session_id uuid references auth.sessions(id),authentication_method text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create function extensions.digest(text,text) returns bytea language sql immutable as $$ select sha256(convert_to($1,'UTF8')) $$;
grant usage on schema auth to authenticated,anon; grant execute on all functions in schema auth to authenticated,anon;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[],updated_at timestamptz);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated; grant all on storage.objects to authenticated;
create publication supabase_realtime;
`);
const read = name => fs.readFile(path.join(root,name),'utf8');
for(const name of (await fs.readdir(path.join(root,'supabase/baseline'))).filter(x=>x.endsWith('.sql')).sort()) {
 let sql=await read('supabase/baseline/'+name);
 sql=sql.replace('create extension if not exists pgcrypto with schema extensions;','-- pgcrypto digest is shimmed with PostgreSQL sha256 for this local harness.');
 await db.exec(sql);
}
for(const name of (await fs.readdir(path.join(root,'supabase/migrations'))).filter(x=>x.endsWith('.sql')&&!x.includes('protect_owner_access')).sort()) {
 try { await db.exec(await read('supabase/migrations/'+name)); } catch(e) { console.error('BASELINE FAIL',name,e.message); process.exit(1); }
}
const owner='10000000-0000-0000-0000-000000000001', child='10000000-0000-0000-0000-000000000002';
const family='20000000-0000-0000-0000-000000000001';
const legacy='30000000-0000-0000-0000-000000000001', password='30000000-0000-0000-0000-000000000002', otp='30000000-0000-0000-0000-000000000003';
await db.exec(`insert into auth.users values ('${owner}','owner@example.test',null,now()),('${child}','child@example.test',null,now());
insert into public.families(id,created_by) values ('${family}','${owner}');
insert into public.family_members(family_id,user_id,role,display_name) values ('${family}','${owner}','parent','Owner');
insert into auth.sessions values ('${legacy}','${owner}',null);`);
await db.exec(await read('supabase/migrations/20261007111031_protect_owner_access.sql'));
await db.exec(`insert into auth.sessions values ('${password}','${owner}',null),('${otp}','${owner}',null); insert into auth.mfa_amr_claims values ('${password}','password'),('${otp}','otp');`);
let passed=0;
const claims = async(user,session,extra={}) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:session,role:'authenticated',...extra})]); await db.exec('set role authenticated'); };
const check = async(name,fn) => { await fn(); passed++; console.log('PASS '+name); };
const scalar=async(sql)=>(await db.query(sql)).rows[0];
await claims(owner,legacy);
await check('existing father session retains membership',async()=> { assert.equal((await scalar('select private.is_app_session_allowed() as ok')).ok,true); assert.equal((await db.query('select * from public.family_members')).rows.length,1); });
const invite = (await scalar(`select public.create_family_invite('${family}',null) as data`)).data.invite_code;
await claims(owner,password,{amr:[{method:'otp'}],user_metadata:{role:'parent',approved:true}});
await check('new password session cannot forge approval through JWT metadata',async()=>assert.equal((await scalar('select private.is_app_session_allowed() as ok')).ok,false));
await check('new password session sees neither family nor membership',async()=>{assert.equal((await db.query('select * from public.families')).rows.length,0);assert.equal((await db.query('select * from public.family_members')).rows.length,0);});
await check('owner status requests email confirmation',async()=>assert.equal((await scalar('select public.get_account_access() as data')).data.requires_confirmation,true));
for(const [label,sql] of [
['invite',`select public.create_family_invite('${family}',null)`],
['letter open',`select public.open_future_letter('${family}')`],
['letter seal',`select public.seal_future_letter('${family}')`],
['letter delete',`select public.delete_future_letter_draft('${family}')`],
['letter update',`select public.update_future_letter_draft('${family}','title','body',now()+interval '1 year','${owner}')`],
['push',`select public.register_push_device('ExponentPushToken[aaaaaaaaaaaa]','android')`]
]) await check('blocked '+label+' RPC',async()=>await assert.rejects(db.exec(sql),/OWNER_EMAIL_CONFIRMATION_REQUIRED/));
await check('blocked voice storage predicate',async()=>assert.equal((await scalar(`select private.can_access_voice_object('${family}/${owner}/voice.m4a') as ok`)).ok,false));
await claims(child,null);
await check('another account cannot activate father through old RPC',async()=>await assert.rejects(db.exec("select public.create_family_team('Other father','Other family')"),/OWNER_ACCOUNT_REQUIRED/));
await check('son joins correct family with invite and child role',async()=>{ const joined=(await scalar(`select public.join_family_by_code('${invite}','Son',null) as data`)).data; assert.equal(joined.role,'child'); assert.equal(joined.family_id,family); });
await check('son still reads family',async()=>assert.equal((await db.query('select * from public.family_members')).rows.length,2));
await check('son cannot update role directly',async()=>await assert.rejects(db.exec(`update public.family_members set role='parent' where user_id='${child}'`),/permission denied/));
await claims(owner,otp);
await check('email OTP session restores father access',async()=>{assert.equal((await scalar('select private.is_app_session_allowed() as ok')).ok,true);assert.equal((await db.query('select * from public.family_members')).rows.length,2);});
await db.exec('reset role'); await db.exec(`delete from auth.mfa_amr_claims where session_id='${otp}'; delete from auth.sessions where id='${otp}';`); await claims(owner,otp);
await check('revoked approved session is denied immediately',async()=>assert.equal((await scalar('select private.is_app_session_allowed() as ok')).ok,false));
await claims('10000000-0000-0000-0000-000000000099',null);
await check('deleted account token cannot access family',async()=>assert.equal((await scalar('select private.is_app_session_allowed() as ok')).ok,false));
await db.exec('reset role');
for(const name of ['security_invariants.sql','access_matrix_invariants.sql','client_privilege_invariants.sql','storage_invariants.sql']) await check(name,async()=>await db.exec(await read('supabase/tests/'+name)));
console.log(JSON.stringify({passed,engine:'PGlite PostgreSQL',productionModified:false}));
await db.close();


