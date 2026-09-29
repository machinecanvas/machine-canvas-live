"use client";

import { useEffect, useMemo, useState } from "react";
import { BOOKING, BUSINESS, CUSTOM_UPLOAD, PRICING, type Category } from "@/config";
import { api } from "@/lib/paths";
import { customPrice, dpiVerdict, effectiveDpi, formatGBP, validDimensions } from "@/lib/pricing";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { CheckoutForm } from "@/components/CheckoutForm";

type Upload = {
  path: string | null; // set once the upload finishes
  name: string;
  mime: string;
  previewUrl: string | null;
  pxW: number | null;
  pxH: number | null;
};

function readImageSize(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("We couldn't read that image."));
    img.src = url;
  });
}

export function CustomPrint({ firstMonth, lastMonth }: { firstMonth: string; lastMonth: string }) {
  const [category, setCategory] = useState<Category>("wall");
  const [width, setWidth] = useState("300");
  const [height, setHeight] = useState("250");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [acceptLowRes, setAcceptLowRes] = useState(false);

  useEffect(() => () => {
    if (upload?.previewUrl) URL.revokeObjectURL(upload.previewUrl);
  }, [upload?.previewUrl]);

  const w = Number(width);
  const h = Number(height);
  const dimsOk = validDimensions(w, h);
  const price = dimsOk ? customPrice(category, w, h) : null;
  const dpi = useMemo(
    () => (upload?.pxW && upload.pxH && dimsOk ? effectiveDpi(upload.pxW, upload.pxH, w, h) : null),
    [upload, dimsOk, w, h],
  );
  const verdict = dpi === null ? "ok" : dpiVerdict(dpi);

  async function onFile(file: File | undefined) {
    setUploadError(null);
    setAcceptLowRes(false);
    if (!file) return;
    if (!CUSTOM_UPLOAD.MIME_TYPES.includes(file.type)) return setUploadError("Please choose a JPG, PNG or PDF file.");
    if (file.size > CUSTOM_UPLOAD.MAX_BYTES) return setUploadError("That file is over 50 MB. Please export a smaller version.");

    let previewUrl: string | null = null;
    let pxW: number | null = null;
    let pxH: number | null = null;
    if (file.type !== "application/pdf") {
      previewUrl = URL.createObjectURL(file);
      try {
        const size = await readImageSize(previewUrl);
        pxW = size.w;
        pxH = size.h;
      } catch (e) {
        return setUploadError((e as Error).message);
      }
    }
    setUpload({ path: null, name: file.name, mime: file.type, previewUrl, pxW, pxH });

    setUploading(true);
    try {
      const res = await fetch(api("/uploads"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mime: file.type, bytes: file.size }),
      });
      const data = (await res.json()) as { path?: string; token?: string; error?: string };
      if (!res.ok || !data.path || !data.token) throw new Error(data.error ?? "Upload failed");
      const { error } = await supabaseBrowser().storage.from("custom-uploads").uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });
      if (error) throw new Error("Upload failed. Please try again.");
      setUpload((u) => (u ? { ...u, path: data.path! } : u));
    } catch (e) {
      setUploadError((e as Error).message);
      setUpload(null);
    } finally {
      setUploading(false);
    }
  }

  let blockedReason: string | null = null;
  if (!dimsOk) blockedReason = `Enter a width and height between ${CUSTOM_UPLOAD.MIN_CM} and ${CUSTOM_UPLOAD.MAX_CM} cm.`;
  else if (price?.overMaxArea)
    blockedReason = `Areas over ${BOOKING.MAX_AREA_M2_PER_SLOT} m² need a site survey. Please contact us at ${BUSINESS.contactEmail} for a quote.`;
  else if (!upload?.path) blockedReason = uploading ? "Uploading your file…" : "Upload your image to continue.";
  else if (verdict === "block") blockedReason = "Your image resolution is too low for this size. Upload a larger image or reduce the size.";
  else if (verdict === "warn" && !acceptLowRes) blockedReason = "Please confirm you're happy with the lower resolution (above).";

  const aspect = dimsOk ? `${w} / ${h}` : "4 / 3";

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-xl">Your image</h2>
          <label className="block cursor-pointer border border-dashed border-zinc-600 p-6 text-center transition hover:border-cyan">
            <input type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            <span className="block font-semibold">{upload ? upload.name : "Choose a file"}</span>
            <span className="font-mono text-xs text-zinc-500">JPG, PNG or PDF · max 50 MB</span>
          </label>
          {uploading && <p className="mt-2 font-mono text-xs text-cyan">Uploading…</p>}
          {uploadError && <p className="mt-2 text-sm text-magenta">{uploadError}</p>}
        </section>

        <section>
          <h2 className="mb-4 text-xl">Surface &amp; size</h2>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(["wall", "floor"] as Category[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`border p-3 font-mono text-sm uppercase tracking-widest ${category === c ? "border-cyan bg-cyan text-ink" : "border-zinc-700"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="mono-label label">Width (cm)</span>
              <input className="field" inputMode="numeric" type="number" min={CUSTOM_UPLOAD.MIN_CM} max={CUSTOM_UPLOAD.MAX_CM} value={width} onChange={(e) => setWidth(e.target.value)} />
            </label>
            <label>
              <span className="mono-label label">Height (cm)</span>
              <input className="field" inputMode="numeric" type="number" min={CUSTOM_UPLOAD.MIN_CM} max={CUSTOM_UPLOAD.MAX_CM} value={height} onChange={(e) => setHeight(e.target.value)} />
            </label>
          </div>
          {price && (
            <p className="mt-3 font-mono text-xs text-zinc-500">
              Area {price.areaM2.toFixed(2)} m² · max {BOOKING.MAX_AREA_M2_PER_SLOT} m² per booking
            </p>
          )}
        </section>

        {upload && dpi !== null && (
          <section className={`border p-4 text-sm ${verdict === "ok" ? "border-zinc-700" : verdict === "warn" ? "border-yellowk" : "border-magenta"}`}>
            <p className="mono-label mb-1">Print resolution</p>
            <p>
              About <strong>{Math.round(dpi)} DPI</strong> at this size.{" "}
              {verdict === "ok" && "Great, this will print sharply."}
              {verdict === "warn" && `Below the recommended ${CUSTOM_UPLOAD.WARN_DPI} DPI: it may look soft up close.`}
              {verdict === "block" && `Below ${CUSTOM_UPLOAD.BLOCK_DPI} DPI: too low to print well at this size.`}
            </p>
            {verdict === "warn" && (
              <label className="mt-3 flex items-start gap-2">
                <input type="checkbox" checked={acceptLowRes} onChange={(e) => setAcceptLowRes(e.target.checked)} className="mt-1 accent-cyan" />
                <span>I understand and want to go ahead.</span>
              </label>
            )}
          </section>
        )}
        {upload?.mime === "application/pdf" && (
          <p className="border border-zinc-700 p-4 text-sm text-zinc-400">We'll check your PDF's resolution by hand and contact you before the install if there's a problem.</p>
        )}
      </div>

      <div className="space-y-8">
        <section>
          <p className="mono-label mb-3">Preview {dimsOk ? `· ${w} × ${h} cm` : ""}</p>
          <div className="relative w-full overflow-hidden border border-zinc-700 bg-zinc-900" style={{ aspectRatio: aspect, maxHeight: 420 }}>
            {upload?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={upload.previewUrl} alt="Your upload" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center font-mono text-xs text-zinc-500">
                {upload ? "PDF uploaded (no preview)" : "Your image will appear here, cropped to the print area"}
              </div>
            )}
          </div>
          {price && (
            <p className="mt-4 font-display text-3xl font-extrabold">
              {formatGBP(price.pricePence)} <span className="text-sm font-normal text-zinc-400">inc. VAT &amp; installation</span>
            </p>
          )}
          {price && (
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {formatGBP(price.setup * 100)} setup + {price.areaM2.toFixed(2)} m² × {formatGBP(PRICING.PER_M2[category] * 100)}/m²
            </p>
          )}
        </section>

        <CheckoutForm
          item={
            upload?.path && dimsOk
              ? { kind: "custom", uploadPath: upload.path, category, widthCm: w, heightCm: h, acceptLowRes }
              : null
          }
          pricePence={price?.pricePence ?? null}
          blockedReason={blockedReason}
          firstMonth={firstMonth}
          lastMonth={lastMonth}
        />
      </div>
    </div>
  );
}
