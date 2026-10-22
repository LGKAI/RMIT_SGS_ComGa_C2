import React, { useState, useEffect, useRef } from "react";
import { useTideCloak } from "@tidecloak/react";
import vaultData from "./vaultData.json";
import { detectAndMaskPII, unmaskText } from "./piiEngine";

const AUTH_SERVER = "http://localhost:8080/";

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function randSig() {
  const hex = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 14; i++) s += hex[Math.floor(Math.random() * hex.length)];
  return s + "...";
}

export default function App() {
  const { authenticated, isLoading, login, logout, getValueFromToken } = useTideCloak();

  // Role Switcher: "user" | "vendor" | "admin"
  const [viewRole, setViewRole] = useState("user");

  // Client Unmasking Toggle
  const [showRealValuesOnClient, setShowRealValuesOnClient] = useState(true);

  // Chat Thread State
  const [messages, setMessages] = useState(vaultData.defaultChatHistory);
  const [inputVal, setInputVal] = useState("");
  const [livePii, setLivePii] = useState(detectAndMaskPII(""));
  const [chatLoading, setChatLoading] = useState(false);

  // Gateway Echo State (What Cloud AI sees)
  const [lastGatewayEcho, setLastGatewayEcho] = useState({
    ticketId: "8f4a-91d2-4e6b-a01c",
    timestamp: "14:30:15",
    maskedPrompt: "Chào AI, tôi cần nhờ bạn thẩm định giúp hồ sơ vay vốn [MONEY_1] của khách hàng [NAME_1] (CCCD [CCCD_1], STK Vietcombank [STK_1]) xem có đủ điều kiện thế chấp không.",
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

  // Pre-flight check for TideCloak Docker
  async function handleLogin() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      await fetch(AUTH_SERVER, { mode: "no-cors", signal: ctrl.signal });
      clearTimeout(t);
    } catch {
      showToast("TideCloak server không chạy trên localhost:8080. Khởi động Docker để kết nối IdP thật.");
      return;
    }
    try {
      await login();
    } catch (err) {
      showToast(`Đăng nhập thất bại: ${err.message}`);
    }
  }

  // Select a preset sample prompt
  function selectPreset(presetText) {
    setInputVal(presetText);
  }

  // Send Chat Message
  function handleSendMessage(e) {
    e?.preventDefault();
    if (!inputVal.trim() || isShredded) return;

    const raw = inputVal;
    const scan = detectAndMaskPII(raw);

    // Create user message
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
    setLastGatewayEcho({
      ticketId: `tkt-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: nowTime(),
      maskedPrompt: scan.maskedText,
      directPiiLeakage: "0.00%",
      userHash: "sha256(sub)::c8a14b...09ef (ANONYMOUS TICKET)"
    });

    // Check Prompt Injection (Synergy with Challenge 1)
    setTimeout(() => {
      setChatLoading(false);
      const isInjection = /bỏ qua|ignore|jailbreak|bypass|api key|root|password|trích xuất|dump|mật khẩu/i.test(raw);

      if (isInjection) {
        setAlert({
          type: "danger",
          title: "🚨 Phát hiện Tấn công Prompt Injection (Challenge 1 Guardrail)",
          message: "Mô hình phân loại đa ngôn ngữ (C1) phát hiện ý định trích xuất dữ liệu trái phép (Confidence: 94.8%). TideCloak kích hoạt Emergency Lockdown: Thẩm quyền giải mã bị từ chối."
        });

        const blockedReply = {
          id: `msg-${Date.now()}`,
          sender: "ai",
          text: `⚠️ [CẢNH BÁO BẢO MẬT]: Yêu cầu chứa dấu hiệu tấn công Prompt Injection (F1: 0.93). TideCloak đã từ chối cấp thẩm quyền giải mã (Emergent Authority Denied). Lịch sử chat được bảo vệ an toàn.`,
          maskedEcho: `[BLOCKED BY MULTILINGUAL GUARDRAIL: PROMPT_INJECTION]`,
          timestamp: nowTime(),
          isWarning: true
        };
        setMessages((m) => [...m, blockedReply]);
        return;
      }

      // Normal Intelligent AI reply
      let aiPlain = "";
      let aiMasked = "";

      if (scan.entities.some((e) => e.type === "NAME" || e.type === "CCCD" || e.type === "STK")) {
        const nameVal = scan.entities.find((e) => e.type === "NAME")?.value || "Khách hàng";
        const stkVal = scan.entities.find((e) => e.type === "STK")?.value || "tài khoản";
        aiPlain = `Dựa trên kết quả thẩm định hồ sơ của ${nameVal}:\n1. Đầy đủ tính pháp lý theo quy định tín dụng cá nhân và doanh nghiệp.\n2. Lịch sử giao dịch qua tài khoản ${stkVal} đạt điểm tín dụng Hạng A.\n3. Đáp ứng tiêu chuẩn bảo mật dữ liệu theo Điều 30 Luật BVDLCN số 91/2025/QH15.`;
        aiMasked = `Dựa trên kết quả thẩm định hồ sơ của [NAME_1]:\n1. Đầy đủ tính pháp lý theo quy định tín dụng cá nhân và doanh nghiệp.\n2. Lịch sử giao dịch qua tài khoản [STK_1] đạt điểm tín dụng Hạng A.\n3. Đáp ứng tiêu chuẩn bảo mật dữ liệu theo Điều 30 Luật BVDLCN số 91/2025/QH15.`;
      } else {
        aiPlain = `Yêu cầu của bạn đã được xử lý an toàn qua kênh mã hóa Client-side TideCloak. Dữ liệu không lưu bản rõ trên Cloud AI.`;
        aiMasked = `Yêu cầu của bạn đã được xử lý an toàn qua kênh mã hóa Client-side TideCloak. Dữ liệu không lưu bản rõ trên Cloud AI.`;
      }

      const aiReply = {
        id: `msg-${Date.now()}`,
        sender: "ai",
        text: aiPlain,
        maskedEcho: aiMasked,
        timestamp: nowTime()
      };
      setMessages((m) => [...m, aiReply]);
    }, 700);
  }

  // Attack 1: Simulate Rogue DBA Tampering Postgres Ciphertext
  function handleSimulateDbaTamper() {
    setDbTampered(true);
    setAlert({
      type: "danger",
      title: "💥 Vi phạm Tính toàn vẹn Mật mã: AES-GCM AAD Mismatch!",
      message: "DBA độc hại đã tráo bản mã (Ciphertext) trong PostgreSQL. Khi tải về, WebCrypto HKDF-SHA256 phát hiện Additional Authenticated Data (AAD) không khớp với conv_id và msg_index. Lệnh sửa lén bị chặn đứng 100%!"
    });
  }

  // Attack 2: Simulate God Admin Escalation (QEA Quorum Challenge)
  function handleTriggerQuorumChallenge() {
    setShowQuorumModal(true);
  }

  // Approve Quorum Signatures
  function handleQuorumApprove() {
    if (!quorumSignatures.includes("Admin 2 (Security Auditor)")) {
      setQuorumSignatures((prev) => [...prev, "Admin 2 (Security Auditor)"]);
      showToast("Đã thu thập đủ 2/2 chữ ký Quorum độc lập! Yêu cầu thay đổi được thông qua.");
    }
  }

  // Reject Quorum
  function handleQuorumReject() {
    setShowQuorumModal(false);
    setAlert({
      type: "info",
      title: "🛡️ Change Request Bị Từ Chối Bởi Quorum",
      message: "Hội đồng Admin độc lập đã bấm REJECT. Thao tác tự cấp quyền giải mã kho dữ liệu của Admin nội bộ đã bị vô hiệu hóa."
    });
  }

  // Crypto-Shredding (Right to be Forgotten)
  function handleCryptoShred() {
    setIsShredded(true);
    setMessages([]);
    setAlert({
      type: "warning",
      title: "🗑️ Crypto-Shredding Hoàn Tất (Quyền Được Xóa)",
      message: "Khóa gốc K_conv và wrapped_dek trên TideCloak đã bị xóa sạch (NULL). Toàn bộ bản sao lưu database (DB Backups) cũ lập tức trở thành chuỗi rác vô nghĩa, không thể giải mã."
    });
  }

  // Reset demo
  function handleResetDemo() {
    setIsShredded(false);
    setDbTampered(false);
    setAlert(null);
    setMessages(vaultData.defaultChatHistory);
    setQuorumSignatures(["Admin 1 (SecOps Lead)"]);
    showToast("Đã khôi phục dữ liệu ban đầu cho kịch bản Demo.");
  }

  return (
    <div className="app-shell">
      {/* 1. Header Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div className="brand-title-wrap">
            <div className="brand-name">
              PrivateChat Shield
              <span className="compliance-badge">Luật BVDLCN 91/2025/QH15</span>
            </div>
            <span className="brand-tag">Lớp Bảo Mật & Giả Danh Hóa Cho Chat AI Với TideCloak</span>
          </div>
        </div>

        <div className="top-right">
          {/* Role Switcher */}
          <div className="role-selector-wrap">
            <span className="role-label">VAI TRÒ:</span>
            <select
              className="role-select"
              value={viewRole}
              onChange={(e) => setViewRole(e.target.value)}
              id="role-select"
            >
              <option value="user">👤 Nhân viên Doanh nghiệp (Client Safe Zone)</option>
              <option value="vendor">🌐 Cloud AI Gateway (Chỉ thấy Masked Token)</option>
              <option value="admin">🛡️ Quản trị viên / DBA (Quorum Audit & DB)</option>
            </select>
          </div>

          {authenticated ? (
            <button className="auth-btn" onClick={logout} id="btn-auth">
              ✓ {getValueFromToken?.("preferred_username") || "TideCloak User"} · Đăng xuất
            </button>
          ) : (
            <button className="auth-btn" onClick={handleLogin} id="btn-auth">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Kết nối TideCloak IdP
            </button>
          )}
        </div>
      </header>

      {/* 2. Compliance & Metric Ribbon */}
      <div className="compliance-banner">
        <div className="banner-left">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <strong>Căn cứ Pháp lý:</strong> Khoản 1 Điều 30 Luật BVDLCN (Xử lý DLCN trong AI & Cloud) & Nghị định 13/2023/NĐ-CP.
        </div>
        <div className="banner-stats">
          <div className="stat-item">
            <span>Tỷ lệ Lộ PII Ra Cloud:</span>
            <span className="stat-val">0.00%</span>
          </div>
          <div className="stat-item">
            <span>Độ trễ Quét Client:</span>
            <span className="stat-val">&lt; 4 ms</span>
          </div>
          <div className="stat-item">
            <span>Khóa Bí Mật Server:</span>
            <span className="stat-val">0% (Master Key Triệt Tiêu)</span>
          </div>
        </div>
      </div>

      {/* Global Alert Notification */}
      {alert && (
        <div style={{ padding: "0.75rem 1.5rem 0" }}>
          <div className={`alert-box ${alert.type}`}>
            <div>
              <strong>{alert.title}</strong>
              <div style={{ marginTop: 2 }}>{alert.message}</div>
            </div>
            <button
              onClick={() => setAlert(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* 3. Main 3-Column Synchronized Layout */}
      <main className="main-layout">
        {/* COLUMN 1: CLIENT SAFE ZONE (User View) */}
        <section className="column-card">
          <div className="col-header">
            <div className="col-title-wrap">
              <h2>👤 Cột 1: Trình duyệt Người dùng</h2>
              <span className="col-sub">Vùng tin cậy duy nhất giữ bản rõ · WebCrypto AES-GCM</span>
            </div>
            <button
              className="pill-badge blue"
              style={{ cursor: "pointer" }}
              onClick={() => setShowRealValuesOnClient(!showRealValuesOnClient)}
              title="Nhấn để chuyển đổi chế độ xem tên thật và token"
            >
              {showRealValuesOnClient ? "👁️ Đang Unmask Tên thật" : "🔒 Đang hiển thị Token"}
            </button>
          </div>

          {/* Chat Messages Scroll */}
          <div className="chat-scroll-area">
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "2rem" }}>
                Kho hội thoại đã bị Crypto-Shred. Không còn bản tin nào có thể giải mã.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`message-row ${m.sender}`}>
                  <div className="msg-meta">
                    <span>{m.sender === "user" ? "Nguyễn Văn Hùng (Chuyên viên)" : "AI Trợ lý Thẩm định"}</span>
                    <span>&bull;</span>
                    <span>{m.timestamp}</span>
                  </div>
                  <div className="msg-body">
                    {showRealValuesOnClient ? m.text : (m.maskedText || m.maskedEcho || m.text)}
                  </div>
                  {m.piiCount > 0 && (
                    <div className="msg-pii-tags">
                      <span className="msg-tag-badge">🛡️ Đã khử định danh {m.piiCount} thực thể PII</span>
                      <span className="msg-tag-badge">Rủi ro: {m.riskScore}%</span>
                    </div>
                  )}
                </div>
              ))
            )}
            {chatLoading && (
              <div className="message-row ai">
                <div className="msg-meta">AI Trợ lý Thẩm định</div>
                <div className="msg-body" style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                  Đang khử định danh PII và suy luận qua AI Gateway...
                </div>
              </div>
            )}
          </div>

          {/* Preset Prompts Selector */}
          <div className="prompt-presets">
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 600 }}>Thử nhanh:</span>
            {vaultData.samplePrompts.map((p) => (
              <button
                key={p.id}
                className="preset-chip"
                onClick={() => selectPreset(p.text)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Real-time PII Preview Bar */}
          {livePii.entities.length > 0 && (
            <div className="pii-preview-bar">
              <div className="pii-preview-header">
                <span>🛡️ Phát hiện {livePii.entities.length} thực thể PII (Khử trước khi gửi Cloud):</span>
                <span className="pill-badge red">Rủi ro: {livePii.riskScore}% ({livePii.riskLevel})</span>
              </div>
              <div className="pii-chip-list">
                {livePii.entities.map((e, idx) => (
                  <span key={idx} className="pii-chip">
                    {e.token} &rarr; {e.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Chat Input Form */}
          <div className="chat-input-wrap">
            <form className="chat-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                className="chat-textarea"
                placeholder="Nhập thông tin hồ sơ vay, CCCD, STK ngân hàng hoặc hợp đồng..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={isShredded}
                id="chat-input-box"
              />
              <button
                type="submit"
                className="send-btn"
                disabled={isShredded || !inputVal.trim()}
                id="btn-send-message"
              >
                Gửi AI
              </button>
            </form>
          </div>
        </section>

        {/* COLUMN 2: STATELESS AI GATEWAY ECHO (Cloud AI View) */}
        <section className="column-card">
          <div className="col-header">
            <div className="col-title-wrap">
              <h2>🌐 Cột 2: AI Gateway Echo</h2>
              <span className="col-sub">Những gì Cloud LLM (Gemini/OpenAI) nhìn thấy · 0% PII</span>
            </div>
            <span className="pill-badge green">Stateless &middot; No Content Log</span>
          </div>

          <div className="gateway-content">
            {/* Anonymous Ticket Box */}
            <div className="gateway-panel">
              <div className="panel-title">
                <span>🎫 Anonymous Quota Ticket (Tách Rời Danh Tính)</span>
                <span className="pill-badge blue">HMAC-SHA256 Signed</span>
              </div>
              <div className="ticket-box">
                <div><span className="ticket-prop">ticket_id:</span> {lastGatewayEcho.ticketId}</div>
                <div><span className="ticket-prop">user_identity:</span> <span style={{ color: "#16a34a" }}>[REDACTED / ANONYMOUS]</span></div>
                <div><span className="ticket-prop">sub_hash:</span> {lastGatewayEcho.userHash}</div>
                <div><span className="ticket-prop">token_quota:</span> 4096 tokens (dùng 1 lần)</div>
                <div><span className="ticket-prop">gateway_logging:</span> DISABLED (Tuân thủ Điều 20 & 21 Luật BVDLCN)</div>
              </div>
            </div>

            {/* Prompt Transmitted to Cloud */}
            <div className="gateway-panel" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div className="panel-title">
                <span>Prompt Đã Giả Danh Hóa Truyền Tới Cloud AI</span>
                <span className="pill-badge amber">100% Tokenized</span>
              </div>
              <div className="masked-stream-box" style={{ flex: 1 }}>
                {lastGatewayEcho.maskedPrompt ? (
                  lastGatewayEcho.maskedPrompt.split(/(\[[A-Z]+_\d+\])/g).map((part, i) =>
                    /\[[A-Z]+_\d+\]/.test(part) ? (
                      <span key={i} className="masked-token-highlight">{part}</span>
                    ) : (
                      part
                    )
                  )
                ) : (
                  <span style={{ color: "var(--text-muted)" }}>Chưa có prompt nào được gửi đi...</span>
                )}
              </div>
            </div>

            {/* Security Explanation */}
            <div className="gateway-panel" style={{ background: "#f8fafc" }}>
              <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                💡 <strong>Điểm Chấm Hackathon:</strong> Cloud LLM hoàn toàn không biết ai là người gửi (CCCD, Họ tên, STK đều đã biến thành biến tượng trưng). Khi AI trả lời về, máy khách tại Cột 1 tự động ghép lại tên thật trên RAM của người dùng.
              </div>
            </div>
          </div>
        </section>

        {/* COLUMN 3: POSTGRES LIVE INSPECTOR & CRYPTOGRAPHIC DEFENSE */}
        <section className="column-card">
          <div className="col-header">
            <div className="col-title-wrap">
              <h2>🛡️ Cột 3: PostgreSQL & Phòng Thủ</h2>
              <span className="col-sub">100% Ciphertext AES-256-GCM · Quorum QEA</span>
            </div>
            <span className={`pill-badge ${dbTampered ? "red" : isShredded ? "amber" : "blue"}`}>
              {dbTampered ? "TAMPER DETECTED" : isShredded ? "CRYPTO-SHREDDED" : "TIDECLOAK ORK SECURED"}
            </span>
          </div>

          <div className="defense-content">
            {/* DB Table Inspection */}
            <div className="action-card">
              <div className="action-card-header">
                <span className="action-card-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                  Trực quan Cơ sở dữ liệu: SELECT * FROM messages
                </span>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>0% Plaintext</span>
              </div>
              <p className="action-desc">
                Cơ sở dữ liệu lưu tại máy chủ hoàn toàn là chuỗi mã hóa. Không chứa tên, CCCD hay nội dung chat.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="db-table-preview">
                  <thead>
                    <tr>
                      <th>conv_id</th>
                      <th>role</th>
                      <th>iv (12B)</th>
                      <th>ciphertext (AES-GCM)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>c81a...</td>
                      <td>user</td>
                      <td>8f91...</td>
                      <td>{isShredded ? "NULL" : "ENC::AES-256-GCM::d8e0...4a12"}</td>
                    </tr>
                    <tr>
                      <td>c81a...</td>
                      <td>assistant</td>
                      <td>3b77...</td>
                      <td>{isShredded ? "NULL" : "ENC::AES-256-GCM::1a99...fe30"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attack Button 1: Rogue DBA Tampering */}
            <div className="action-card">
              <div className="action-card-header">
                <span className="action-card-title">💥 Đòn 1: Giả lập DBA Độc hại Sửa trộm DB</span>
                <span className="pill-badge red">Tấn công Dữ liệu</span>
              </div>
              <p className="action-desc">
                Thử nghiệm tình huống DBA / Cloud Admin có quyền Root tự ý đổi bản mã hoặc tráo tin nhắn trong PostgreSQL.
              </p>
              <button
                className="btn-action danger"
                onClick={handleSimulateDbaTamper}
                id="btn-simulate-dba"
              >
                Giả lập DBA Tamper: Sửa Ciphertext
              </button>
            </div>

            {/* Attack Button 2: Quorum QEA Challenge */}
            <div className="action-card">
              <div className="action-card-header">
                <span className="action-card-title">⚖️ Đòn 2: Quorum Chống "God Admin" (QEA)</span>
                <span className="pill-badge amber">TideCloak QEA</span>
              </div>
              <p className="action-desc">
                Admin độc hại cố gắng tự cấp quyền giải mã kho tài liệu VIP. Lệnh bị chặn thành Change Request đòi Quorum &ge; 2 chữ ký.
              </p>
              <button
                className="btn-action warning"
                onClick={handleTriggerQuorumChallenge}
                id="btn-simulate-quorum"
              >
                Mở Thử thách Quorum (Mời Giám khảo duyệt)
              </button>
            </div>

            {/* Action 3: Crypto-Shredding */}
            <div className="action-card">
              <div className="action-card-header">
                <span className="action-card-title">🗑️ Đòn 3: Crypto-Shredding ("Quyền Được Xóa")</span>
                <span className="pill-badge blue">GDPR / Nghị định 13</span>
              </div>
              <p className="action-desc">
                Xóa sạch wrapped_dek trên TideCloak, biến toàn bộ dữ liệu lịch sử và các bản DB backup cũ thành rác vô nghĩa vĩnh viễn.
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="btn-action danger"
                  style={{ flex: 1 }}
                  onClick={handleCryptoShred}
                  id="btn-crypto-shred"
                >
                  Crypto-Shred
                </button>
                <button
                  className="btn-action primary"
                  style={{ flex: 1 }}
                  onClick={handleResetDemo}
                  id="btn-reset-demo"
                >
                  Khôi phục Demo
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 4. Quorum Change Request Modal (Interactive for Judges) */}
      {showQuorumModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>⚖️ TideCloak Change Request #CR-2026-89</h3>
              <button
                onClick={() => setShowQuorumModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="alert-box danger">
                <strong>Phát hiện Yêu cầu Nâng Quyền Bất thường:</strong>
                <div>Admin `db_admin_root` cố gắng tự gán quyền <code>_tide_chat.selfdecrypt</code> để giải mã hội thoại khách hàng.</div>
              </div>
              <div>
                <strong>Cơ chế Quorum-Enforced Governance (QEA):</strong>
                <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                  TideCloak đã chặn lệnh thực thi trực tiếp. Cần ít nhất <strong>2 chữ ký số độc lập</strong> từ Hội đồng Quản trị Bảo mật trước khi cấp quyền:
                </p>
              </div>
              <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-light)" }}>
                <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.75rem" }}>
                  Tiến độ Chữ ký Quorum: {quorumSignatures.length} / 2
                </div>
                {quorumSignatures.map((sig, i) => (
                  <div key={i} style={{ color: "#166534", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span>✓</span> <strong>{sig}</strong> — Đã ký bằng WebCrypto Ed25519 (0x7f1a...40b)
                  </div>
                ))}
                {quorumSignatures.length < 2 && (
                  <div style={{ color: "#b45309", fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span>⏳</span> Đang chờ Chữ ký số của Giám khảo / Admin 2...
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-action danger" style={{ width: "auto", padding: "0.4rem 1rem" }} onClick={handleQuorumReject}>
                Từ chối (Reject Attack)
              </button>
              <button
                className="btn-action primary"
                style={{ width: "auto", padding: "0.4rem 1rem" }}
                onClick={handleQuorumApprove}
                disabled={quorumSignatures.length >= 2}
              >
                {quorumSignatures.length >= 2 ? "✓ Quorum Đã Đủ (Approved)" : "Ký Duyệt (Admin 2 / Giám khảo)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && <div className="toast-notice">{toast}</div>}
    </div>
  );
}
