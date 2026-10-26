export type User = {
  id: number;
  username: string;
  is_admin?: boolean;
};

export type WallItem = {
  id: number;
  content: string;
  author: string;
  created_at: string;
  expires_at: string;
  comments_count: number;
  is_top: boolean;
};

export type WallResponse = {
  server_time: string;
  items: WallItem[];
};

export type Comment = {
  id: number;
  content: string;
  author: string;
  created_at: string;
};

export type MessageDetail = {
  id: number;
  content: string;
  author: string;
  created_at: string;
  expires_at: string;
  comments_count: number;
  comments: Comment[];
};

export type AdminReport = {
  id: number;
  message_id: number;
  reporter_id: number;
  reason: string;
  status: 'pending' | 'reviewed' | 'actioned';
  created_at: string;
  reviewed_at: string | null;
  message_content: string;
  message_author: string;
  message_hidden: boolean;
  message_expires_at: string;
};

export type LoginData = {
  username: string;
  password: string;
};

export type RegisterData = LoginData & {
  email: string;
};

type ErrorBody = {
  code?: string;
  message?: string;
  issues?: unknown;
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
};

/**
 * Error uniforme de la API. Conserva el código de aplicación para que la UI
 * pueda distinguir entre fallo de red, sesión ausente y errores de negocio.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: unknown;

  constructor(status: number, code: string, message: string, issues?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.code ?? 'request_failed',
      body?.message ?? 'No se pudo completar la solicitud',
      body?.issues,
    );
  }

  return body as T;
}

export function getWall(): Promise<WallResponse> {
  return request<WallResponse>('/api/wall');
}

export function getMessage(id: number): Promise<MessageDetail> {
  return request<MessageDetail>(`/api/messages/${id}`);
}

export function getMe(): Promise<User> {
  return request<User>('/api/auth/me');
}

export function register(data: RegisterData): Promise<User> {
  return request<User>('/api/auth/register', { method: 'POST', body: data });
}

export async function login(data: LoginData): Promise<User> {
  await request<{ ok: boolean }>('/api/auth/login', { method: 'POST', body: data });
  return getMe();
}

export async function logout(): Promise<void> {
  await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export function publishMessage(text: string): Promise<{ id: number }> {
  return request<{ id: number }>('/api/messages', {
    method: 'POST',
    body: { text },
  });
}

export function createComment(
  messageId: number,
  text: string,
): Promise<{ id: number; created_at: string }> {
  return request<{ id: number; created_at: string }>(`/api/messages/${messageId}/comments`, {
    method: 'POST',
    body: { text },
  });
}

export function reportMessage(
  messageId: number,
  reason: string,
): Promise<{ ok: boolean; status: string }> {
  return request<{ ok: boolean; status: string }>(`/api/messages/${messageId}/report`, {
    method: 'POST',
    body: { reason },
  });
}

export function getAdminReports(
  status: 'pending' | 'reviewed' | 'actioned' | 'all' = 'pending',
): Promise<{ items: AdminReport[] }> {
  return request<{ items: AdminReport[] }>(`/api/admin/reports?status=${status}`);
}

export function reviewAdminReport(
  reportId: number,
  status: 'reviewed' | 'actioned',
): Promise<{ ok: boolean; status: string; reviewed_at: string }> {
  return request<{ ok: boolean; status: string; reviewed_at: string }>(
    `/api/admin/reports/${reportId}`,
    { method: 'PATCH', body: { status } },
  );
}

export function hideAdminMessage(messageId: number): Promise<{ ok: boolean; hidden_at: string }> {
  return request<{ ok: boolean; hidden_at: string }>(`/api/admin/messages/${messageId}/hide`, {
    method: 'POST',
  });
}
