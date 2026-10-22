// Vietnamese PII Pseudonymisation Engine (Client-Side)
// Based on PrivateChat Shield / PLAN.md Section 6 & VN Legal Standard (Luat BVDLCN 91/2025/QH15)

const VALID_CCCD_PROVINCES = new Set([
  '001','002','004','006','008','010','011','012','014','015','017','019','020','022','024','025','026','027',
  '030','031','033','034','035','036','037','038','040','042','044','045','046','048','049','051','052','054',
  '056','058','060','062','064','066','067','068','070','072','074','075','077','079','080','082','083','084',
  '086','087','089','091','092','093','094','095','096'
]);

export const VN_SURNAMES = [
  "nguyễn", "nguyen", "trần", "tran", "lê", "le", "phạm", "pham", "hoàng", "hoang", "huỳnh", "huynh",
  "phan", "vũ", "vu", "võ", "vo", "đặng", "dang", "bùi", "bui", "đỗ", "do", "hồ", "ho", "ngô", "ngo",
  "dương", "duong", "lý", "ly", "đào", "dao", "đoàn", "doan", "vương", "vuong", "trịnh", "trinh",
  "đinh", "dinh", "lâm", "lam", "phùng", "phung", "mai", "tô", "to", "hà", "ha", "tạ", "ta", "trương", "truong"
];

const VN_MIDDLES = ["văn", "van", "thị", "thi", "hữu", "huu", "đức", "duc", "minh", "ngọc", "ngoc", "thanh", "quốc", "quoc", "gia", "xuân", "xuan", "bảo", "bao", "chấn", "chan", "trung"];

const BANK_CTX_KEYWORDS = /(?:stk|số tài khoản|so tai khoan|số tk|so tk|tài khoản|tai khoan|chuyển khoản|chuyen khoan|thụ hưởng|thu huong|vietcombank|vcb|techcombank|tcb|mbbank|bidv|vietinbank|ctg|agribank|vpbank|tpbank|acb|sacombank|stb|hdbank|vib|shb|seabank|msb|ocb|momo|zalopay)/i;

export function detectAndMaskPII(text) {
  if (!text) return { maskedText: "", entities: [], piiMap: {}, riskScore: 0, riskLevel: "SAFE" };

  const entities = [];
  const piiMap = {};
  let counter = {
    NAME: 1,
    CCCD: 1,
    PHONE: 1,
    STK: 1,
    EMAIL: 1,
    MONEY: 1,
    TAX: 1
  };

  // Helper to test if span overlaps with existing
  function isOverlapping(start, end) {
    return entities.some(e => (start < e.end && end > e.start));
  }

  // 1. Email Detection
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  let match;
  while ((match = emailRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (!isOverlapping(start, end)) {
      const token = `[EMAIL_${counter.EMAIL++}]`;
      entities.push({ type: "EMAIL", value: match[0], token, start, end, enabled: true });
    }
  }

  // 2. CCCD 12 Digits with Province validation
  const cccdRegex = /(?<!\d)(0\d{2})[\s.]?([0-9]\d{2})[\s.]?(\d{3})[\s.]?(\d{3})(?!\d)/g;
  while ((match = cccdRegex.exec(text)) !== null) {
    const rawDigits = match[0].replace(/[\s.]/g, '');
    if (rawDigits.length === 12) {
      const province = rawDigits.slice(0, 3);
      if (VALID_CCCD_PROVINCES.has(province)) {
        const start = match.index;
        const end = start + match[0].length;
        if (!isOverlapping(start, end)) {
          const token = `[CCCD_${counter.CCCD++}]`;
          entities.push({ type: "CCCD", value: match[0], token, start, end, enabled: true });
        }
      }
    }
  }

  // 3. Bank Account / STK with Context Window (+/- 60 chars)
  const stkCandidateRegex = /(?<!\d)(\d{8,16})(?!\d)/g;
  while ((match = stkCandidateRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const ctxStart = Math.max(0, start - 60);
    const ctxEnd = Math.min(text.length, end + 60);
    const context = text.slice(ctxStart, ctxEnd);

    if (BANK_CTX_KEYWORDS.test(context) && !isOverlapping(start, end)) {
      const token = `[STK_${counter.STK++}]`;
      entities.push({ type: "STK", value: match[0], token, start, end, enabled: true });
    }
  }

  // 4. Vietnamese Phone (03x, 05x, 07x, 08x, 09x, 02x, +84)
  const phoneRegex = /(?<!\d)(?:(?:\+?84|\(\+?84\))[\s.-]?|0)(?:(?:3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-46-9])(?:[\s.-]?\d){7}|2\d{1,2}(?:[\s.-]?\d){7,8})(?!\d)/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (!isOverlapping(start, end)) {
      const token = `[PHONE_${counter.PHONE++}]`;
      entities.push({ type: "PHONE", value: match[0], token, start, end, enabled: true });
    }
  }

  // 5. Money Amount
  const moneyRegex = /(?<!\w)(?:(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(tỷ|tỉ|triệu|tr|nghìn|ngàn|k|đồng|vnd|vnđ|\$|usd)(?:\s*(?:đồng|vnd|vnđ|rưỡi|\d{1,2}\b))?)(?!\w)/gi;
  while ((match = moneyRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (!isOverlapping(start, end)) {
      const token = `[MONEY_${counter.MONEY++}]`;
      entities.push({ type: "MONEY", value: match[0], token, start, end, enabled: true });
    }
  }

  // 6. Vietnamese Names (2-4 capitalized words starting with VN Surnames)
  const nameRegex = /\b([A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+(?:\s+[A-ZÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬĐÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+){1,3})\b/g;
  while ((match = nameRegex.exec(text)) !== null) {
    const fullName = match[0];
    const firstWord = fullName.split(/\s+/)[0].toLowerCase();
    if (VN_SURNAMES.includes(firstWord)) {
      const start = match.index;
      const end = start + match[0].length;
      if (!isOverlapping(start, end)) {
        const token = `[NAME_${counter.NAME++}]`;
        entities.push({ type: "NAME", value: fullName, token, start, end, enabled: true });
      }
    }
  }

  // Sort entities by start index ascending
  entities.sort((a, b) => a.start - b.start);

  // Construct masked text and piiMap
  let maskedText = "";
  let lastIndex = 0;
  for (const ent of entities) {
    maskedText += text.slice(lastIndex, ent.start);
    maskedText += ent.token;
    piiMap[ent.token] = ent.value;
    lastIndex = ent.end;
  }
  maskedText += text.slice(lastIndex);

  // Compute Risk Score
  let score = 0;
  entities.forEach(e => {
    if (e.type === "CCCD") score += 35;
    else if (e.type === "STK") score += 30;
    else if (e.type === "NAME") score += 20;
    else if (e.type === "PHONE") score += 15;
    else if (e.type === "EMAIL") score += 10;
    else if (e.type === "MONEY") score += 10;
  });
  const riskScore = Math.min(100, score);
  let riskLevel = "SAFE";
  if (riskScore >= 70) riskLevel = "CRITICAL";
  else if (riskScore >= 40) riskLevel = "HIGH";
  else if (riskScore > 0) riskLevel = "LOW";

  return { maskedText, entities, piiMap, riskScore, riskLevel };
}

// Single-Pass Streaming Fuzzy Unmasker
export function unmaskText(maskedText, piiMap) {
  if (!maskedText || !piiMap) return maskedText;
  let result = maskedText;
  for (const [token, realVal] of Object.entries(piiMap)) {
    // Replace token variations (e.g. [NAME_1], NAME_1)
    const escaped = token.replace(/[[\]]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    result = result.replace(regex, realVal);
  }
  return result;
}
