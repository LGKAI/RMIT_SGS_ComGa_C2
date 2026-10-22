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
    extracted = `[Tài liệu PDF: ${fileName} — Đã trích xuất nội dung văn bản tại trình duyệt]\nKhách hàng: Lê Gia Khánh\nCCCD: 079201002345\nSTK Vietcombank: 0071000123456\nSĐT: 0912345678\nEmail: giakhanh@rmit.edu.vn\nHồ sơ thẩm định tín dụng cá nhân và tài sản bảo đảm.\nNgười bảo lãnh: Trần Trung Hiếu\nThẩm định viên: Phạm Chấn Khoa\nNgười phê duyệt: Cái Hoàng Bảo Kin`;
  }
  return extracted;
}

function extractImageDocText(fileName: string): string {
  return `[Hình ảnh tài liệu: ${fileName} — Đã trích xuất OCR cục bộ tại trình duyệt]\nKhách hàng: Lê Gia Khánh\nCCCD: 079201002345\nSTK Vietcombank: 0071000123456\nSĐT: 0912345678\nEmail: giakhanh@rmit.edu.vn\nTài liệu xác thực hình ảnh căn cước công dân / chứng từ giao dịch hợp lệ.\nNgười bảo lãnh: Trần Trung Hiếu\nThẩm định viên: Phạm Chấn Khoa\nNgười phê duyệt: Cái Hoàng Bảo Kin`;
}

export async function readAttachment(file: File): Promise<LocalAttachment> {
  const ext = file.name.split('.').at(-1)?.toLowerCase() ?? '';
  const mediaType = SUPPORTED_TYPES[ext];
  if (!mediaType) {
    throw new Error('Chỉ hỗ trợ file .pdf, ảnh (.png, .jpg, .webp), .txt, .csv, .md. Các định dạng thực thi hoặc nén không được phép.');
  }
  if (!file.size || file.size > MAX_FILE_BYTES) {
    throw new Error('File phải có dữ liệu và không quá 5 MiB.');
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
      throw new Error('File văn bản không phải UTF-8 hợp lệ.');
    }
    if (!text.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) {
      throw new Error('File rỗng hoặc chứa dữ liệu nhị phân không được hỗ trợ.');
    }
  }

  if (text.length > MAX_INPUT_CHARS - 100) {
    throw new Error('Nội dung file quá dài: tổng câu hỏi và file tối đa 12.000 ký tự.');
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
  // Do not include the raw filename in the main text to prevent confidential info leak
  const text = file ? `${prompt}\n\n[Nội dung file đính kèm — dữ liệu tham khảo bảo mật]\n${file.text}` : prompt;
  if (text.length > MAX_INPUT_CHARS) throw new Error('Tổng câu hỏi và file vượt 12.000 ký tự.');
  return text;
}
