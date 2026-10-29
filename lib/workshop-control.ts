import {db} from './database';
import {CONFIG,phase} from './config';

// Existing public submission by the instructor, verified before enabling control.
// Bind authority to its immutable owner; copying or changing a nickname is insufficient.
export const INSTRUCTOR_RUN_ID='eac43392b6c1407d09c7395db3f06dbe7217cb7fb1da452e15f770184f8bab2d';
export const FINAL_WINDOW_MS=20*60*1000;
export async function isInstructor(user:{userId:string;nickname:string}|null){
 if(!user||user.nickname!=='민재')return false;
 return !!await db().prepare('SELECT id FROM runs WHERE id=? AND owner=?').bind(INSTRUCTOR_RUN_ID,user.userId).first();
}
export async function workshopSchedule(now=Date.now()){
 const row=await db().prepare('SELECT freeze_at,close_at FROM workshop_control WHERE version=?').bind(CONFIG.finalVersion).first<{freeze_at:number;close_at:number}>();
 const freezeAt=row?new Date(Number(row.freeze_at)).toISOString():CONFIG.freezeAt;
 const closeAt=row?new Date(Number(row.close_at)).toISOString():CONFIG.closeAt;
 return {freezeAt,closeAt,manualStart:!!row,phase:phase(now,{freezeAt,closeAt})};
}
