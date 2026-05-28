declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_DEV_AUTH_TOKEN?: string;
  };
};

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const DEV_AUTH_TOKEN = process.env.EXPO_PUBLIC_DEV_AUTH_TOKEN ?? "homethread-dev-token";

export type ApiResult<T> = {
  data?: T;
  error?: {
    message: string;
    code: string;
  };
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEV_AUTH_TOKEN}`,
        ...options.headers
      }
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
