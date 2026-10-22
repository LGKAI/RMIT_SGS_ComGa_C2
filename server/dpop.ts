import { createHash } from 'node:crypto';
import { calculateJwkThumbprint, decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import type { Request } from 'express';
export function dpopVerifier(origin: string) {
  const seen = new Map<string, number>();
  return async (req: Request, token: string, claims: JWTPayload) => {
    if (!req.headers.authorization?.startsWith('DPoP ')) throw new Error('DPoP required');
    const proof = req.headers.dpop; if (typeof proof !== 'string' || proof.length > 16000) throw new Error('Invalid proof');
    const header = decodeProtectedHeader(proof);
    if (header.typ?.toLowerCase() !== 'dpop+jwt' || header.alg !== 'ES256' || !header.jwk || 'd' in header.jwk) throw new Error('Invalid public key');
    const key = await importJWK(header.jwk, 'ES256');
    const { payload: p } = await jwtVerify(proof, key, { algorithms: ['ES256'], typ: 'dpop+jwt', requiredClaims: ['jti', 'htm', 'htu', 'iat', 'ath'] });
    const now = Math.floor(Date.now() / 1000);
    if (typeof p.iat !== 'number' || p.iat < now - 60 || p.iat > now + 5 || typeof p.jti !== 'string' || !p.jti || p.jti.length > 200) throw new Error('Invalid proof age');
    const target = new URL(req.originalUrl, origin); target.search = ''; target.hash = '';
    if (p.htm !== req.method.toUpperCase() || p.htu !== target.href || p.ath !== createHash('sha256').update(token).digest('base64url')) throw new Error('Invalid request binding');
    const jkt = await calculateJwkThumbprint(header.jwk, 'sha256');
    if ((claims.cnf as { jkt?: string } | undefined)?.jkt !== jkt) throw new Error('Invalid token key binding');
    for (const [k, expires] of seen) if (expires < now) seen.delete(k);
    const replay = `${jkt}:${p.jti}`; if (seen.has(replay) || seen.size >= 10000) throw new Error('Replayed proof'); seen.set(replay, now + 66);
  };
}
