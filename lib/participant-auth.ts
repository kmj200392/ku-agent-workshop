import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { db, getClient } from './database';

const COOKIE = 'ku_workshop_session';
const MAX_AGE = 30 * 24 * 60 * 60;
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const nicknamePattern = /^[\p{L}\p{N} _.-]+$/u;

export async function getParticipant() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const user = await db().prepare('SELECT p.id AS userId, p.nickname FROM sessions s JOIN participants p ON p.id=s.owner WHERE s.token_hash=? AND s.expires>?').bind(digest(token), Date.now()).first();
  return user as {userId: string; nickname: string} | null;
}

export async function authRateLimit(req: Request, mode: 'register' | 'login') {
  // Vercel overwrites this header with the observed client address. The plain
  // address is never persisted. A minute bucket allows a classroom behind NAT.
  const ip = process.env.VERCEL ? req.headers.get('x-vercel-forwarded-for') || 'unknown' : 'local';
  const bucket = `${Math.floor(Date.now()/60000)}:${mode}:${digest(ip).slice(0,32)}`;
  const row = await db().prepare('INSERT INTO auth_attempts(bucket,attempts) VALUES(?,1) ON CONFLICT(bucket) DO UPDATE SET attempts=auth_attempts.attempts+1 RETURNING attempts').bind(bucket).first();
  return Number(row.attempts) <= (mode === 'register' ? 60 : 120);
}

async function setSession(token: string) {
  (await cookies()).set(COOKIE, token, {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: MAX_AGE});
}

export async function registerParticipant(nickname: string) {
  const userId = randomUUID();
  const accessCode = randomBytes(18).toString('hex').match(/.{1,6}/g)!.join('-');
  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  await getClient().batch([
    {sql:'INSERT INTO participants(id,nickname,created,access_hash) VALUES(?,?,?,?)',args:[userId,nickname,now,digest(accessCode.replaceAll('-',''))]},
    {sql:'INSERT INTO sessions(token_hash,owner,expires) VALUES(?,?,?)',args:[digest(token),userId,now+MAX_AGE*1000]},
  ], 'write');
  await setSession(token);
  return {accessCode,nickname};
}

export async function loginParticipant(code: string) {
  const normalized = code.trim().toLowerCase().replaceAll('-','');
  if (!/^[a-f0-9]{36}$/.test(normalized)) return false;
  const user = await db().prepare('SELECT id FROM participants WHERE access_hash=?').bind(digest(normalized)).first();
  if (!user) return false;
  const token = randomBytes(32).toString('hex');
  await db().prepare('INSERT INTO sessions(token_hash,owner,expires) VALUES(?,?,?)').bind(digest(token),user.id,Date.now()+MAX_AGE*1000).run();
  await setSession(token);
  return true;
}

export async function logoutParticipant() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db().prepare('DELETE FROM sessions WHERE token_hash=?').bind(digest(token)).run();
  jar.set(COOKIE, '', {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite:'lax',path:'/',maxAge:0});
}
