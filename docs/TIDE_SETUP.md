# TideCloak Integration & QEA Verification Guide

## Overview

PrivateChat Shield integrates TideCloak (`@tidecloak/react`) for decentralized key encapsulation and dual-control Quorum-Enforced Authorization (QEA).

The live TideCloak development node is hosted via Docker on `http://localhost:8080`.

- **TideCloak User Account Console**: [http://localhost:8080/realms/myrealm/account/](http://localhost:8080/realms/myrealm/account/)
- **TideCloak Admin Console**: [http://localhost:8080/admin/](http://localhost:8080/admin/)
- **OpenID Discovery**: [http://localhost:8080/realms/myrealm/.well-known/openid-configuration](http://localhost:8080/realms/myrealm/.well-known/openid-configuration)

---

## 1. Hackathon Threat Model Personas

To simulate real-world enterprise zero-trust workflows, PrivateChat Shield models 4 distinct personas:

| Persona | System Role & Authority | Security Boundary / Perspective |
|---|---|---|
| **Lê Gia Khánh** | **Enterprise User / Requester** | Authors prompts, attaches sensitive credit dossiers / PDFs / OCR images. Holds client-side unmasking key. Cannot self-approve. |
| **Cái Hoàng Bảo Kin** | **Security Reviewer / Gatekeeper** | Holds `file-approver` authority. Inspects pseudonymized payloads before they leave the enterprise perimeter. |
| **Trần Trung Hiếu** | **Cloud AI Vendor / "Admin AI" Auditor** | Simulates the untrusted cloud AI provider. Receives **0.00% raw PII**, only consistent pseudonymized tokens. |
| **Phạm Chấn Khoa** | **Database Administrator (DBA)** | Privileged storage insider. Can inspect raw PostgreSQL disk/tables, but encounters exclusively `AES-256-GCM` ciphertext. |

---

## 2. TideCloak Setup Steps

1. **Launch Docker Desktop**: Ensure the Docker daemon is active.
2. **Start TideCloak**: Run `docker compose --profile tide up -d` or use the existing active container `tidecloak`.
3. **Access Realm**:
   - Access `http://localhost:8080/` to configure realm `myrealm` (or `privatechat`).
   - Create a public client: `privatechat-client` with Redirect URI `http://localhost:5173/*` and Web Origin `http://localhost:5173`.
4. **QEA Dual Admin Enrollment**:
   - Create two independent administrators in TideCloak.
   - Configure Quorum-Enforced Authorization so that role grants require 2 signatures.
5. **Role Mapping**:
   - Configure the client role `file-approver` and assign it to reviewer accounts (such as Cái Hoàng Bảo Kin).
6. **Environment Configuration**:
   - Populate `.env` with:
     ```env
     TIDE_ISSUER=http://localhost:8080/realms/myrealm
     TIDE_AUDIENCE=privatechat-client
     APPROVAL_STORAGE_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
     ```
7. **Launch Live Mode**:
   ```bash
   npm run dev:tide:demo
   # or full live mode with cloud LLM:
   npm run dev:live
   ```

---

## 3. Cryptographic Probe Verification

| Test Case | Procedure | Expected Verification |
|---|---|---|
| **Round-Trip Wrap/Unwrap** | Log in as Lê Gia Khánh; click "Probe Key Provider" | Root key hash after unwrap matches pre-wrap exactly |
| **Cross-User Isolation** | Export probe payload from Lê Gia Khánh; attempt opening with Cái Hoàng Bảo Kin | Fabric/SDK rejects unwrapping; keys never leak |
| **Ciphertext Tampering** | Mutate one ciphertext byte in storage | WebCrypto AES-GCM tag check triggers immediate tamper error |
| **Admin AI Leakage Check** | Inspect Gateway Outbound Payload under Trần Trung Hiếu | 0 raw PII leakage; all identifiers replaced by stable UUID tokens |

---

## 4. References & Documentation

- [TideCloak React SDK Guide](https://docs.tide.org/Languages/React/tidecloak-react-tutorial)
- [Tide E2EE Setup](https://docs.tide.org/Admin/e2ee)
- [Quorum-Enforced Authorization (QEA)](https://docs.tide.org/Admin/SetupIGA)
