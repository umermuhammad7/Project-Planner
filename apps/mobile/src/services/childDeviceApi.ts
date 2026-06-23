import { ChildDeviceChoresResponse, ChildDeviceMeResponse, ChildDevicesListResponse, ChildPairingCodeResponse, PairChildDeviceResponse } from "@homethread/shared";

import { apiRequest } from "./api";

const CHILD_DEVICE_TOKEN_KEY = "homethread.childDeviceToken";

let childDeviceTokenProvider: () => string | null = () => null;
let childDeviceUnauthorizedHandler: () => void | Promise<void> = () => undefined;

export function setChildDeviceTokenProvider(provider: () => string | null) {
  childDeviceTokenProvider = provider;
}

export function setChildDeviceUnauthorizedHandler(handler: () => void | Promise<void>) {
  childDeviceUnauthorizedHandler = handler;
}

export { CHILD_DEVICE_TOKEN_KEY };

async function childDeviceRequest<T>(path: string, options: RequestInit = {}) {
  const token = childDeviceTokenProvider();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined)
  };

  if (token) {
    headers.Authorization = `ChildDevice ${token}`;
  }

  const result = await apiRequest<T>(path, {
    ...options,
    headers
  });

  if (result.error?.code === "CHILD_DEVICE_AUTH_INVALID" || result.error?.code === "CHILD_DEVICE_AUTH_REQUIRED") {
    await childDeviceUnauthorizedHandler();
  }

  return result;
}

export async function pairChildDevice(pairingCode: string) {
  return childDeviceRequest<PairChildDeviceResponse>("/child-devices/pair", {
    method: "POST",
    body: JSON.stringify({ pairingCode: pairingCode.trim().toUpperCase() })
  });
}

export async function fetchChildDeviceSession() {
  return childDeviceRequest<ChildDeviceMeResponse>("/child-devices/me");
}

export async function saveChildDevicePushToken(pushToken: string) {
  return childDeviceRequest<{ device: { id: string; pushToken: string | null } }>("/child-devices/push-token", {
    method: "PUT",
    body: JSON.stringify({ pushToken })
  });
}

export async function fetchChildDeviceChores() {
  return childDeviceRequest<ChildDeviceChoresResponse>("/child-devices/chores/today");
}

export async function completeChildDeviceChore(choreId: string, memberId: string, dueDate: string) {
  return childDeviceRequest<{ completion: { id: string }; reward: { id: string } }>(
    `/child-devices/chores/${choreId}/complete`,
    {
      method: "POST",
      body: JSON.stringify({ memberId, dueDate })
    }
  );
}

export async function unpairChildDevice() {
  return childDeviceRequest<{ revoked: boolean }>("/child-devices/unpair", {
    method: "POST"
  });
}

export async function createChildPairingCode(familyId: string, memberId: string) {
  return apiRequest<ChildPairingCodeResponse>(`/families/${familyId}/members/${memberId}/child-pairing-code`, {
    method: "POST"
  });
}

export async function listChildDevices(familyId: string) {
  return apiRequest<ChildDevicesListResponse>(`/families/${familyId}/child-devices`);
}

export async function revokeChildDevice(familyId: string, deviceId: string) {
  return apiRequest<{ revoked: boolean }>(`/families/${familyId}/child-devices/${deviceId}`, {
    method: "DELETE"
  });
}
