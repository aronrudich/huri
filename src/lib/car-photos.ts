import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Photos live in a private bucket and are read through short-lived signed URLs. */
export const CAR_PHOTO_BUCKET = "car-photos";

export type CarPhoto = {
  id: string;
  ro_number: string;
  storage_path: string;
  uploaded_by: string | null;
  created_at: string;
};

const normalizeRo = (ro: string | null | undefined) => (ro ?? "").trim();

/** All photos for one RO, newest first. */
export const carPhotosQuery = (ro: string | null | undefined) =>
  queryOptions({
    queryKey: ["car-photos", normalizeRo(ro)],
    enabled: !!normalizeRo(ro),
    staleTime: 30_000,
    queryFn: async (): Promise<CarPhoto[]> => {
      const target = normalizeRo(ro);
      if (!target) return [];
      const { data, error } = await supabase
        .from("car_photos")
        .select("id, ro_number, storage_path, uploaded_by, created_at")
        .eq("ro_number", target)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CarPhoto[];
    },
  });

/**
 * ro -> photos for a whole list of cars, so every list row can show the
 * "there's a photo on this car" badge from a single request.
 */
export const carPhotoIndexQuery = (ros: string[]) => {
  const list = Array.from(new Set(ros.map(normalizeRo).filter(Boolean))).sort();
  return queryOptions({
    queryKey: ["car-photo-index", list.join(",")],
    enabled: list.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, CarPhoto[]>> => {
      const { data, error } = await supabase
        .from("car_photos")
        .select("id, ro_number, storage_path, uploaded_by, created_at")
        .in("ro_number", list)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const by: Record<string, CarPhoto[]> = {};
      ((data ?? []) as CarPhoto[]).forEach((p) => {
        (by[p.ro_number] ??= []).push(p);
      });
      return by;
    },
  });
};

/** Signed URLs for a set of storage paths (1 hour). */
export const signedPhotoUrlsQuery = (paths: string[]) => {
  const list = Array.from(new Set(paths)).sort();
  return queryOptions({
    queryKey: ["car-photo-urls", list.join(",")],
    enabled: list.length > 0,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from(CAR_PHOTO_BUCKET)
        .createSignedUrls(list, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((row) => {
        if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      });
      return map;
    },
  });
};

export const useSignedPhotoUrls = (paths: string[]) => useQuery(signedPhotoUrlsQuery(paths));

/**
 * Phone cameras produce 4-6 MB files; the lot's connection does not. Shrink to a
 * ~1600px long edge JPEG before upload so photos open instantly on every device.
 */
export async function shrinkImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

/** Upload one photo and attach it to the RO. */
export async function uploadCarPhoto(file: File, ro: string, userId: string) {
  const target = normalizeRo(ro);
  if (!target) throw new Error("Add the RO # before attaching a photo");
  const blob = await shrinkImage(file);
  const path = `${target}/${crypto.randomUUID()}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(CAR_PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw upErr;
  const { error } = await supabase
    .from("car_photos")
    .insert({ ro_number: target, storage_path: path, uploaded_by: userId } as never);
  if (error) throw error;
}

export async function deleteCarPhoto(photo: CarPhoto) {
  const { error } = await supabase.from("car_photos").delete().eq("id", photo.id);
  if (error) throw error;
  await supabase.storage.from(CAR_PHOTO_BUCKET).remove([photo.storage_path]);
}

/* ---------- "already looked at it" tracking, so the glow stops pulsing ---------- */

const SEEN_KEY = "huri.car-photos.seen";

const readSeen = (): string[] => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

export const hasUnseenPhotos = (photos: CarPhoto[]) => {
  if (typeof window === "undefined" || photos.length === 0) return false;
  const seen = new Set(readSeen());
  return photos.some((p) => !seen.has(p.id));
};

export const markPhotosSeen = (photos: CarPhoto[]) => {
  if (typeof window === "undefined") return;
  try {
    const seen = new Set(readSeen());
    photos.forEach((p) => seen.add(p.id));
    // Keep the list from growing forever.
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-800)));
  } catch {
    /* private mode — the badge just keeps pulsing */
  }
}
