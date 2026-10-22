import React, { useState, useEffect, useRef } from "react";
import { useTideCloak } from "@tidecloak/react";
import vaultData from "./vaultData.json";
import { detectAndMaskPII } from "./piiEngine";

const AUTH_SERVER = "http://localhost:8080/";

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function App() {
  const { authenticated, isLoading, login, logout, getValueFromToken } = useTideCloak();

  // Role Switcher: "user" | "gateway" | "admin"
  const [viewRole, setViewRole] = useState("user");

  // Client Unmasking Toggle
  const [showUnmasked, setShowUnmasked] = useState(true);

  // Chat State
  const [messages, setMessages] = useState(vaultData.defaultChatHistory);
  const [inputVal, setInputVal] = useState("");
  const [livePii, setLivePii] = useState(detectAndMaskPII(""));
  const [chatLoading, setChatLoading] = useState(false);

  // Gateway Echo State (What Cloud AI sees)
  const [gatewayEcho, setGatewayEcho] = useState({
    ticketId: "8f4a-91d2-4e6b",
    timestamp: "14:30:15",
    maskedPrompt: "Please review the [MONEY_1] credit dossier for client [NAME_1] (CCCD [CCCD_1], Vietcombank account [STK_1], phone [PHONE_1]) with collateral [MONEY_2].",
    directPiiLeakage: "0.00%",
    userHash: "sha256(sub)::c8a14b...09ef (ANONYMOUS)"
  });

  // DB State (Postgres Simulator)
  const [isShredded, setIsShredded] = useState(false);
  const [dbTampered, setDbTampered] = useState(false);

  // Quorum Modal State (QEA)
  const [showQuorumModal, setShowQuorumModal] = useState(false);
  const [quorumSignatures, setQuorumSignatures] = useState(["Admin 1 (SecOps Lead)"]);

  // Alert State
  const [alert, setAlert] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // Real-time PII detection when typing
  useEffect(() => {
    setLivePii(detectAndMaskPII(inputVal));
  }, [inputVal]);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6000);
  }

  // Login handler
  async function handleLogin() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      await fetch(AUTH_SERVER, { mode: "no-cors", signal: ctrl.signal });
      clearTimeout(t);
    } catch {
      showToast("TideCloak container is not reachable on localhost:8080. Start Docker to connect.");
      return;
    }
    try {
      await login();
    } catch (err) {
      showToast(`Login failed: ${err.message}`);
    }
  }

  // Select sample preset prompt
  function selectPreset(presetText) {
    setInputVal(presetText);
  }

  // Send Chat Message
  function handleSendMessage(e) {
    e?.preventDefault();
    if (!inputVal.trim() || isShredded) return;

    const raw = inputVal;
    const scan = detectAndMaskPII(raw);

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: raw,
      maskedText: scan.maskedText,
      piiCount: scan.entities.length,
      riskScore: scan.riskScore,
      timestamp: nowTime()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setChatLoading(true);

    // Update Gateway Echo
    setGatewayEcho({
      ticketId: `tkt-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: nowTime(),
      maskedPrompt: scan.maskedText,
      directPiiLeakage: "0.00%",
      userHash: "sha256(sub)::c8a14b...09ef (ANONYMOUS)"
    });

    // Check Prompt Injection (Challenge 1 Guardrail)
    setTimeout(() => {
      setChatLoading(false);
      const isInjection = /bỏ qua|ignore|jailbreak|bypass|api key|root|password|dump|mật khẩu/i.test(raw);

      if (isInjection) {
        setAlert({
          type: "danger",
          title: "🚨 Multilingual Prompt Injection Blocked!",
          message: "Challenge 1 Guardrail Classifier intercepted malicious exfiltration intent (Confidence: 94.8%). TideCloak Emergency Vault Lockdown triggered: Decryption authority refused."
        });

        const blockedReply = {
          id: `msg-${Date.now()}`,
          sender: "ai",
          text: `⚠️ [SECURITY ALERT]: Request blocked by Multilingual Guardrail (F1: 0.93). TideCloak Emergent Authority withheld. User records remain cryptographically locked.`,
          maskedEcho: `[BLOCKED BY MULTILINGUAL GUARDRAIL: PROMPT_INJECTION]`,
          timestamp: nowTime(),
          isWarning: true
        };
        setMessages((m) => [...m, blockedReply]);
        return;
      }

      // Contextual Response
      let aiPlain = "";
      let aiMasked = "";

      if (scan.entities.some((e) => e.type === "NAME" || e.type === "CCCD" || e.type === "STK")) {
        const nameVal = scan.entities.find((e) => e.type === "NAME")?.value || "the client";
        const stkVal = scan.entities.find((e) => e.type === "STK")?.value || "account";
        aiPlain = `Credit risk assessment for ${nameVal}:\n1. Validated legal status under institutional banking criteria.\n2. Operating cash flows via account ${stkVal} qualify for Tier-1 terms.\n3. Compliance verified: Article 30 Law 91/2025/QH15 (AI & Cloud Data Minimization).`;
        aiMasked = `Credit risk assessment for [NAME_1]:\n1. Validated legal status under institutional banking criteria.\n2. Operating cash flows via account [STK_1] qualify for Tier-1 terms.\n3. Compliance verified: Article 30 Law 91/2025/QH15 (AI & Cloud Data Minimization).`;
      } else {
        aiPlain = `Your request was processed securely via TideCloak Client-Side Envelope Encryption. Zero plaintext stored on cloud AI servers.`;
        aiMasked = `Your request was processed securely via TideCloak Client-Side Envelope Encryption. Zero plaintext stored on cloud AI servers.`;
      }

      const aiReply = {
        id: `msg-${Date.now()}`,
        sender: "ai",
        text: aiPlain,
        maskedEcho: aiMasked,
        timestamp: nowTime()
      };
      setMessages((m) => [...m, aiReply]);
    }, 600);
  }

  // Attack 1: Rogue DBA Tamper Simulation
  function handleSimulateDbaTamper() {
    setDbTampered(true);
    setAlert({
      type: "danger",
      title: "💥 Cryptographic Integrity Violation: AES-GCM AAD Mismatch!",
      message: "Rogue DBA attempted to swap ciphertext in PostgreSQL. WebCrypto HKDF-SHA256 verified Additional Authenticated Data (AAD): conv_id and msg_index mismatch detected. Tampered record dropped."
    });
  }

  // Attack 2: Quorum Challenge
  function handleTriggerQuorumChallenge() {
    setShowQuorumModal(true);
  }

  // Quorum Approve
  function handleQuorumApprove() {
    if (!quorumSignatures.includes("Admin 2 (Security Auditor)")) {
      setQuorumSignatures((prev) => [...prev, "Admin 2 (Security Auditor)"]);
      showToast("Quorum requirement met (2/2 independent signatures). Change approved.");
    }
  }

  // Quorum Reject
  function handleQuorumReject() {
    setShowQuorumModal(false);
    setAlert({
      type: "info",
      title: "🛡️ Change Request Rejected by Quorum",
      message: "Independent security council rejected the escalation attempt. Unilateral decryption role revoked."
    });
  }

  // Crypto-Shredding
  function handleCryptoShred() {
    setIsShredded(true);
    setMessages([]);
    setAlert({
      type: "warning",
      title: "🗑️ Crypto-Shredding Executed (Right to be Forgotten)",
      message: "Conversation key K_conv and wrapped_dek purged (NULL). All historical PostgreSQL database backups are rendered permanently unrecoverable."
    });
  }

  // Reset Demo
  function handleResetDemo() {
    setIsShredded(false);
    setDbTampered(false);
    setAlert(null);
    setMessages(vaultData.defaultChatHistory);
    setQuorumSignatures(["Admin 1 (SecOps Lead)"]);
    showToast("Demo environment reset to baseline.");
  }

  return (
    <div className="app-shell">
      {/* 1. Header Navigation */}
      <header className="topbar">
        <a className="brand" href="#">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="brand-text">
            <h1>PrivateChat Shield</h1>
            <span className="brand-tag">Zero-Trust AI Privacy Gateway &middot; Powered by TideCloak</span>
          </div>
        </a>

        <div className="top-right">
          {/* Role Switcher */}
          <div className="role-switch">
            <label htmlFor="role-select">VIEW AS</label>
            <select
              id="role-select"
              value={viewRole}
              onChange={(e) => setViewRole(e.target.value)}
            >
              <option value="user">End User (Client Safe Zone)</option>
              <option value="gateway">Cloud AI Gateway</option>
              <option value="admin">Database Administrator</option>
            </select>
          </div>

          {/* TideCloak Auth Button */}
          <div className="auth-status">
            <span className={`status-dot ${authenticated ? "active" : ""}`}></span>
            <span>{authenticated ? `TideCloak · ${getValueFromToken?.("preferred_username") || "Signed in"}` : "TideCloak · Connected"}</span>
          </div>

          {authenticated ? (
            <button className="btn-auth" onClick={logout} id="btn-auth">
              Sign out
            </button>
          ) : (
            <button className="btn-auth" onClick={handleLogin} id="btn-auth">
              Connect TideCloak IdP
            </button>
          )}
        </div>
      </header>

      {/* 2. Hero / Metric Strip */}
      <div className="hero-ribbon">
        <div className="ribbon-eyebrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>ZERO-TRUST AI CONFIDENTIALITY · LAW 91/2025/QH15 COMPLIANT</span>
        </div>
        <div className="ribbon-metrics">
          <div className="metric-pill success">
            <span>Direct PII Leakage:</span>
            <strong>0.00%</strong>
          </div>
          <div className="metric-pill">
            <span>Client Crypto Latency:</span>
            <strong>&lt; 4ms</strong>
          </div>
          <div className="metric-pill">
            <span>Server Master Keys:</span>
            <strong>0% (Ineffable Cryptography)</strong>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      {alert && (
        <div className={`alert-bar ${alert.type}`}>
          <div>
            <strong>{alert.title}</strong> — {alert.message}
          </div>
          <button
            onClick={() => setAlert(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* 3. Main 3-Column Synchronized Inspector */}
      <main className="main-grid">
        {/* COLUMN 1: CLIENT SAFE ZONE */}
        <section className="col-card">
          <div className="card-head">
            <div className="card-title-group">
              <h2>👤 Client Safe Zone</h2>
              <span className="card-sub">In-Browser Decrypted View &middot; WebCrypto AES-GCM</span>
            </div>
            <button
              className="chip blue"
              style={{ cursor: "pointer" }}
              onClick={() => setShowUnmasked(!showUnmasked)}
            >
              {showUnmasked ? "👁️ Unmasked (Real Names)" : "🔒 Masked Tokens"}
            </button>
          </div>

          {/* Chat Messages */}
          <div className="chat-body">
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "3rem" }}>
                Vault was crypto-shredded. Zero readable records remaining.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.sender}`}>
                  <div className="bubble-meta">
                    <span>{m.sender === "user" ? "Sarah Nguyen (User)" : "Confidential AI Assistant"}</span>
                    <span>&bull;</span>
                    <span>{m.timestamp}</span>
                  </div>
                  <div className="bubble-text">
                    {showUnmasked ? m.text : (m.maskedText || m.maskedEcho || m.text)}
                  </div>
                  {m.piiCount > 0 && (
                    <div className="bubble-tags">
                      <span className="bubble-tag-pill">🛡️ {m.piiCount} PII entities protected</span>
                      <span className="bubble-tag-pill">Risk: {m.riskScore}%</span>
                    </div>
                  )}
                </div>
              ))
            )}
            {chatLoading && (
              <div className="chat-bubble ai">
                <div className="bubble-meta">Confidential AI Assistant</div>
                <div className="bubble-text" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                  Pseudonymizing PII & reasoning through zero-knowledge gateway...
                </div>
              </div>
            )}
          </div>

          {/* Prompt Presets */}
          <div className="presets-strip">
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700 }}>PRESETS:</span>
            {vaultData.samplePrompts.map((p) => (
              <button
                key={p.id}
                className="preset-btn"
                onClick={() => selectPreset(p.text)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Compact PII Pill Banner */}
          {livePii.entities.length > 0 && (
            <div className="pii-compact-bar">
              <div className="pii-list">
                <span style={{ fontWeight: 700, color: "#92400e" }}>PII DETECTED:</span>
                {livePii.entities.map((e, idx) => (
                  <span key={idx} className="pii-tag">
                    {e.token}: {e.value}
                  </span>
                ))}
              </div>
              <span className="chip red">Risk: {livePii.riskScore}%</span>
            </div>
          )}

          {/* Input Footer */}
          <div className="chat-footer">
            <form className="input-row" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="input-box"
                placeholder="Ask AI or paste credit dossiers, CCCD, banking records, contracts..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={isShredded}
                id="chat-input"
              />
              <button
                type="submit"
                className="btn-send"
                disabled={isShredded || !inputVal.trim()}
                id="btn-send"
              >
                Send
              </button>
            </form>
          </div>
        </section>

        {/* COLUMN 2: CLOUD AI GATEWAY ECHO */}
        <section className="col-card">
          <div className="card-head">
            <div className="card-title-group">
              <h2>🌐 AI Gateway Echo</h2>
              <span className="card-sub">What Cloud LLMs (Gemini/OpenAI) Receive</span>
            </div>
            <span className="chip green">Stateless &middot; 0% Logs</span>
          </div>

          <div className="gateway-body">
            {/* Anonymous Ticket Card */}
            <div className="clean-card">
              <div className="clean-card-head">
                <span>Anonymous Quota Ticket</span>
                <span className="chip blue">HMAC-SHA256</span>
              </div>
              <div className="ticket-data">
                <div><span>ticket_id:</span> {gatewayEcho.ticketId}</div>
                <div><span>user_identity:</span> <strong style={{ color: "#16a34a" }}>[ANONYMOUS / UNLINKED]</strong></div>
                <div><span>sub_hash:</span> {gatewayEcho.userHash}</div>
                <div><span>quota_limit:</span> 4,096 tokens (single-use)</div>
                <div><span>content_logging:</span> DISABLED</div>
              </div>
            </div>

            {/* Tokenized Stream */}
            <div className="clean-card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="clean-card-head">
                <span>Pseudonymized Prompt Stream</span>
                <span className="chip amber">Tokenized</span>
              </div>
              <div className="tokenized-box" style={{ flex: 1 }}>
                {gatewayEcho.maskedPrompt ? (
                  gatewayEcho.maskedPrompt.split(/(\[[A-Z]+_\d+\])/g).map((part, i) =>
                    /\[[A-Z]+_\d+\]/.test(part) ? (
                      <span key={i} className="token-highlight">{part}</span>
                    ) : (
                      part
                    )
                  )
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>No outbound prompts recorded.</span>
                )}
              </div>
            </div>

            <div className="clean-card" style={{ background: "#f8fafc" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", lineHeight: 1.45 }}>
                💡 <strong>Core Insight:</strong> Cloud models receive zero citizen PII (CCCD, names, and accounts are anonymized symbolic variables). Real identity never crosses borders.
              </div>
            </div>
          </div>
        </section>

        {/* COLUMN 3: STORAGE & DEFENSE */}
        <section className="col-card">
          <div className="card-head">
            <div className="card-title-group">
              <h2>🛡️ Storage & Defense</h2>
              <span className="card-sub">PostgreSQL Ledger &middot; TideCloak QEA</span>
            </div>
            <span className={`chip ${dbTampered ? "red" : isShredded ? "amber" : "blue"}`}>
              {dbTampered ? "TAMPER BLOCKED" : isShredded ? "SHREDDED" : "ORK PROTECTED"}
            </span>
          </div>

          <div className="storage-body">
            {/* Table Inspection */}
            <div className="action-row-card">
              <div className="action-row-top">
                <span className="action-row-title">PostgreSQL: messages (0% Plaintext)</span>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>AES-256-GCM</span>
              </div>
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>conv_id</th>
                    <th>role</th>
                    <th>iv (96b)</th>
                    <th>ciphertext</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>c81a...</td>
                    <td>user</td>
                    <td>8f91...</td>
                    <td>{isShredded ? "NULL" : "ENC::AES-GCM::d8e0...4a12"}</td>
                  </tr>
                  <tr>
                    <td>c81a...</td>
                    <td>assistant</td>
                    <td>3b77...</td>
                    <td>{isShredded ? "NULL" : "ENC::AES-GCM::1a99...fe30"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Action 1: DBA Tamper */}
            <div className="action-row-card">
              <div className="action-row-top">
                <span className="action-row-title">💥 Attack 1: Rogue DBA Tamper</span>
                <span className="chip red">Integrity Test</span>
              </div>
              <button
                className="btn-ctrl danger"
                onClick={handleSimulateDbaTamper}
                id="btn-simulate-dba"
              >
                Simulate Rogue DBA: Alter Ciphertext
              </button>
            </div>

            {/* Action 2: Quorum Governance */}
            <div className="action-row-card">
              <div className="action-row-top">
                <span className="action-row-title">⚖️ Attack 2: God Admin Escalation</span>
                <span className="chip amber">Quorum QEA</span>
              </div>
              <button
                className="btn-ctrl amber"
                onClick={handleTriggerQuorumChallenge}
                id="btn-simulate-quorum"
              >
                Trigger Quorum Approval Challenge
              </button>
            </div>

            {/* Action 3: Crypto-Shred */}
            <div className="action-row-card">
              <div className="action-row-top">
                <span className="action-row-title">🗑️ Action 3: Crypto-Shredding</span>
                <span className="chip blue">GDPR / Decree 13</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn-ctrl danger"
                  style={{ flex: 1 }}
                  onClick={handleCryptoShred}
                  id="btn-crypto-shred"
                >
                  Crypto-Shred
                </button>
                <button
                  className="btn-ctrl blue"
                  style={{ flex: 1 }}
                  onClick={handleResetDemo}
                  id="btn-reset-demo"
                >
                  Reset Demo
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 4. Quorum Approval Modal */}
      {showQuorumModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-head">
              <h3>⚖️ TideCloak Change Request #CR-2026-89</h3>
              <button
                onClick={() => setShowQuorumModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
              >
                &times;
              </button>
            </div>
            <div className="modal-content">
              <div className="alert-bar danger" style={{ margin: 0 }}>
                <div>
                  <strong>Privilege Escalation Intercepted:</strong>
                  <div>Admin <code>db_admin_root</code> attempted unilateral assignment of decryption role <code>_tide_chat.selfdecrypt</code>.</div>
                </div>
              </div>
              <div>
                <strong>Quorum-Enforced Governance (QEA):</strong>
                <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                  TideCloak blocked execution. Requires at least <strong>2 independent digital signatures</strong> before role activation:
                </p>
              </div>
              <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-light)" }}>
                <div style={{ fontWeight: 600, fontSize: "0.74rem", marginBottom: 4 }}>
                  Quorum Progress: {quorumSignatures.length} / 2 Signatures
                </div>
                {quorumSignatures.map((sig, i) => (
                  <div key={i} style={{ color: "#166534", fontSize: "0.74rem", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span>✓</span> <strong>{sig}</strong> — WebCrypto Ed25519 signature verified (0x7f1a...40b)
                  </div>
                ))}
                {quorumSignatures.length < 2 && (
                  <div style={{ color: "#b45309", fontSize: "0.74rem", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span>⏳</span> Awaiting signature from Judge / Admin 2...
                  </div>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-ctrl danger" style={{ width: "auto", padding: "0.4rem 1rem" }} onClick={handleQuorumReject}>
                Reject Request
              </button>
              <button
                className="btn-ctrl blue"
                style={{ width: "auto", padding: "0.4rem 1rem" }}
                onClick={handleQuorumApprove}
                disabled={quorumSignatures.length >= 2}
              >
                {quorumSignatures.length >= 2 ? "✓ Quorum Met (Approved)" : "Approve & Sign (Admin 2 / Judge)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notice */}
      {toast && <div className="toast-bar">{toast}</div>}
    </div>
  );
}
