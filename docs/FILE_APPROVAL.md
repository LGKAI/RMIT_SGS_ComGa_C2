# Dual-Control Document Approval Architecture

## Overview

The outbound approval pipeline ensures that confidential documents and chat prompts undergo two-tier client-side pseudonymization and cryptographic dual-control before being dispatched to cloud AI providers.

```
+-----------------------------------------------------------+
| 1. Author (Lê Gia Khánh) uploads file or enters prompt    |
|    - Local parser extracts text (.txt, .md, .csv, PDF, img)|
|    - Rule-based & regex Vietnamese PII detector runs      |
|    - Identifiers mapped to synthetic tokens (Nguoi_A, etc)|
+-----------------------------+-----------------------------+
                              |
                              v
+-----------------------------------------------------------+
| 2. Outbound Approval Request Created                      |
|    - SHA-256 payload digest generated                     |
|    - Encrypted in preview storage with AES-256-GCM        |
|    - Status: Pending Review                               |
+-----------------------------+-----------------------------+
                              |
                              v
+-----------------------------------------------------------+
| 3. Dual-Control Reviewer (Cái Hoàng Bảo Kin)              |
|    - Must hold 'file-approver' client role                |
|    - Author CANNOT self-approve (Separation of Duties)    |
|    - Inspects pseudonymized content & classification      |
|    - Approves or Rejects the request                      |
+-----------------------------+-----------------------------+
                              |
                              v
+-----------------------------------------------------------+
| 4. Cloud LLM Dispatch & Provider Receipt                  |
|    - Gateway enforces single-use CAS state transition     |
|    - Admin AI / Provider (Trần Trung Hiếu) sees 0% PII    |
|    - Response returned and unmasked locally on client     |
+-----------------------------------------------------------+
```

---

## Technical Specifications

1. **Client-Side Document Parsing & OCR**:
   - Supports `.txt`, `.csv`, `.md`, PDF documents (via PDF.js), and image files (`.png`, `.jpg`, `.jpeg` via client-side OCR).
   - Document contents are extracted purely within the browser sandbox; raw binary files never leave the browser.
2. **Deterministic Pseudonymization**:
   - Vietnamese Citizen IDs (`CCCD`), phone numbers, bank accounts, emails, and full names are replaced with consistent namespace tokens.
   - The unmasking mapping dictionary is retained solely within the author's encrypted client state.
3. **Approval Lifecycle & Replay Defense**:
   - Requests expire after 10 minutes.
   - A Compare-And-Swap (CAS) transition from `approved` to `consumed` ensures each approval token can be redeemed exactly once.
   - Tampering with any field (question, model, purpose, classification) invalidates the SHA-256 digest and triggers an immediate gateway rejection.
