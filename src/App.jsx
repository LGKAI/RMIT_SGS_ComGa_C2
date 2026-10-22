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

  // Local simulated session state if user clicks Quick Demo Login
  const [simulatedAuth, setSimulatedAuth] = useState(false);

  // Role Switcher: "user" | "gateway" | "admin"
  const [viewRole, setViewRole] = useState("user");

  // Client Unmasking Toggle
  const [showUnmasked, setShowUnmasked] = useState(true);

  // Emergent Authority Token (15-min temporary grant)
  const [activeToken, setActiveToken] = useState(false);

  // File / Document Attachment State
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

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

  const isUserLoggedIn = authenticated || simulatedAuth;
  const currentUserName = authenticated
    ? getValueFromToken?.("preferred_username") || "Sarah Nguyen"
    : simulatedAuth
    ? "Sarah Nguyen (Demo)"
    : null;

  // Real Keycloak login handler
  async function handleLogin() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2000);
      await fetch(AUTH_SERVER, { mode: "no-cors", signal: ctrl.signal });
      clearTimeout(t);
    } catch {
      showToast("TideCloak container is not running on localhost:8080. Start Docker to connect.");
      return;
    }
    try {
      await login();
    } catch (err) {
      showToast(`Login failed: ${err.message}`);
    }
  }

  // Quick 1-click demo login
  function handleQuickDemoLogin() {
    setSimulatedAuth(true);
    showToast("Signed in as Sarah Nguyen (Zero-Trust Session Active)");
  }

  function handleLogout() {
    if (authenticated) {
      logout();
    }
    setSimulatedAuth(false);
  }

  // Grant 15-Minute Emergent Authority Token
  function handleGrantEmergentAuthority() {
    setActiveToken(true);
    showToast("Emergent Authority Token Granted (15-Minute Decryption Active)");

    const pendingApproval = messages.find((m) => m.needsApproval && !m.approved);
    const docName = pendingApproval?.targetDoc || "Tài liệu bảo mật";

    // Update message state
    setMessages((prev) =>
      prev.map((m) => (m.needsApproval ? { ...m, approved: true } : m))
    );

    // AI delivers deep privileged analysis tailored to document
    setTimeout(() => {
      let analysisText = "";
      let maskedEchoText = "";

      if (/cv|resume/i.test(docName)) {
        analysisText = `✅ [TideCloak Token Verified · Emergent Authority Active]\n\nPhân tích hồ sơ CV mật ("${docName}"):\n1. Hồ sơ ứng viên: 10+ năm kinh nghiệm quản lý cấp cao trong lĩnh vực Fintech & Enterprise SaaS.\n2. Lương và đãi ngộ cũ: Đã được ẩn danh hóa bằng WebCrypto ở tầng Client, Cloud LLM không thấy bản rõ.\n3. Đánh giá chuyên môn: Đạt 96/100 tiêu chuẩn bổ nhiệm Giám đốc Vận hành (COO).\n\n🔒 Lưu ý: Quyền truy cập 15 phút đang kích hoạt. Bấm "Revoke Token" bất kỳ lúc nào để khóa lại.`;
        maskedEchoText = `✅ [TideCloak Token Verified · Emergent Authority Active]\n\nPhân tích hồ sơ CV mật ("${docName}"):\n1. Hồ sơ ứng viên: 10+ năm kinh nghiệm quản lý cấp cao.\n2. Lương và đãi ngộ cũ: Đã được ẩn danh hóa bằng WebCrypto [SALARY_MASKED].\n3. Đánh giá chuyên môn: Đạt tiêu chuẩn bổ nhiệm Giám đốc Vận hành.`;
      } else if (/passport|cccd|cmnd/i.test(docName)) {
        analysisText = `✅ [TideCloak Token Verified · Emergent Authority Active]\n\nPhân tích giấy tờ tùy thân ("${docName}"):\n1. Tính hợp pháp: Hộ chiếu / CCCD còn hạn sử dụng, đặc điểm nhận dạng hợp lệ.\n2. Bảo vệ danh tính: Số định danh cá nhân và ngày sinh được cô lập trong bộ nhớ đệm an toàn.\n3. Xác thực eKYC: Mức độ tin cậy Cấp độ 3 (Level-3 Verified).\n\n🔒 Lưu ý: Quyền truy cập 15 phút đang kích hoạt. Bấm "Revoke Token" để khóa lại.`;
        maskedEchoText = `✅ [TideCloak Token Verified · Emergent Authority Active]\n\nPhân tích giấy tờ tùy thân ("${docName}"):\n1. Tính hợp pháp: Giấy tờ còn hạn sử dụng.\n2. Bảo vệ danh tính: Số định danh [ID_MASKED] được cô lập an toàn.\n3. Xác thực eKYC: Mức độ tin cậy Cấp độ 3.`;
      } else {
        analysisText = `✅ [TideCloak Token Verified · Emergent Authority Active]\n\nPhân tích bảo mật tài liệu mật ("${docName}"):\n1. Định giá sáp nhập $12,500,000 USD: Cần quy định tài khoản Escrow phong tỏa tại Techcombank.\n2. Điều khoản không cạnh tranh (Non-compete) 36 tháng là quá dài; khuyến nghị đàm phán xuống 18-24 tháng.\n3. Điều khoản MAE (Material Adverse Effect) bảo vệ tài sản sở hữu trí tuệ công nghệ an toàn.\n\n🔒 Lưu ý: Vùng nhớ RAM tạm thời sẽ được zeroized ngay sau phiên làm việc.`;
        maskedEchoText = `✅ [TideCloak Token Verified · Emergent Authority Active]\n\nPhân tích bảo mật tài liệu mật:\n1. Định giá sáp nhập [MONEY_1]: Cần quy định tài khoản Escrow phong tỏa tại Techcombank.\n2. Điều khoản không cạnh tranh (Non-compete) 36 tháng là quá dài; khuyến nghị đàm phán xuống 18-24 tháng.\n3. Điều khoản MAE bảo vệ tài sản sở hữu trí tuệ công nghệ an toàn.`;
      }

      const privilegedReply = {
        id: `msg-${Date.now()}`,
        sender: "ai",
        text: analysisText,
        maskedEcho: maskedEchoText,
        timestamp: nowTime()
      };
      setMessages((m) => [...m, privilegedReply]);
    }, 600);
  }

  // Emergency Revocation
  function handleRevokeToken() {
    setActiveToken(false);
    showToast("Emergency Lockdown: Emergent Authority Token Revoked.");
    setAlert({
      type: "info",
      title: "🔒 Vault Locked Down",
      message: "Active Emergent Authority tokens revoked. AI memory buffers zeroed out."
    });
  }

  // File Upload Handlers
  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isConfidential = /cv|resume|contract|m&a|passport|cmnd|cccd|financial|statement|bank|bệnh án|hồ sơ/i.test(file.name);
    setAttachedFile({
      name: file.name,
      size: `${Math.round(file.size / 1024) || 240} KB`,
      type: file.type || "application/pdf",
      isConfidential
    });
    showToast(`Attached "${file.name}" (${isConfidential ? "Confidential Asset" : "Standard File"})`);
  }

  function handleAttachPreset(name, size = "245 KB", isConfidential = true) {
    setAttachedFile({
      name,
      size,
      type: "application/pdf",
      isConfidential
    });
    showToast(`Attached sample "${name}" (Confidential Asset)`);
  }

  // Select sample preset prompt
  function selectPreset(presetText) {
    setInputVal(presetText);
  }

  // Send Chat Message
  function handleSendMessage(e) {
    e?.preventDefault();
    if ((!inputVal.trim() && !attachedFile) || isShredded) return;

    const raw = inputVal || (attachedFile ? `Phân tích tài liệu đính kèm: ${attachedFile.name}` : "");
    const scan = detectAndMaskPII(raw);
    const currentAttachment = attachedFile;
    setAttachedFile(null);

    const userMsg = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: raw,
      file: currentAttachment,
      maskedText: scan.maskedText,
      piiCount: scan.entities.length,
      riskScore: scan.riskScore,
      timestamp: nowTime()
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setChatLoading(true);

    // Update Gateway Echo (What Cloud AI receives)
    setGatewayEcho({
      ticketId: `tkt-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: nowTime(),
      maskedPrompt: currentAttachment ? `[ATTACHMENT: ${currentAttachment.name} (ENCRYPTED_BLOB)] ${scan.maskedText}` : scan.maskedText,
      directPiiLeakage: "0.00%",
      userHash: "sha256(sub)::c8a14b...09ef (ANONYMOUS)"
    });

    // Intelligent AI Response Generation
    setTimeout(() => {
      setChatLoading(false);

      // Check Prompt Injection (Challenge 1 Guardrail)
      const isInjection = /bỏ qua|ignore|jailbreak|bypass|api key|root|password|dump|mật khẩu|trích xuất/i.test(raw);
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

      // Check if user attached a confidential document without an active token
      if (currentAttachment?.isConfidential && !activeToken) {
        const consentReply = {
          id: `msg-${Date.now()}`,
          sender: "ai",
          text: `🔒 Phát hiện Tài liệu Mật đính kèm: "${currentAttachment.name}" (${currentAttachment.size}).\n\nTài liệu này chứa thông tin nhân sự / tài chính / hợp đồng mật. Theo quy tắc Zero-Trust, AI cần được cấp Thẩm quyền Giải mã Tạm thời (Emergent Authority) trong 15 phút qua TideCloak để đọc và xử lý nội dung.`,
          maskedEcho: `Confidential Document Attached: "${currentAttachment.name}". Emergent Authority required.`,
          needsApproval: true,
          approved: false,
          targetDoc: currentAttachment.name,
          timestamp: nowTime()
        };
        setMessages((m) => [...m, consentReply]);
        return;
      }

      // If confidential document is attached and token is active
      if (currentAttachment) {
        let docAnalysis = "";
        if (/cv|resume/i.test(currentAttachment.name)) {
          docAnalysis = `✅ [TideCloak Token Verified · Emergent Authority Active]\n\nPhân tích hồ sơ CV đính kèm ("${currentAttachment.name}"):\n1. Ứng viên: 10+ năm kinh nghiệm quản lý cấp cao trong lĩnh vực Fintech & Enterprise SaaS.\n2. Lương và đãi ngộ cũ: Đã được ẩn danh hóa bằng WebCrypto ở tầng Client, Cloud LLM không thấy bản rõ.\n3. Đánh giá: Phù hợp tiêu chuẩn bổ nhiệm Giám đốc Vận hành (COO).\n\n🔒 Lưu ý: Quyền truy cập 15 phút đang kích hoạt. Bấm "Revoke Token" bất kỳ lúc nào để khóa lại.`;
        } else {
          docAnalysis = `✅ [TideCloak Token Verified · Emergent Authority Active]\n\nĐã giải mã tài liệu "${currentAttachment.name}" trong RAM cô lập:\n1. Điều khoản bảo mật và tính pháp lý hợp lệ.\n2. Không phát hiện dấu hiệu rò rỉ dữ liệu hoặc mã độc đính kèm.\n3. Toàn bộ nội dung phân tích được bảo vệ dưới khóa ngưỡng TideCloak.`;
        }
        setMessages((m) => [...m, { id: `msg-${Date.now()}`, sender: "ai", text: docAnalysis, maskedEcho: `[DECRYPTED VIA EMERGENT AUTHORITY: ${currentAttachment.name}]`, timestamp: nowTime() }]);
        return;
      }

      // Check if user is asking about Military Service (Nghĩa vụ quân sự)
      const isMilitary = /nghĩa vụ|quân sự|nhập ngũ|đi lính|20 tuổi|khám tuyển/i.test(raw);
      if (isMilitary) {
        const nameVal = scan.entities.find((e) => e.type === "NAME")?.value || "bạn";
        const phoneVal = scan.entities.find((e) => e.type === "PHONE")?.value || "[Số điện thoại]";

        const aiPlain = `Chào ${nameVal}, theo quy định tại Điều 30 Luật Nghĩa vụ quân sự 2015:\n\n1. Độ tuổi nhập ngũ: Công dân nam từ đủ 18 tuổi đến hết 25 tuổi. Nếu đang học đại học, cao đẳng hệ chính quy thì được tạm hoãn và độ tuổi gọi nhập ngũ kéo dài đến hết 27 tuổi.\n2. Trường hợp của ${nameVal} (20 tuổi): Hoàn toàn nằm trong độ tuổi gọi khám tuyển nghĩa vụ quân sự. Nếu có lệnh gọi khám sức khỏe và đạt tiêu chuẩn (sức khỏe loại 1, 2, 3; lý lịch rõ ràng; không thuộc diện tạm hoãn/miễn), bạn sẽ được gọi nhập ngũ.\n\n🛡️ Bảo mật: Số điện thoại (${phoneVal}) và danh tính của bạn đã được mã hóa an toàn qua TideCloak, Cloud AI hoàn toàn không lưu bản rõ.`;

        const aiMasked = `Chào [NAME_1], theo quy định tại Điều 30 Luật Nghĩa vụ quân sự 2015:\n\n1. Độ tuổi nhập ngũ: Công dân nam từ đủ 18 tuổi đến hết 25 tuổi. Nếu đang học đại học, cao đẳng thì được kéo dài đến hết 27 tuổi.\n2. Trường hợp của [NAME_1] (20 tuổi): Thuộc độ tuổi gọi khám tuyển nghĩa vụ quân sự.\n\n🛡️ Bảo mật: Số điện thoại ([PHONE_1]) đã được bảo vệ tuyệt đối.`;

        setMessages((m) => [...m, { id: `msg-${Date.now()}`, sender: "ai", text: aiPlain, maskedEcho: aiMasked, timestamp: nowTime() }]);
        return;
      }

      // Check if user is asking about M&A or Confidential Contracts -> Needs Emergent Authority Approval!
      const isSensitiveDoc = /M&A|hợp đồng|sáp nhập|non-compete|bản thỏa thuận|term sheet/i.test(raw);
      if (isSensitiveDoc && !activeToken) {
        const consentReply = {
          id: `msg-${Date.now()}`,
          sender: "ai",
          text: `Tài liệu bạn yêu cầu ("Thỏa thuận M&A $12.5M") chứa dữ liệu nhạy cảm cấp độ bí mật kinh doanh. Để phân tích điều khoản, hệ thống cần bạn phê duyệt thẩm quyền giải mã tạm thời qua TideCloak (Emergent Authority).`,
          maskedEcho: `Tài liệu yêu cầu chứa dữ liệu nhạy cảm cấp độ bí mật kinh doanh. Yêu cầu Emergent Authority Approval.`,
          needsApproval: true,
          approved: false,
          targetDoc: "M&A Agreement ($12.5M)",
          timestamp: nowTime()
        };
        setMessages((m) => [...m, consentReply]);
        return;
      }

      // Check if Banking / Credit loan dossier
      const isBanking = /vay|hồ sơ|tín dụng|thế chấp|vietcombank|ngân hàng|stk|cccd/i.test(raw);
      if (isBanking) {
        const nameVal = scan.entities.find((e) => e.type === "NAME")?.value || "khách hàng";
        const stkVal = scan.entities.find((e) => e.type === "STK")?.value || "tài khoản ngân hàng";

        const aiPlain = `Kết quả thẩm định tín dụng cho ${nameVal}:\n1. Tính pháp lý: Căn cước công dân và thông tin đăng ký kinh doanh hợp lệ.\n2. Dòng tiền thanh toán: Lịch sử giao dịch qua ${stkVal} đạt điểm tín dụng Hạng A.\n3. Đánh giá: Khoản vay thế chấp bất động sản đạt tỷ lệ LTV an toàn (~48%), khuyến nghị duyệt giải ngân.\n\n🛡️ Tuân thủ: Điều 30 Luật BVDLCN số 91/2025/QH15 (Không lưu bản rõ trên Cloud).`;

        const aiMasked = `Kết quả thẩm định tín dụng cho [NAME_1]:\n1. Tính pháp lý: Căn cước công dân [CCCD_1] hợp lệ.\n2. Dòng tiền thanh toán: Lịch sử qua [STK_1] đạt điểm tín dụng Hạng A.\n3. Đánh giá: Khoản vay [MONEY_1] đạt tỷ lệ LTV an toàn (~48%).\n\n🛡️ Tuân thủ: Điều 30 Luật BVDLCN số 91/2025/QH15.`;

        setMessages((m) => [...m, { id: `msg-${Date.now()}`, sender: "ai", text: aiPlain, maskedEcho: aiMasked, timestamp: nowTime() }]);
        return;
      }

      // General intelligent conversation
      const personName = scan.entities.find((e) => e.type === "NAME")?.value || "bạn";
      const aiPlain = `Chào ${personName}! Yêu cầu "${raw}" của bạn đã được tiếp nhận và xử lý qua kênh mã hóa Client-Side TideCloak.\n\nToàn bộ định danh cá nhân (PII) đã được giả danh hóa trước khi rời khỏi trình duyệt. Máy chủ Cloud AI không lưu trữ bản rõ, đảm bảo an toàn tuyệt đối.`;
      const aiMasked = `Yêu cầu "${scan.maskedText}" đã được xử lý qua kênh mã hóa Client-Side TideCloak. Dữ liệu nhạy cảm được bảo vệ 100%.`;

      setMessages((m) => [...m, { id: `msg-${Date.now()}`, sender: "ai", text: aiPlain, maskedEcho: aiMasked, timestamp: nowTime() }]);
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
    setActiveToken(false);
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

          {/* Auth Controls */}
          {isUserLoggedIn ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div className="auth-status">
                <span className="status-dot active"></span>
                <span>TideCloak · {currentUserName}</span>
              </div>
              <button className="btn-auth" onClick={handleLogout} id="btn-auth">
                Sign out
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button className="btn-auth" onClick={handleLogin} id="btn-auth" title="Sign in with real TideCloak IdP (sarah / password123)">
                Connect TideCloak IdP
              </button>
              <button
                className="btn-auth"
                style={{ background: "#f8fafc", color: "var(--text-secondary)", borderColor: "var(--border-medium)" }}
                onClick={handleQuickDemoLogin}
                id="btn-quick-demo"
                title="1-Click Simulated Demo Login as Sarah Nguyen"
              >
                ⚡ Quick Demo
              </button>
            </div>
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
            <span>Active Token:</span>
            <strong>{activeToken ? "15-Min Active ✓" : "Locked"}</strong>
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
            <div style={{ display: "flex", gap: "0.35rem" }}>
              {activeToken && (
                <button
                  className="chip red"
                  style={{ cursor: "pointer" }}
                  onClick={handleRevokeToken}
                  title="Revoke active decryption token immediately"
                >
                  🔒 Revoke Token
                </button>
              )}
              <button
                className="chip blue"
                style={{ cursor: "pointer" }}
                onClick={() => setShowUnmasked(!showUnmasked)}
              >
                {showUnmasked ? "👁️ Unmasked View" : "🔒 Masked Tokens"}
              </button>
            </div>
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
                    <span>{m.sender === "user" ? "User Query" : "Confidential AI Assistant"}</span>
                    <span>&bull;</span>
                    <span>{m.timestamp}</span>
                  </div>
                  {m.file && (
                    <div className="msg-file-card">
                      <span>📄</span>
                      <strong>{m.file.name}</strong>
                      <span>({m.file.size})</span>
                      {m.file.isConfidential && <span className="chip red" style={{ fontSize: "0.6rem" }}>CONFIDENTIAL ASSET</span>}
                    </div>
                  )}
                  <div className="bubble-text">
                    {showUnmasked ? m.text : (m.maskedText || m.maskedEcho || m.text)}
                  </div>

                  {/* Emergent Authority Approval Card */}
                  {m.needsApproval && !m.approved && (
                    <div style={{ marginTop: 8, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "8px 10px", fontSize: "0.74rem" }}>
                      <div style={{ color: "#92400e", fontWeight: 600, marginBottom: 6 }}>
                        🔒 <strong>Thẩm quyền Giải mã Tạm thời (Emergent Authority):</strong> AI yêu cầu cấp quyền 15 phút để phân tích hồ sơ mật.
                      </div>
                      <button
                        className="btn-ctrl blue"
                        style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                        onClick={handleGrantEmergentAuthority}
                      >
                        ✍️ Phê duyệt Cấp quyền 15 Phút qua TideCloak
                      </button>
                    </div>
                  )}

                  {m.needsApproval && m.approved && (
                    <div style={{ marginTop: 4, color: "#166534", fontSize: "0.7rem", fontWeight: 600 }}>
                      ✓ Emergent Authority Token Granted (15m Active)
                    </div>
                  )}

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

          {/* Prompt Presets & Document Attachments */}
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
            <button
              type="button"
              className="preset-btn"
              style={{ borderColor: "var(--blue-border)", color: "var(--blue-primary)", background: "var(--blue-light)" }}
              onClick={() => handleAttachPreset("Executive_CV_Confidential.pdf", "245 KB", true)}
              title="Attach a confidential CV"
            >
              📎 Sample CV (PDF)
            </button>
            <button
              type="button"
              className="preset-btn"
              style={{ borderColor: "var(--amber-border)", color: "var(--amber-primary)", background: "var(--amber-light)" }}
              onClick={() => handleAttachPreset("Passport_Identity_Scan.png", "1.2 MB", true)}
              title="Attach a confidential Passport scan"
            >
              📎 Passport (Image)
            </button>
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
            {attachedFile && (
              <div className="file-pill-banner">
                <div className="file-pill-left">
                  <span>📎</span>
                  <strong>{attachedFile.name}</strong>
                  <span>({attachedFile.size})</span>
                  {attachedFile.isConfidential && (
                    <span className="chip red" style={{ fontSize: "0.62rem" }}>CONFIDENTIAL ASSET</span>
                  )}
                </div>
                <button
                  type="button"
                  className="file-remove-btn"
                  onClick={() => setAttachedFile(null)}
                  title="Remove attachment"
                >
                  &times;
                </button>
              </div>
            )}
            <form className="input-row" onSubmit={handleSendMessage}>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                onChange={handleFileUpload}
                accept=".pdf,.png,.jpg,.jpeg,.mp4,.docx,.txt"
              />
              <button
                type="button"
                className="btn-attach"
                onClick={() => fileInputRef.current?.click()}
                title="Attach PDF, Image, Video, or Document"
              >
                📎
              </button>
              <input
                type="text"
                className="input-box"
                placeholder={attachedFile ? `Ask AI about ${attachedFile.name} (or leave blank & click Send)...` : "Ask AI or paste credit dossiers, CCCD, banking records, contracts..."}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={isShredded}
                id="chat-input"
              />
              <button
                type="submit"
                className="btn-send"
                disabled={isShredded || (!inputVal.trim() && !attachedFile)}
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
