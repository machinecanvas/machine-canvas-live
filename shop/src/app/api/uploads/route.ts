import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { CUSTOM_UPLOAD } from "@/config";
import { rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CUSTOM_BUCKET, EXT_FOR_MIME } from "@/lib/uploads";

// Issues a one-time signed URL so the browser can upload the customer's
// artwork straight to the private bucket. The bucket itself enforces the
// 50 MB / type limits; the file is re-checked at checkout.
const Body = z.object({
  mime: z.enum(CUSTOM_UPLOAD.MIME_TYPES as [string, ...string[]]),
  bytes: z.number().int().positive().max(CUSTOM_UPLOAD.MAX_BYTES),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please upload a JPG, PNG or PDF under 50 MB." }, { status: 400 });
  }
  if (!(await rateLimit("upload", 10, 60 * 60))) {
    return NextResponse.json({ error: "Too many uploads. Please try again later." }, { status: 429 });
  }
  const path = `pending/${crypto.randomUUID()}.${EXT_FOR_MIME[parsed.data.mime]}`;
  const { data, error } = await supabaseAdmin().storage.from(CUSTOM_BUCKET).createSignedUploadUrl(path);
  if (error) {
    console.error("signed upload url failed", error);
    return NextResponse.json({ error: "Upload is unavailable right now." }, { status: 500 });
  }
  return NextResponse.json({ path, token: data.token });
}
