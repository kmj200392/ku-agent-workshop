export const FINAL_CANDIDATE_SQL = `SELECT id,code,hash,provider,model FROM runs WHERE owner=? AND kind='practice' AND status='completed' AND finished<? AND suite=? ORDER BY created DESC LIMIT 1`;
