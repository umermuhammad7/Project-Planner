declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_DEV_AUTH_TOKEN?: string;
  };
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

let accessTokenProvider: () => string | null = () => null;

export function setApiAccessTokenProvider(provider: () => string | null) {
  accessTokenProvider = provider;
}

export type ApiResult<T> = {
  data?: T;
  error?: {
    message: string;
    code: string;
  };
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const token = accessTokenProvider();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined)
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
    const payload = (await response.json()) as unknown;

    if (!response.ok && isApiError(payload)) {
      return {
        error: {
          message: payload.error,
          code: payload.code
        }
      };
    }

    return { data: payload as T };
  } catch (error) {
    return {
      error: {
        message: error instanceof Error ? error.message : "Network request failed",
        code: "NETWORK_ERROR"
      }
    };
  }
}

function isApiError(value: unknown): value is { error: string; code: string } {
  return value !== null && typeof value === "object" && "error" in value && "code" in value;
}
