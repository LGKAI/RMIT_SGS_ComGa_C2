import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { TideCloakContextProvider, useTideCloak } from '@tidecloak/react';
import type { Identity, PublicConfig } from '../../shared/contracts';
import { api, setAuthenticatedFetch } from '../lib/api';
import { demoUnwrap, demoWrap, fromBase64, toBase64 } from '../lib/crypto';
interface AuthValue {
  identity: Identity | null; mode: 'demo' | 'tide'; loading: boolean; error: string;
  login: (username?: string, passphrase?: string) => Promise<void>; logout: () => void;
  getToken: () => Promise<string>; wrap: (raw: Uint8Array<ArrayBuffer>, id: string) => Promise<string>;
  unwrap: (wrapped: string, id: string) => Promise<Uint8Array<ArrayBuffer>>;
}
const Context = createContext<AuthValue | null>(null);
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('Auth provider missing'); return value; }
const DEFAULT_PASSPHRASE = 'comga-rmit-hackathon-passphrase-2026';
function DemoAuth({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [passphrase, setPassphrase] = useState(DEFAULT_PASSPHRASE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async (username = 'giakhanh', secret = DEFAULT_PASSPHRASE) => {
    setLoading(true);
    setError('');
    try {
      const activePassphrase = secret && secret.length >= 12 ? secret : DEFAULT_PASSPHRASE;
      const me = await api<Identity>('/demo/session', null, { method: 'POST', body: { username } });
      setPassphrase(activePassphrase);
      setIdentity(me);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!identity) {
      void login('giakhanh', DEFAULT_PASSPHRASE);
    }
  }, []);

  const value: AuthValue = {
    identity,
    mode: 'demo',
    loading,
    error,
    login,
    logout: () => {
      // Revert to default user rather than showing a dead login screen
      void login('giakhanh', DEFAULT_PASSPHRASE);
    },
    getToken: async () => {
      if (!identity) throw new Error('Chưa đăng nhập.');
      return identity.token;
    },
    wrap: async (raw, id) => {
      if (!identity) throw new Error('Chưa đăng nhập.');
      return demoWrap(raw, passphrase, identity.ownerId, id);
    },
    unwrap: async (wrapped, id) => {
      if (!identity) throw new Error('Chưa đăng nhập.');
      return demoUnwrap(wrapped, passphrase, identity.ownerId, id);
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function TideBridge({ children }: { children: ReactNode }) {
  const sdk = useTideCloak(); const [identity, setIdentity] = useState<Identity | null>(null); const [error, setError] = useState('');
  useEffect(() => { setAuthenticatedFetch(sdk.secureFetch as typeof fetch); return () => setAuthenticatedFetch(null); }, [sdk.secureFetch]);
  const getToken = useCallback(async () => { const token = await sdk.getToken(); if (!token) throw new Error('Tide chưa cấp access token.'); return token; }, [sdk.getToken]);
  useEffect(() => {
    let cancelled = false; setIdentity(null); setError('');
    if (sdk.authenticated) void (async () => {
      try { const token = await getToken(); const me = await api<Omit<Identity, 'token'>>('/me', token); if (!cancelled) setIdentity({ ...me, token }); }
      catch { if (!cancelled) setError('Không xác minh được phiên Tide tại backend. Kiểm tra issuer/audience và client.'); }
    })();
    return () => { cancelled = true; };
  }, [sdk.authenticated, getToken]);
  const value: AuthValue = { identity, mode: 'tide', loading: sdk.isInitializing || sdk.isLoading, error: error || sdk.initError?.message || '',
    login: async () => { await sdk.login(); }, logout: () => { setIdentity(null); void sdk.logout(); }, getToken,
    wrap: async raw => {
      const [encrypted] = await sdk.doEncrypt([{ data: toBase64(raw), tags: ['chat'] }]);
      if (typeof encrypted === 'string') return JSON.stringify({ mode: 'tide-v1', format: 'string', encrypted });
      if (encrypted instanceof Uint8Array) return JSON.stringify({ mode: 'tide-v1', format: 'bytes', encrypted: toBase64(new Uint8Array(encrypted)) });
      throw new Error('Định dạng bản mã Tide chưa được hỗ trợ. Không dùng khóa dự phòng.');
    },
    unwrap: async wrapped => {
      const w = JSON.parse(wrapped); if (w.mode !== 'tide-v1' || !['string', 'bytes'].includes(w.format)) throw new Error('Sai key provider.');
      const [clear] = await sdk.doDecrypt([{ encrypted: w.format === 'bytes' ? fromBase64(w.encrypted) : w.encrypted, tags: ['chat'] }]);
      const raw = fromBase64(typeof clear === 'string' ? clear : new TextDecoder().decode(clear));
      if (raw.length !== 32) throw new Error('Khóa Tide không hợp lệ.'); return raw;
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function AuthProvider({ config, children }: { config: PublicConfig; children: ReactNode }) {
  const providerOptions = useMemo(() => ({ redirectUri: `${location.origin}/auth/redirect`, useDPoP: true }), []);
  return config.authMode === 'demo' ? <DemoAuth>{children}</DemoAuth> : <TideCloakContextProvider configUrl="/tidecloak.json" config={providerOptions}><TideBridge>{children}</TideBridge></TideCloakContextProvider>;
}
