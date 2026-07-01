import { decode } from "base64-arraybuffer";

import { supabaseClient } from "./supabase";

declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET?: string;
  };
};

const avatarBucket = process.env.EXPO_PUBLIC_SUPABASE_AVATAR_BUCKET?.trim() || "avatars";

type AvatarUploadFailure = {
  ok: false;
  message: string;
  cancelled?: boolean;
};

type AvatarUploadSuccess = {
  ok: true;
  avatarUrl: string;
  localPreviewUrl: string | null;
};

async function loadImagePicker() {
  return import("expo-image-picker");
}

function extensionFromMimeType(mimeType: string | null | undefined) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function withCacheBust(url: string) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${Date.now()}`;
}

function friendlyAvatarUploadError(message: string | undefined) {
  const raw = message?.trim();
  if (!raw) {
    return "Could not upload that profile photo.";
  }

  if (/bucket|not found/i.test(raw)) {
    return `Profile photo storage is not ready. The Supabase "${avatarBucket}" bucket needs to be enabled.`;
  }

  if (/policy|permission|not authorized|unauthorized|forbidden|row-level|rls/i.test(raw)) {
    return "Profile photo upload is blocked by storage permissions. Check the avatar bucket policies.";
  }

  return raw;
}

export async function pickAndUploadAvatar(userId: string): Promise<AvatarUploadFailure | AvatarUploadSuccess> {
  if (!supabaseClient) {
    return {
      ok: false as const,
      message: "Profile photo upload is not set up in this app build."
    };
  }

  const ImagePicker = await loadImagePicker();
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return {
      ok: false as const,
      message: "Allow photo library access before choosing a profile photo."
    };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.78,
    base64: true
  });

  if (result.canceled || !result.assets?.[0]) {
    return {
      ok: false as const,
      cancelled: true as const,
      message: "Photo selection was cancelled."
    };
  }

  const asset = result.assets[0];
  if (!asset.base64) {
    return {
      ok: false as const,
      message: "HomeThread could not read that photo for upload."
    };
  }

  const extension = extensionFromMimeType(asset.mimeType);
  const path = `${userId}/avatar-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(avatarBucket)
    .upload(path, decode(asset.base64), {
      contentType: asset.mimeType ?? "image/jpeg",
      upsert: true
    });

  if (uploadError) {
    return {
      ok: false as const,
      message: friendlyAvatarUploadError(uploadError.message)
    };
  }

  const publicUrl = supabaseClient.storage.from(avatarBucket).getPublicUrl(path).data.publicUrl;
  const signedUrlResult = await supabaseClient.storage.from(avatarBucket).createSignedUrl(path, 60 * 60 * 24 * 365);
  const resolvedUrl = signedUrlResult.data?.signedUrl ?? publicUrl;

  return {
    ok: true as const,
    avatarUrl: withCacheBust(resolvedUrl),
    localPreviewUrl: asset.uri
  };
}
