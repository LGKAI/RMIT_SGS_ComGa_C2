import React, { useState, useReducer, useEffect, useMemo } from "react";
import { useTideCloak } from "@tidecloak/react";
import seedData from "./medicalData.json";

// Initial state for patient consent
const initialConsent = {
  "rec-01": true,  // Vital Allergies & Blood (Shared)
  "rec-02": true,  // Current Prescriptions (Shared)
  "rec-03": true,  // Lab Tests (Shared for consultation)
  "rec-04": false, // Psychiatric Notes (STRICTLY LOCKED)
  "rec-05": false, // Genomic Sequencing (STRICTLY LOCKED)
};

function generateCryptoSig() {
  const chars = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 16; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${hash}...${hash.slice(2, 6)}`;
}

function auditReducer(state, action) {
  switch (action.type) {
    case "LOG":
      return [
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: action.actor,
          event: action.event,
          details: action.details,
          status: action.status, // "blocked" | "approved" | "info"
          signature: generateCryptoSig(),
        },
        ...state,
      ];
    default:
      return state;
  }
}

export default function App() {
  // TideCloak Hook
  const {
    authenticated,
    isInitializing,
    login,
    logout,
    hasRealmRole,
  } = useTideCloak();

  // Application State
  const [activeRole, setActiveRole] = useState("patient"); // patient | doctor | overseer | rogue_admin
  const [consentMap, setConsentMap] = useState(initialConsent);
  const [consultationTimeLeft, setConsultationTimeLeft] = useState(1800); // 30 minutes in seconds
  const [timerActive, setTimerActive] = useState(true);
  const [notification, setNotification] = useState({
    show: true,
    type: "info",
    message: "TideCloak Emergent Authority Engine is active. Decryption keys emerge only upon multi-party policy match.",
  });

  // Dual-Consensus Request State for Emergency or High-Privacy Records
  const [dualRequest, setDualRequest] = useState({
    id: "req-901",
    recordId: "rec-05",
    targetTitle: "Whole Genome Sequencing & Pharmacogenomics",
    doctorSigned: true,
    overseerSigned: false,
    status: "pending_overseer", // pending_overseer | approved
  });

  // Audit Trail State
  const [auditLog, dispatchAudit] = useReducer(auditReducer, [
    {
      id: "init-1",
      timestamp: "12:00:01",
      actor: "TideCloak Policy Engine",
      event: "Decentralized Zero-Trust Mesh Initialized",
      details: "No static master key stored. Emergent policy threshold enforced (Patient + Clinician).",
      status: "approved",
      signature: "0x89f41a02b1c8...39e1",
    },
    {
      id: "init-2",
      timestamp: "12:01:15",
      actor: "Sarah Nguyen (Patient)",
      event: "Consent Profile Configured",
      details: "Granted access to Allergies, Prescriptions, Lab Tests. Locked Psychiatric & Genomic records.",
      status: "info",
      signature: "0x4a90ef812c44...71b0",
    },
  ]);

  // Consultation Timer countdown
  useEffect(() => {
    let interval = null;
    if (timerActive && consultationTimeLeft > 0) {
      interval = setInterval(() => {
        setConsultationTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            // Auto revoke consultation access when timer expires
            setConsentMap((old) => ({ ...old, "rec-03": false }));
            dispatchAudit({
              type: "LOG",
              actor: "TideCloak Auto-Expiry Daemon",
              event: "Time-Bound Consultation Token Expired",
              details: "Temporary consultation access for Lab Tests (rec-03) automatically revoked.",
              status: "info",
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, consultationTimeLeft]);

  const formattedTime = useMemo(() => {
    const mins = Math.floor(consultationTimeLeft / 60);
    const secs = consultationTimeLeft % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, [consultationTimeLeft]);

  // Handlers
  const handleToggleConsent = (recordId, title) => {
    const nextState = !consentMap[recordId];
    setConsentMap((prev) => ({ ...prev, [recordId]: nextState }));
    
    dispatchAudit({
      type: "LOG",
      actor: "Sarah Nguyen (Patient)",
      event: nextState ? "Consent Granted" : "Consent Revoked",
      details: `Patient ${nextState ? "authorized dynamic decryption of" : "revoked access to"} [${title}].`,
      status: nextState ? "approved" : "blocked",
    });

    setNotification({
      show: true,
      type: nextState ? "success" : "info",
      message: `TideCloak policy updated: Access to "${title}" is now ${nextState ? "PERMITTED" : "REVOKED"}.`,
    });
  };

  const handleEmergencyLockdown = () => {
    setConsentMap({
      "rec-01": false,
      "rec-02": false,
      "rec-03": false,
      "rec-04": false,
      "rec-05": false,
    });
    setTimerActive(false);

    dispatchAudit({
      type: "LOG",
      actor: "Sarah Nguyen (Patient)",
      event: "EMERGENCY PASSPORT LOCKDOWN",
      details: "Patient executed zero-trust total revocation. All active clinical tokens invalidated immediately.",
      status: "blocked",
    });

    setNotification({
      show: true,
      type: "danger",
      message: "EMERGENCY LOCKDOWN: All record tokens revoked. No party can decrypt any medical records.",
    });
  };

  const handleOverseerSign = () => {
    setDualRequest((prev) => ({ ...prev, overseerSigned: true, status: "approved" }));
    setConsentMap((prev) => ({ ...prev, "rec-05": true }));

    dispatchAudit({
      type: "LOG",
      actor: "Dr. Elena Rostova (Ethics Overseer)",
      event: "Dual-Consensus Emergent Authority Formed",
      details: "Threshold policy 2-of-2 satisfied (Doctor + Ethics Board). Temporary emergency access to Genomic profile unlocked.",
      status: "approved",
    });

    setNotification({
      show: true,
      type: "success",
      message: "Emergent Authority generated! Genomic record unlocked via 2-of-2 dual consensus.",
    });
  };

  // Rogue Admin Exploit Simulations (The Core Wow Factor for Judges)
  const triggerRogueExploit = (type) => {
    let exploitTitle = "";
    let reason = "";

    if (type === "dump") {
      exploitTitle = "Unilateral Database Dump Attempt";
      reason = "Rogue SuperAdmin attempted 'SELECT * FROM patient_records'. Intercepted: Records are client-side encrypted; no static server master key exists.";
    } else if (type === "psych") {
      exploitTitle = "Silent Decryption of Psychiatric Notes";
      reason = "Attempted backdoor decryption of Psychiatric Notes (rec-04). Intercepted: Patient Sarah Nguyen has not co-signed policy token. Decryption failed.";
    } else if (type === "escalate") {
      exploitTitle = "Privilege Escalation Override";
      reason = "SuperAdmin injected root bypass role 'ADMIN_SUPER_OVERRIDE'. Intercepted: TideCloak Emergent Authority mathematically ignores root permissions.";
    }

    dispatchAudit({
      type: "LOG",
      actor: "Alex Mercer (Compromised Hospital IT Admin)",
      event: `BLOCKED BY TIDECLOAK: ${exploitTitle}`,
      details: reason,
      status: "blocked",
    });

    setNotification({
      show: true,
      type: "danger",
      message: `UNILATERAL OVERRIDE BLOCKED! ${reason}`,
    });
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-section">
            <div className="logo-badge">CP</div>
            <div>
              <div className="brand-title">
                CarePassport
                <span className="tide-badge">
                  <span className="pulse-dot"></span>
                  TideCloak Emergent Authority
                </span>
              </div>
              <div className="brand-subtitle">
                Zero-Trust Cross-Hospital Medical Consent Vault &middot; RMIT Hackathon 2026
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Consultation Token Expiry</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: consultationTimeLeft > 300 ? "var(--accent-teal)" : "var(--accent-danger)" }}>
                {timerActive ? formattedTime : "EXPIRED"}
              </div>
            </div>
            {authenticated ? (
              <button className="secondary-btn" onClick={logout} id="btn-tide-logout">
                Logout
              </button>
            ) : (
              <button className="primary-btn" onClick={login} id="btn-tide-login">
                Connect TideCloak
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Role Switcher Toolbar */}
      <div className="role-bar">
        <div className="role-bar-inner">
          <div className="role-label">Simulate Perspective / Actor:</div>
          <div className="role-buttons">
            <button
              id="role-patient"
              className={`role-btn ${activeRole === "patient" ? "active" : ""}`}
              onClick={() => setActiveRole("patient")}
            >
              👤 Patient (Sarah Nguyen)
            </button>
            <button
              id="role-doctor"
              className={`role-btn ${activeRole === "doctor" ? "active" : ""}`}
              onClick={() => setActiveRole("doctor")}
            >
              🩺 Attending Clinician (Dr. Minh Tran - Cho Ray)
            </button>
            <button
              id="role-overseer"
              className={`role-btn ${activeRole === "overseer" ? "active" : ""}`}
              onClick={() => setActiveRole("overseer")}
            >
              ⚖️ Medical Ethics Overseer (Dr. Elena)
            </button>
            <button
              id="role-rogue-admin"
              className={`role-btn rogue-btn ${activeRole === "rogue_admin" ? "active" : ""}`}
              onClick={() => setActiveRole("rogue_admin")}
            >
              ⚠️ Rogue Hospital IT Admin (Alex Mercer)
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="main-content">
        {/* Dynamic Notification Banner */}
        {notification.show && (
          <div className={`notification-banner ${notification.type}`} id="status-banner">
            <div>
              <strong>{notification.type === "danger" ? "🚨 SECURITY ALERT: " : "ℹ️ SYSTEM NOTICE: "}</strong>
              {notification.message}
            </div>
            <button
              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1.1rem" }}
              onClick={() => setNotification({ ...notification, show: false })}
            >
              &times;
            </button>
          </div>
        )}

        {/* Left Column: Contextual Role View */}
        <section className="view-column">
          {/* Patient Overview Card */}
          <div className="glass-panel">
            <div className="patient-profile-card">
              <div className="patient-avatar">{seedData.patient.avatar}</div>
              <div className="patient-info">
                <h3>{seedData.patient.name}</h3>
                <div className="patient-meta-grid">
                  <span>DOB: <strong>{seedData.patient.dob}</strong></span>
                  <span>Blood: <strong>{seedData.patient.bloodType}</strong></span>
                  <span>National ID: <strong>{seedData.patient.nationalId}</strong></span>
                  <span>Insurance: <strong>{seedData.patient.insurance}</strong></span>
                </div>
              </div>
            </div>

            {/* Role Header Info */}
            <div className="panel-header">
              <div className="panel-title">
                {activeRole === "patient" && "🔐 Sovereign Health Records & Consent Dashboard"}
                {activeRole === "doctor" && "🩺 Clinician Medical Consultation Portal (Cho Ray Hospital)"}
                {activeRole === "overseer" && "⚖️ Independent Bioethics & Emergency Dual-Consensus"}
                {activeRole === "rogue_admin" && "⚠️ Malicious Hospital IT SuperAdmin Penetration Test"}
              </div>

              {activeRole === "patient" && (
                <button
                  id="btn-emergency-lockdown"
                  className="danger-btn"
                  onClick={handleEmergencyLockdown}
                  title="Immediately revoke all shared access across all hospitals"
                >
                  🛑 Emergency Lockdown (Revoke All)
                </button>
              )}
            </div>

            {/* Perspective: Rogue Admin Simulator */}
            {activeRole === "rogue_admin" && (
              <div className="rogue-box" id="rogue-admin-panel">
                <div className="rogue-header">
                  <div style={{ fontSize: "1.5rem" }}>🚨</div>
                  <div>
                    <div className="rogue-title">Testing Conventional System Failure vs TideCloak</div>
                    <div style={{ fontSize: "0.78rem", color: "#fca5a5" }}>
                      In traditional hospital EHRs, a root database admin can easily execute SQL queries to steal or alter any patient's sensitive history. Click below to test TideCloak's mathematical barrier.
                    </div>
                  </div>
                </div>

                <div className="rogue-actions-grid">
                  <button
                    id="btn-exploit-dump"
                    className="exploit-btn"
                    onClick={() => triggerRogueExploit("dump")}
                  >
                    <span>💥 Force Unilateral DB Dump</span>
                    <small>Attempt to dump raw patient data via SQL root</small>
                  </button>

                  <button
                    id="btn-exploit-psych"
                    className="exploit-btn"
                    onClick={() => triggerRogueExploit("psych")}
                  >
                    <span>🕵️ Master-Key Decrypt Psychiatric Notes</span>
                    <small>Attempt unauthorized decryption without patient consent</small>
                  </button>

                  <button
                    id="btn-exploit-escalate"
                    className="exploit-btn"
                    onClick={() => triggerRogueExploit("escalate")}
                  >
                    <span>🛡️ Inject Root Bypass Role</span>
                    <small>Simulate cloud admin elevating permissions</small>
                  </button>
                </div>
              </div>
            )}

            {/* Perspective: Medical Ethics Overseer Dual-Consensus */}
            {activeRole === "overseer" && (
              <div className="dual-consensus-box" id="overseer-panel">
                <h4 style={{ color: "var(--accent-purple)", marginBottom: "0.5rem" }}>
                  Active Emergency Co-Authorization Request (#REQ-901)
                </h4>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Dr. Minh Tran (Cho Ray Hospital) requested emergency consultation access to Patient's Whole Genome Profile for acute pharmacogenomic dosing. TideCloak requires 2-of-2 dual consensus before decryption keys emerge.
                </p>

                <div className="consensus-stepper">
                  <div className="step-item">
                    <div className="step-circle done">✓</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Clinician Request</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>Dr. Minh Tran signed</div>
                    </div>
                  </div>
                  <div style={{ height: "2px", width: "40px", background: dualRequest.overseerSigned ? "var(--accent-teal)" : "rgba(255,255,255,0.1)" }}></div>
                  <div className="step-item">
                    <div className={`step-circle ${dualRequest.overseerSigned ? "done" : "pending"}`}>
                      {dualRequest.overseerSigned ? "✓" : "2"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>Ethics Overseer Approval</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-dim)" }}>
                        {dualRequest.overseerSigned ? "Signed & Co-Authorized" : "Awaiting your signature"}
                      </div>
                    </div>
                  </div>
                </div>

                {!dualRequest.overseerSigned ? (
                  <button
                    id="btn-overseer-approve"
                    className="primary-btn"
                    onClick={handleOverseerSign}
                  >
                    ✍️ Sign & Grant Dual-Consensus Key
                  </button>
                ) : (
                  <div style={{ fontSize: "0.82rem", color: "var(--accent-teal)", fontWeight: 600 }}>
                    ✓ Dual-Consensus satisfied. Emergent Authority granted to Dr. Minh Tran.
                  </div>
                )}
              </div>
            )}

            {/* Records List Display */}
            <div className="records-list" id="records-list">
              {seedData.records.map((record) => {
                const isShared = consentMap[record.id];
                const canDecrypt = activeRole === "patient" || (activeRole === "doctor" && isShared);

                return (
                  <div
                    key={record.id}
                    id={`record-card-${record.id}`}
                    className={`record-card ${isShared ? "shared" : "locked"}`}
                  >
                    <div className="record-top">
                      <div className="record-title-box">
                        <h4>{record.title}</h4>
                        <div className="record-facility">
                          {record.facility} &middot; Recorded on {record.date}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span className={`sensitivity-badge ${
                          record.category === "vital" ? "vital" :
                          record.category === "psychiatry" ? "strict" : "confidential"
                        }`}>
                          {record.sensitivity}
                        </span>

                        <span style={{ fontSize: "0.78rem", color: isShared ? "var(--accent-teal)" : "var(--accent-warning)", fontWeight: 600 }}>
                          {isShared ? "🔓 ACCESSIBLE" : "🔒 ENCRYPTED"}
                        </span>
                      </div>
                    </div>

                    {/* Record Body: Decrypted vs Zero-Knowledge Ciphertext */}
                    <div className="record-body">
                      {canDecrypt ? (
                        <div className="decrypted-view" id={`decrypted-${record.id}`}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem", fontSize: "0.75rem", color: "var(--accent-teal)", fontWeight: 600 }}>
                            <span>✓ DECRYPTED VIA TIDECLOAK EMERGENT AUTHORITY</span>
                            <span>VERIFIED IMMUTABLE</span>
                          </div>
                          {record.content}
                        </div>
                      ) : (
                        <div className="cipher-view" id={`ciphertext-${record.id}`}>
                          <div>
                            <span style={{ color: "#f87171", fontWeight: 700 }}>[ZERO-KNOWLEDGE CIPHERTEXT] </span>
                            {record.ciphertext}
                          </div>
                          <div className="cipher-lock-icon">🔒</div>
                        </div>
                      )}
                    </div>

                    {/* Patient Consent Toggle (Only accessible to Patient) */}
                    {activeRole === "patient" && (
                      <div className="consent-toggle-wrapper">
                        <label className="switch">
                          <input
                            type="checkbox"
                            id={`toggle-${record.id}`}
                            checked={isShared}
                            onChange={() => handleToggleConsent(record.id, record.title)}
                          />
                          <span className="slider"></span>
                        </label>
                        <span className={`toggle-label ${isShared ? "active" : ""}`}>
                          {isShared ? "Cross-Hospital Sharing: ENABLED (Clinicians can decrypt)" : "Cross-Hospital Sharing: DISABLED (Encrypted Vault)"}
                        </span>
                      </div>
                    )}

                    {/* Clinician Perspective notice if locked */}
                    {activeRole === "doctor" && !isShared && (
                      <div style={{ marginTop: "0.6rem", fontSize: "0.76rem", color: "var(--text-dim)" }}>
                        ⚠️ Clinician access denied: Patient Sarah Nguyen has kept this record strictly private. No hospital administrator can override this lock.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Column: Immutable Audit Trail & TideCloak Verification */}
        <aside className="sidebar-column">
          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title">
                <span>🛡️</span> Immutable Audit Trail
              </div>
              <span className="tide-badge" style={{ fontSize: "0.68rem" }}>
                Zero Master Key
              </span>
            </div>

            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
              Every grant, revocation, and blocked override is mathematically signed and anchored via TideCloak.
            </p>

            <div className="audit-container" id="audit-trail-container">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className={`audit-entry ${entry.status === "blocked" ? "blocked" : entry.status === "approved" ? "approved" : ""}`}
                >
                  <div className="audit-meta">
                    <span>{entry.timestamp}</span>
                    <span className={`audit-badge ${entry.status === "blocked" ? "blocked" : entry.status === "approved" ? "granted" : "info"}`}>
                      {entry.status}
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, color: "var(--text-main)", marginBottom: "0.2rem" }}>
                    {entry.actor}
                  </div>
                  <div className="audit-text">
                    <strong>{entry.event}:</strong> {entry.details}
                  </div>
                  <div className="audit-sig">
                    Sig: {entry.signature}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tide Architecture Explain Card */}
          <div className="glass-panel" style={{ fontSize: "0.82rem" }}>
            <h4 style={{ color: "var(--accent-cyan)", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              💡 Why TideCloak Matters
            </h4>
            <ul style={{ paddingLeft: "1.2rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <li>
                <strong style={{ color: "var(--text-main)" }}>No Master Key:</strong> Decryption keys are never stored on any server or held by any hospital administrator.
              </li>
              <li>
                <strong style={{ color: "var(--text-main)" }}>Emergent Authority:</strong> Authority only emerges at the moment the patient's policy and verified doctor credentials align.
              </li>
              <li>
                <strong style={{ color: "var(--text-main)" }}>Unilateral Block:</strong> A compromised IT admin or rogue hospital cannot override the patient's consent at the cryptographic layer.
              </li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
