[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# PrivateChat Shield — Zero-Trust AI Privacy Gateway

## Project overview

PrivateChat Shield is a zero-trust AI privacy gateway combining TideCloak threshold envelope encryption, Quorum-enforced governance (QEA), and client-side Vietnamese PII pseudonymisation compliant with Law 91/2025/QH15.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality
Enterprises and professionals paste confidential banking dossiers, medical files, and M&A contracts into AI models. PrivateChat Shield guarantees that neither cloud LLMs nor rogue database administrators can ever read their plaintext conversations.

### 2. Trust constraint insight
Under traditional architectures, AI vendors and database administrators hold root access to chat databases, while foreign cloud LLMs receive raw citizen PII. Removing single-admin authority and decentralizing key custody enables institutional AI adoption under strict data protection mandates.

### 3. Value & impact
Enforces technical compliance for Vietnam's Personal Data Protection Law 91/2025/QH15 (Article 30 on AI & Cloud) and Decree 13/2023/ND-CP. Banks, hospitals, and law firms can leverage frontier LLMs with 0.00% PII leakage to foreign clouds.

### 4. Why TideCloak matters
TideCloak's decentralized ORK network wraps conversation keys with threshold cryptography, eliminating static master keys. Furthermore, Quorum-Enforced Governance (QEA) neutralizes "God Admins": unilateral role escalation attempts are converted into Change Requests requiring independent admin signatures before decryption.

### 5. Prototype & storytelling
Experience our live 3-column synchronized inspector:
- **Client Safe Zone:** 100% in-browser PII detection (CCCD, banking accounts, names) and real-time masking before transmission.
- **Stateless AI Gateway:** Cloud LLM receives only anonymized tokens with an HMAC-signed Anonymous Quota Ticket.
- **Postgres & Quorum Defense:** 100% AES-256-GCM ciphertext, real-time DBA tamper detection via WebCrypto AAD verification, and interactive Quorum approval.

---

## Setup & Running Locally

### Quickstart
```bash
# Clone the repository
git clone https://github.com/LGKAI/RMIT_SGS_ComGa_C2.git
cd RMIT_SGS_ComGa_C2

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### TideCloak Integration
- `@tidecloak/react` handles identity assertion and decentralized emergent token verification.
- The web app connects with the TideCloak Docker dev container:
  ```bash
  docker run -d -p 8080:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=password tideorg/tidecloak-dev:latest
  ```
