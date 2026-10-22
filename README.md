[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# PrivateChat Shield — Zero-Trust AI Privacy & Governance Gateway

## Project overview

PrivateChat Shield is a zero-trust AI privacy gateway that pseudonymises Vietnamese personal data in the browser, encrypts chat history with TideCloak threshold-wrapped keys, and enforces two-person approval before sensitive prompts or files reach cloud LLMs.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality
Professionals in banking, healthcare, and law want to use frontier cloud LLMs on credit dossiers, contracts, and case notes without exposing citizen identities or surrendering plaintext history to database administrators. PrivateChat Shield combines client-side Vietnamese PII pseudonymisation, authenticated envelope encryption, and dual-control outbound review in one workflow.

### 2. Trust constraint insight
Today, using cloud AI forces an unacceptable trust trade-off: foreign AI providers see raw personal identifiers in transit, while internal database administrators or compromised servers can read stored chat histories or unilaterally grant themselves access. Removing unilateral key custody and single-actor dispatch makes institutional AI adoption possible.

### 3. Value & impact
Aligned with Vietnam's Personal Data Protection Law 91/2025/QH15 (Article 30 data minimisation in AI/cloud) and Decree 13/2023/ND-CP, credit officers and legal teams can analyse complex dossiers while keeping direct identifiers (`CCCD`, bank accounts, phones, emails, names) inside the browser and blocking unapproved or restricted uploads.

### 4. Why TideCloak matters
TideCloak wraps each conversation's root key (`doEncrypt`/`doDecrypt`) across Tide's decentralized ORK threshold fabric so neither our backend nor PostgreSQL ever holds a master decryption key. TideCloak's DPoP-bound tokens (`secureFetch`), verified `file-approver` client roles, and Quorum-Enforced Governance (QEA) prevent token replay and stop rogue administrators from unilaterally escalating permissions.

### 5. Prototype & storytelling
Judges can test three live panels:
- **Encrypted History & Security Probes:** Verify key wrap/unwrap round-trips, cross-user probe isolation, and real `AES-256-GCM` + `HKDF` tamper rejection.
- **Composer & File Guard:** Load a Vietnamese loan dossier or `.txt`/`.csv`/`.md` file, inspect/toggle detected PII or highlight custom spans, and submit for approval.
- **Reviewer Queue & Cryptographic Proof:** Approve or reject masked outbound payloads as an independent `file-approver`, then inspect the exact gateway payload and stored ciphertext.

---

## Run the demo

Requires Node.js 22+ and npm. No external API key, Docker, or Tide account is required for explicit demo mode.

```bash
npm ci --ignore-scripts
npm run dev:demo
```

Open [http://localhost:5173](http://localhost:5173). Use a demo username such as `alice` (and `reviewer` in a second window to approve outbound requests) with any passphrase of at least 12 characters (e.g. `demo-passphrase-123`). Remember both to reopen saved conversations after reloading.

Demo mode uses real WebCrypto `AES-256-GCM`/`HKDF-SHA256` encryption, enforced two-person approval (`alice` requests, `reviewer` approves), and encrypted persistence. **Identity and AI responses are explicitly simulated in demo mode.** The development key wrapper uses a browser-side PBKDF2 passphrase; it is not Tide, threshold cryptography, or production authentication. Use synthetic data only.

## Verify & Run Tests

```bash
npm test
npm run build
npm run eval:pii
npm run test:e2e
```

- `npm test`: Unit & integration tests for Vietnamese PII masking, multi-turn token stability, WebCrypto HKDF/AES-GCM/AAD tamper rejection, separation-of-duties approval workflow, DPoP proof verification, JWKS JWT verification, and embedded PostgreSQL (`PGlite`).
- `npm run build`: TypeScript typecheck (`tsc --noEmit`) + Vite production bundle.
- `npm run eval:pii`: Evaluates the Vietnamese PII detector on a 100-sentence synthetic corpus (60 dev / 40 holdout) and outputs precision/recall/latency metrics to `test-results/pii-metrics.json`.
- `npm run test:e2e`: End-to-end headless Chrome Playwright suite testing the full UI workflow.

## Live TideCloak & Gemini integrations

Copy `.env.example` to `.env` and configure your credentials locally:
- `npm run dev:tide:demo`: Connects to a live **TideCloak** instance (`http://localhost:8080`, realm `privatechat`, client `privatechat-client` via `public/tidecloak.json`) and **PostgreSQL** (`docker compose --profile tide up -d`) while using the deterministic demo AI responder.
- `npm run dev:gemini`: Tests live Gemini API with demo identity.
- `npm run dev:live`: Full live mode requiring licensed TideCloak realm, verified issuer/audience, PostgreSQL, and Gemini API key/model. Fails closed when configuration is missing.
- `npm run test:tide`: Interactive Playwright smoke test for live TideCloak login, DPoP verification, and `doEncrypt`/`doDecrypt` key wrapping.

See [Vietnamese instructions](README_VI.md), [Tide setup](docs/TIDE_SETUP.md), [file approval architecture](docs/FILE_APPROVAL.md), and [implementation status](docs/IMPLEMENTATION_STATUS.md).

## Honest Limitations

Cloud inference still receives pseudonymised business context. Automatic PII detection can miss lowercase or untitled names; interactive preview, custom dictionary, and manual text-selection masking remain necessary. This prototype does not claim full anonymity, automatic legal compliance, whole-database rollback immunity, external backup destruction, or resistance to a compromised endpoint or malicious frontend publisher. Quorum-Enforced Governance (QEA) is enforced in the real Tide Console.
