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

type ErrorBody = {
  code?: string;
  message?: string;
};

/**
 * Error uniforme de la API. Conserva el código de aplicación para que la UI
 * pueda distinguir entre fallo de red, sesión ausente y errores de negocio.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  const body = (await response.json().catch(() => null)) as (T & ErrorBody) | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.code ?? 'request_failed',
      body?.message ?? 'No se pudo completar la solicitud',
    );
  }

  return body as T;
}

export function getWall(): Promise<WallResponse> {
  return request<WallResponse>('/api/wall');
}
