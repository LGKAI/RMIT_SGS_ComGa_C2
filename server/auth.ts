import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import type { Request } from 'express';
import { APPROVER_ROLE } from '../shared/contracts';
import type { Identity } from '../shared/contracts';
import { HttpError } from './store';
import { dpopVerifier } from './dpop';
export const makeOwnerId = (issuer: string, sub: string) => createHash('sha256').update(JSON.stringify([issuer, sub])).digest('base64url');
export function createAuth(mode: 'demo' | 'tide', issuer: string, audience: string, resourceOrigin?: string) {
  if (mode === 'tide' && (!issuer || !audience)) throw new Error('TIDE_ISSUER and TIDE_AUDIENCE are required in live mode');
  if (mode === 'tide' && !/^https?:\/\//.test(issuer)) throw new Error('Invalid Tide issuer');
  if (mode === 'tide') { const url = new URL(issuer); if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Non-local Tide issuer requires HTTPS'); }
  const demoKey = randomBytes(32);
  const verifyProof = resourceOrigin && mode === 'tide' ? dpopVerifier(resourceOrigin) : undefined;
  const jwks = mode === 'tide' ? createRemoteJWKSet(new URL(`${issuer.replace(/\/$/, '')}/protocol/openid-connect/certs`), { timeoutDuration: 5000 }) : undefined;
  return {
    async demoLogin(username: string): Promise<Identity> {
      if (mode !== 'demo') throw new HttpError(404, 'NOT_FOUND');
      const sub = username.toLowerCase();
      const canApproveFiles = sub === 'reviewer'; // Fixed, openly impersonable demo identity; never used by live auth.
      const token = await new SignJWT({ preferred_username: sub, resource_access: { 'privatechat-demo': { roles: canApproveFiles ? [APPROVER_ROLE] : [] } } }).setProtectedHeader({ alg: 'HS256' }).setIssuer('privatechat-demo').setAudience('privatechat-demo').setSubject(sub).setIssuedAt().setExpirationTime('1h').sign(demoKey);
      return { username: sub, ownerId: makeOwnerId('privatechat-demo', sub), token, canApproveFiles };
    },
    async verify(req: Request): Promise<Identity> {
      const token = req.headers.authorization?.match(/^(?:Bearer|DPoP) ([^\s]+)$/)?.[1];
      if (!token) throw new HttpError(401, 'UNAUTHORIZED');
      try {
        const { payload } = mode === 'demo'
          ? await jwtVerify(token, demoKey, { issuer: 'privatechat-demo', audience: 'privatechat-demo', algorithms: ['HS256'] })
          : await jwtVerify(token, jwks!, { issuer, audience, algorithms: ['RS256', 'ES256', 'EdDSA'], requiredClaims: ['exp', 'sub', 'iss'] });
        if (!payload.sub || !payload.iss) throw new Error();
        if (verifyProof) await verifyProof(req, token, payload);
        else if (payload.cnf) throw new Error('Bound tokens require request proof verification');
        const resource = payload.resource_access as Record<string, { roles?: unknown }> | undefined;
        const roles = resource?.[mode === 'demo' ? 'privatechat-demo' : audience]?.roles;
        return { token, username: String(payload.preferred_username ?? payload.sub), ownerId: makeOwnerId(payload.iss, payload.sub), canApproveFiles: Array.isArray(roles) && roles.includes(APPROVER_ROLE) };
      } catch { throw new HttpError(401, 'UNAUTHORIZED'); }
    },
  };
}
