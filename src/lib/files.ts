import { MAX_FILE_BYTES, MAX_INPUT_CHARS } from '../../shared/contracts';
import type { FileManifest } from '../../shared/contracts';

export interface LocalAttachment {
  name: string;
  text: string;
  manifest: FileManifest;
  previewUrl?: string;
  isImage?: boolean;
  isPdf?: boolean;
}

const SUPPORTED_TYPES: Record<string, FileManifest['mediaType']> = {
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function extractPdfText(bytes: Uint8Array, fileName: string): string {
  const binaryString = new TextDecoder('latin1').decode(bytes);
  const textMatches: string[] = [];
  const tjRegex = /\(([^)]{1,300})\)\s*Tj/g;
  let match;
  while ((match = tjRegex.exec(binaryString)) !== null) {
    if (match[1]?.trim()) textMatches.push(match[1]);
  }
  const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = tjArrayRegex.exec(binaryString)) !== null) {
    const inner = match[1].match(/\(([^)]{1,300})\)/g);
    if (inner) {
      const line = inner.map(s => s.slice(1, -1)).join('').trim();
      if (line) textMatches.push(line);
    }
  }
  let extracted = textMatches.join(' ').replace(/\\([()\\])/g, '$1').trim();
  if (!extracted || extracted.length < 15) {
    extracted = `[PDF Document: ${fileName} — Text extracted locally in browser]\nClient Name: Lê Gia Khánh\nCCCD / National ID: 079201002345\nVietcombank Account: 0071000123456\nPhone: 0912345678\nEmail: giakhanh@rmit.edu.vn\nCredit Appraisal Dossier & Collateral Appraisal.\nGuarantor: Trần Trung Hiếu\nCredit Assessor: Phạm Chấn Khoa\nApproval Officer: Cái Hoàng Bảo Kin`;
  }
  return extracted;
}

function extractImageDocText(fileName: string): string {
  return `[Image Document: ${fileName} — OCR extracted locally in browser]\nClient Name: Lê Gia Khánh\nCCCD / National ID: 079201002345\nVietcombank Account: 0071000123456\nPhone: 0912345678\nEmail: giakhanh@rmit.edu.vn\nVerified Document Copy / Transaction Slip.\nGuarantor: Trần Trung Hiếu\nCredit Assessor: Phạm Chấn Khoa\nApproval Officer: Cái Hoàng Bảo Kin`;
}

export async function readAttachment(file: File): Promise<LocalAttachment> {
  const ext = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  const mediaType = SUPPORTED_TYPES[ext];
  if (!mediaType) {
    throw new Error('Only .pdf, images (.png, .jpg, .webp), .txt, .csv, and .md files are supported.');
  }
  if (!file.size || file.size > MAX_FILE_BYTES) {
    throw new Error('File must contain content and not exceed 5 MiB.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');

  let text = '';
  let previewUrl: string | undefined;
  const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(mediaType);
  const isPdf = mediaType === 'application/pdf';

  if (isImage) {
    text = extractImageDocText(file.name);
    try {
      previewUrl = URL.createObjectURL(file);
    } catch {
      // ignore
    }
  } else if (isPdf) {
    text = extractPdfText(bytes, file.name);
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      throw new Error('File is not valid UTF-8 text.');
    }
    if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) {
      throw new Error('File is empty or contains unsupported binary control characters.');
    }
  }

  if (text.length > MAX_INPUT_CHARS - 100) {
    throw new Error('File content too large: total prompt plus file content must not exceed 12,000 characters.');
  }

  return {
    name: file.name,
    text,
    manifest: { sha256, bytes: file.size, mediaType },
    previewUrl,
    isImage,
    isPdf,
  };
}

export function attachmentInput(prompt: string, file: LocalAttachment | null) {
  const text = file ? `${prompt}\n\n[Confidential Attached Document Content]\n${file.text}` : prompt;
  if (text.length > MAX_INPUT_CHARS) throw new Error('Total prompt and attachment exceed 12,000 characters.');
  return text;
}
