declare const __DEV__: boolean | undefined;

declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    EXPO_PUBLIC_DEV_AUTH_TOKEN?: string;
    EXPO_PUBLIC_SENTRY_DSN?: string;
    NODE_ENV?: string;
  };
};

const DEFAULT_API_URL = "http://localhost:3001/api/v1";
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const API_URL = configuredApiUrl || DEFAULT_API_URL;
const REQUEST_TIMEOUT_MS = 15000;

function isLocalhostApiUrl(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

function isDevRuntime() {
  if (typeof __DEV__ !== "undefined") {
    return __DEV__;
  }

  return process.env.NODE_ENV !== "production";
}

export function isProductionApiMisconfigured() {
  if (isDevRuntime()) {
    return false;
  }

  if (!configuredApiUrl) {
    return true;
  }

  return isLocalhostApiUrl(configuredApiUrl);
}

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
  const envValue = configuredApiUrl;
  const usingDefaultLocalUrl = !envValue;

  return {
    apiUrl: API_URL,
    usingDefaultLocalUrl,
    productionMisconfigured: isProductionApiMisconfigured(),
    message: isProductionApiMisconfigured()
      ? "This production build is missing a reachable household server URL. Set EXPO_PUBLIC_API_URL before shipping to TestFlight."
      : usingDefaultLocalUrl
        ? "This build is not pointing at a shared server yet. Test devices need the production API configured in the build."
        : null
  };
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const token = accessTokenProvider();
    const hasBody = options.body !== undefined && options.body !== null;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> | undefined)
    };

    if (hasBody && !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
      headers["Content-Type"] = "application/json";
    }

    if (!hasBody) {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === "content-type") {
          delete headers[key];
        }
      }
    }

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
