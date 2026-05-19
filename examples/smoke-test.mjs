// Live smoke test: verifies the built SDK against production realstamp.app endpoints.
// Usage: node examples/smoke-test.mjs
import { RealStampClient } from '../dist/index.mjs';

const client = new RealStampClient();

// Known fixtures (collected during the audit on 2026-05-19):
const ACTIVE_SHARE_LINK = 'n956fh8d6';
const REVOKED_SHARE_LINK = 'dvaiidsni';

console.log('━━━ @realstamp/verify smoke test ━━━\n');

// --- Test 1: active stamp via share link ---
console.log('▶ verifyStamp({ shareLinkId: active })');
const t1 = await client.verifyStamp({ shareLinkId: ACTIVE_SHARE_LINK });
console.log('  valid:           ', t1.valid);
console.log('  cryptoVerified:  ', t1.cryptoVerified);
console.log('  isRevoked:       ', t1.isRevoked);
console.log('  verificationMethod:', t1.verificationMethod);
console.log('  currentStatus.status:', t1.currentStatus?.status);
console.log('  pass:', t1.valid === true && t1.isRevoked === false ? '✓' : '✗');
console.log();

// --- Test 2: revoked stamp via share link ---
console.log('▶ verifyStamp({ shareLinkId: revoked })');
const t2 = await client.verifyStamp({ shareLinkId: REVOKED_SHARE_LINK });
console.log('  valid:           ', t2.valid);
console.log('  cryptoVerified:  ', t2.cryptoVerified);
console.log('  isRevoked:       ', t2.isRevoked);
console.log('  revocationReason:', t2.revocationReason);
console.log('  revokedAt:       ', t2.revokedAt);
console.log('  currentStatus.status:', t2.currentStatus?.status);
console.log('  pass:', t2.valid === false && t2.isRevoked === true && t2.revocationReason ? '✓' : '✗');
console.log();

// --- Test 3: recent revocations feed ---
console.log('▶ getRecentRevocations({ limit: 5 })');
const t3 = await client.getRecentRevocations({ limit: 5 });
console.log('  count:', t3.revocations.length);
for (const r of t3.revocations.slice(0, 3)) {
  console.log(`  - ${r.stampId.slice(0, 8)}…  reason=${r.revocationReason}  share=${r.shareLinkId}`);
}
console.log('  pass:', Array.isArray(t3.revocations) ? '✓' : '✗');
console.log();

// --- Test 4: revocation status lookup ---
console.log('▶ getRevocationStatus(<revoked stamp UUID>)');
const t4 = await client.getRevocationStatus('95f3177d-fce4-4734-8500-6c4fa011f6ed');
console.log('  status:          ', t4.status);
console.log('  revocationReason:', t4.revocationReason);
console.log('  pass:', t4.status === 'withdrawn' && t4.revocationReason ? '✓' : '✗');
console.log();

// --- Test 5: error handling — bad share link ---
console.log('▶ verifyStamp({ shareLinkId: bogus }) — expecting RealStampError');
try {
  await client.verifyStamp({ shareLinkId: 'X'.repeat(40) });
  console.log('  pass: ✗ (should have thrown)');
} catch (err) {
  console.log('  error.code:', err.code);
  console.log('  error.status:', err.status);
  console.log('  pass:', err.code === 'bad_share_link_id' ? '✓' : '✗');
}
console.log();

console.log('━━━ done ━━━');
