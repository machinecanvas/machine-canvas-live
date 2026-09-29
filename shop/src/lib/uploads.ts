import "server-only";
import { imageSize } from "image-size";
import { CUSTOM_UPLOAD } from "@/config";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { effectiveDpi, dpiVerdict, type DpiVerdict } from "@/lib/pricing";

export const CUSTOM_BUCKET = "custom-uploads";
export const PRODUCT_BUCKET = "product-images";

// Customer uploads go straight from the browser to a private bucket through a
// one-time signed upload URL (serverless functions can't accept 50 MB bodies).
// Paths look like "pending/<uuid>.<ext>" and are validated before use.
export const UPLOAD_PATH_RE = /^pending\/[0-9a-f-]{36}\.(jpg|png|pdf)$/;

export const EXT_FOR_MIME: Record<string, "jpg" | "png" | "pdf"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

export type UploadInspection = {
  mime: string;
  bytes: number;
  pxW: number | null;
  pxH: number | null;
};

/**
 * Server-side check of an uploaded file: it must exist, be within the size
 * limit and have the claimed type. For images we read only the first 256 KB
 * (via a signed range request) to get pixel dimensions.
 */
export async function inspectUpload(path: string): Promise<UploadInspection> {
  if (!UPLOAD_PATH_RE.test(path)) throw new Error("Invalid upload reference");
  const bucket = supabaseAdmin().storage.from(CUSTOM_BUCKET);
  const folder = path.split("/")[0];
  const name = path.split("/")[1];
  const { data: list, error } = await bucket.list(folder, { search: name, limit: 1 });
  if (error) throw error;
  const file = list.find((f) => f.name === name);
  if (!file) throw new Error("Upload not found. Please upload your file again.");
  const bytes = Number(file.metadata?.size ?? 0);
  const mime = String(file.metadata?.mimetype ?? "");
  if (!CUSTOM_UPLOAD.MIME_TYPES.includes(mime)) throw new Error("Unsupported file type");
  if (bytes <= 0 || bytes > CUSTOM_UPLOAD.MAX_BYTES) throw new Error("File is too large (max 50 MB)");

  if (!path.endsWith(`.${EXT_FOR_MIME[mime]}`)) throw new Error("File extension doesn't match its type");

  const { data: signed, error: signErr } = await bucket.createSignedUrl(path, 60);
  if (signErr) throw signErr;
  const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-262143" } });
  if (!res.ok) throw new Error("Could not read upload");
  const head = new Uint8Array(await res.arrayBuffer());

  if (mime === "application/pdf") {
    if (new TextDecoder().decode(head.slice(0, 5)) !== "%PDF-") throw new Error("File contents don't match its type");
    return { mime, bytes, pxW: null, pxH: null };
  }

  let dims: ReturnType<typeof imageSize>;
  try {
    dims = imageSize(head);
  } catch {
    throw new Error("Could not read image dimensions");
  }
  const expected = mime === "image/png" ? "png" : "jpg";
  if (dims.type !== expected || !dims.width || !dims.height) throw new Error("File contents don't match its type");
  return { mime, bytes, pxW: dims.width, pxH: dims.height };
}

export function uploadDpi(u: UploadInspection, widthCm: number, heightCm: number): { dpi: number | null; verdict: DpiVerdict } {
  if (u.pxW === null || u.pxH === null) return { dpi: null, verdict: "ok" }; // PDFs are checked by hand
  const dpi = effectiveDpi(u.pxW, u.pxH, widthCm, heightCm);
  return { dpi, verdict: dpiVerdict(dpi) };
}

export async function signedDownloadUrl(path: string, seconds = 60 * 60 * 24 * 7): Promise<string | null> {
  const { data, error } = await supabaseAdmin().storage.from(CUSTOM_BUCKET).createSignedUrl(path, seconds, { download: true });
  if (error) {
    console.error("signed url failed", error);
    return null;
  }
  return data.signedUrl;
}
