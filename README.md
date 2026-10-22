[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# CarePassport — Zero-Trust Cross-Hospital Medical Consent Vault

## Project overview

CarePassport is a patient-governed medical data vault that eliminates single-admin master keys, enabling trusted cross-hospital record sharing under strict patient-doctor emergent consent.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality
CarePassport replaces fragmented, centralized hospital EHR silos with a patient-sovereign medical vault. Patients granularly grant time-bound, purpose-specific access (e.g., blood tests, allergies) across any healthcare network, while sensitive records (psychiatry, genetics) remain cryptographically locked without explicit patient co-authorization.

### 2. Trust constraint insight
Today, hospitals refuse to federate EHRs and patients withhold sensitive health history because traditional systems grant IT database administrators unilateral master-key access to raw records. Removing the single-admin vulnerability makes zero-trust medical collaboration across competing hospitals credibly possible.

### 3. Value & impact
Patients gain total sovereignty over their health history without fear of leaks or insurer discrimination. Emergency clinicians instantly access verified, life-saving allergy and prescription profiles without bureaucratic transfer delays, directly preventing fatal medication errors.

### 4. Why TideCloak matters
Conventional RBAC allows database administrators to override permissions and view confidential patient records. TideCloak’s Emergent Authority ensures decryption keys never exist statically: access only emerges dynamically when patient consent policies, clinician credentials, and dual-authorization criteria align. Unilateral hospital admin overrides are blocked at the cryptographic layer.

### 5. Prototype & storytelling
The prototype demonstrates a cross-hospital consultation between RMIT Health Clinic and Cho Ray General Hospital. Key interactions judges should observe:
- Patient granting granular 30-minute access for Lab & Allergy records while locking psychiatric notes.
- A rogue hospital administrator attempting an unilateral database override and getting **BLOCKED by TideCloak**.
- Dynamic emergence of the authorized clinical view once dual consent is signed.

---

## Setup & Running Locally

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Quickstart
```bash
# Clone the repository
git clone https://github.com/leogiakhanh/RMIT_SGS_ComGa_C2.git
cd RMIT_SGS_ComGa_C2

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to experience the CarePassport prototype.

### TideCloak Integration
- `@tidecloak/react` handles identity assertion and decentralized authorization verification.
- In demo/sandbox mode, the application simulates live cryptographic policy enforcement with active audit logging of blocked unilateral attempts.
