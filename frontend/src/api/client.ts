const API_BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  errors: Array<{ field: string; message: string }>;
  statusCode: number;

  constructor(
    errors: Array<{ field: string; message: string }>,
    statusCode: number,
  ) {
    super(errors.map((e) => e.message).join('; '));
    this.name = 'ApiError';
    this.errors = errors;
    this.statusCode = statusCode;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    if (body && Array.isArray(body.errors)) {
      throw new ApiError(body.errors, body.status_code ?? response.status);
    }

    const message =
      body?.detail ?? body?.message ?? `HTTP ${response.status}`;
    throw new ApiError(
      [{ field: '_root', message }],
      response.status,
    );
  }

  return response.json() as Promise<T>;
}
