let authenticatedFetch: typeof fetch | null = null;
export function setAuthenticatedFetch(transport: typeof fetch | null) { authenticatedFetch = transport; }
export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    const labels: Record<string, string> = {
      UNAUTHORIZED: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Hãy đăng nhập lại.',
      REVISION_CONFLICT: 'Hội thoại đã được cập nhật ở tab khác. Hãy tải lại trước khi gửi tiếp.',
      NOT_FOUND: 'Không tìm thấy hội thoại hoặc bạn không có quyền truy cập.',
      RATE_LIMITED: 'Đã đến giới hạn gọi AI. Hãy thử lại sau.',
      PROVIDER_TIMEOUT: 'AI phản hồi quá chậm. Bạn có thể thử lại.',
      PROVIDER_UNAVAILABLE: 'Không kết nối được AI. Kiểm tra cấu hình và thử lại.',
      DUPLICATE_REQUEST: 'Yêu cầu này đã được xử lý. Tải lại trước khi thử lại.',
      APPROVAL_REQUIRED: 'Nội dung chưa được duyệt hoặc phê duyệt đã sử dụng. Hãy xin duyệt lại.',
      APPROVAL_CHANGED: 'Nội dung, file hoặc cấu hình AI khác với bản đã duyệt. Cần xin duyệt lại.',
      APPROVAL_EXPIRED: 'Phê duyệt đã hết hạn 10 phút. Cần xin duyệt lại.',
      APPROVAL_CONFLICT: 'Trạng thái phê duyệt đã thay đổi hoặc đã dùng. Hãy tải lại.',
      APPROVER_REQUIRED: 'Tài khoản không có quyền file-approver đã xác minh.',
      SELF_APPROVAL_DENIED: 'Người gửi không được tự duyệt nội dung của mình.',
      RESTRICTED_CONTENT: 'Tài liệu Tuyệt mật bị chặn gửi cloud.',
    };
    super(labels[code] ?? `Yêu cầu không thành công (${code}).`);
  }
}
export async function api<T>(path: string, token: string | null, options: { method?: string; body?: unknown; signal?: AbortSignal; timeout?: number } = {}): Promise<T> {
  const transport = token && authenticatedFetch ? authenticatedFetch : fetch;
  const response = await transport(new URL(`/api${path}`, location.origin).href, {
    method: options.method ?? 'GET', credentials: 'omit',
    headers: { ...(token && !authenticatedFetch ? { Authorization: `Bearer ${token}` } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(options.timeout ?? 45000)]) : AbortSignal.timeout(options.timeout ?? 15000),
  });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new ApiError(response.status, data.error ?? 'REQUEST_FAILED'); }
  return response.status === 204 ? undefined as T : response.json();
}
