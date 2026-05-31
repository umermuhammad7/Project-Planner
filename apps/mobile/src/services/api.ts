declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_DEV_AUTH_TOKEN?: string;
  };
};

const DEFAULT_API_URL = "http://localhost:3001/api/v1";
const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;
const REQUEST_TIMEOUT_MS = 15000;

let accessTokenProvider: () => string | null = () => null;
let unauthorizedHandler: () => void | Promise<void> = () => undefined;

export function setApiAccessTokenProvider(provider: () => string | null) {
  accessTokenProvider = provider;
}

export function setApiUnauthorizedHandler(handler: () => void | Promise<void>) {
  unauthorizedHandler = handler;
}

export type ApiResult<T> = {
  data?: T;
  error?: {
    message: string;
    code: string;
  };
};

export function getApiConfigurationStatus() {
  const envValue = process.env.EXPO_PUBLIC_API_URL?.trim();
  const usingDefaultLocalUrl = !envValue;

  return {
    apiUrl: API_URL,
    usingDefaultLocalUrl,
    message: usingDefaultLocalUrl
      ? "EXPO_PUBLIC_API_URL is missing, so HomeThread is using the default local API URL. This works on the same machine, but physical devices need a reachable host."
      : null
  };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
      headers,
      signal: controller.signal
    });
    const payload = await parseResponseBody(response);

    if (response.status === 401) {
      await unauthorizedHandler();
    }

    if (!response.ok && isApiError(payload)) {
      const message =
        payload.code === "RATE_LIMITED"
          ? "HomeThread is getting too many requests right now. Wait a moment, then try again."
          : payload.error;
      return {
        error: {
          message,
          code: payload.code
        }
      };
    }

    return { data: payload as T };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "HomeThread timed out while waiting for the server. Check the connection and try again."
        : error instanceof Error
          ? error.message
          : "Network request failed";

    return {
      error: {
        message,
        code: "NETWORK_ERROR"
      }
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function isApiError(value: unknown): value is { error: string; code: string } {
  return value !== null && typeof value === "object" && "error" in value && "code" in value;
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as unknown;
  }

  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      error: text,
      code: response.ok ? "NON_JSON_RESPONSE" : "HTTP_ERROR"
    };
  }
}
