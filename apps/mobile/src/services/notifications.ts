import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { NotificationPermissionState } from "../types";

declare const process: {
  env: {
    EXPO_PUBLIC_EAS_PROJECT_ID?: string;
  };
};

export type NotificationCapability = {
  supported: boolean;
  permission: NotificationPermissionState;
  canRequestPermission: boolean;
  canRegisterPushToken: boolean;
  message: string;
};

export type NotificationRegistrationResult = {
  ok: boolean;
  permission: NotificationPermissionState;
  pushToken: string | null;
  message: string;
};

const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();

function normalizePermissionStatus(
  status: Notifications.PermissionStatus | "unsupported"
): NotificationPermissionState {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  if (status === "undetermined") return "undetermined";
  return "unsupported";
}

export async function getNotificationCapability(): Promise<NotificationCapability> {
  if (Platform.OS === "web") {
    return {
      supported: false,
      permission: "unsupported",
      canRequestPermission: false,
      canRegisterPushToken: false,
      message: "Push notifications are not supported in this Expo web build."
    };
  }

  const permissions = await Notifications.getPermissionsAsync();
  const permission = normalizePermissionStatus(permissions.status);
  const supported = Device.isDevice;

  if (!supported) {
    return {
      supported: false,
      permission,
      canRequestPermission: permission !== "denied",
      canRegisterPushToken: false,
      message: "Push token registration needs a physical device. Simulators can still show permission state."
    };
  }

  if (!easProjectId) {
    return {
      supported: true,
      permission,
      canRequestPermission: permission !== "denied",
      canRegisterPushToken: false,
      message: "Notifications need EXPO_PUBLIC_EAS_PROJECT_ID to register an Expo push token."
    };
  }

  return {
    supported: true,
    permission,
    canRequestPermission: permission !== "denied",
    canRegisterPushToken: permission === "granted",
    message:
      permission === "granted"
        ? "Notification permission is granted. Register the device token to finish setup."
        : "Allow notifications on this device to register a push token."
  };
}

export async function requestNotificationPermissionAndToken(): Promise<NotificationRegistrationResult> {
  try {
    const initial = await getNotificationCapability();

    if (!initial.supported) {
      return {
        ok: false,
        permission: initial.permission,
        pushToken: null,
        message: initial.message
      };
    }

    let permission = initial.permission;
    if (permission !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      permission = normalizePermissionStatus(requested.status);
    }

    if (permission !== "granted") {
      return {
        ok: false,
        permission,
        pushToken: null,
        message: "Notification permission was not granted on this device."
      };
    }

    if (!Device.isDevice) {
      return {
        ok: false,
        permission,
        pushToken: null,
        message: "Notification permission is granted, but push token registration needs a physical device."
      };
    }

    if (!easProjectId) {
      return {
        ok: false,
        permission,
        pushToken: null,
        message: "Notification permission is granted. Add EXPO_PUBLIC_EAS_PROJECT_ID to register a push token."
      };
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId
    });

    return {
      ok: true,
      permission,
      pushToken: tokenResult.data,
      message: "Notification permission granted and push token registered."
    };
  } catch (error) {
    return {
      ok: false,
      permission: "unknown",
      pushToken: null,
      message: error instanceof Error ? error.message : "Notification setup failed."
    };
  }
}

export async function refreshPushTokenIfAvailable(): Promise<NotificationRegistrationResult> {
  try {
    const capability = await getNotificationCapability();
    if (!capability.supported || capability.permission !== "granted" || !capability.canRegisterPushToken) {
      return {
        ok: false,
        permission: capability.permission,
        pushToken: null,
        message: capability.message
      };
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId
    });

    return {
      ok: true,
      permission: capability.permission,
      pushToken: tokenResult.data,
      message: "Push token refreshed from this device."
    };
  } catch (error) {
    return {
      ok: false,
      permission: "unknown",
      pushToken: null,
      message: error instanceof Error ? error.message : "Could not refresh push token."
    };
  }
}
