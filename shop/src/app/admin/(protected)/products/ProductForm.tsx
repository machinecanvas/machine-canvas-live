"use client";

import { useState, useTransition } from "react";
import type { Category } from "@/config";
import type { Product } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { productUploadUrl, saveProduct } from "../actions";

type SizeRow = { label: string; width: string; height: string; price: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);

export function ProductForm({ product }: { product?: Product }) {
  const [title, setTitle] = useState(product?.title ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState<Category>(product?.category ?? "wall");
  const [active, setActive] = useState(product?.active ?? true);
  const [sizes, setSizes] = useState<SizeRow[]>(
    product?.size_options.map((s) => ({ label: s.label, width: String(s.width_cm), height: String(s.height_cm), price: (s.price_pence / 100).toFixed(2) })) ?? [
      { label: "Standard", width: "", height: "", price: "" },
    ],
  );
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);
  const [originalPath, setOriginalPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("Please use a JPG, PNG or WebP image.");
    if (file.size > 50 * 1024 * 1024) return setError("Images must be under 50 MB.");
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { path, token } = await productUploadUrl(file.type);
      const { error: upErr } = await supabaseBrowser().storage.from("product-images").uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (upErr) throw upErr;
      setOriginalPath(path);
    } catch (e) {
      setError(`Upload failed: ${(e as Error).message}`);
      setPreview(product?.image_url ?? null);
    } finally {
      setUploading(false);
    }
  }

  function updateSize(i: number, patch: Partial<SizeRow>) {
    setSizes((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      const res = await saveProduct({
        id: product?.id,
        title,
        slug,
        description,
        category,
        active,
        originalPath,
        sizes: sizes.map((s) => ({
          label: s.label,
          width_cm: Number(s.width),
          height_cm: Number(s.height),
          price_pence: Math.round(Number(s.price) * 100),
        })),
      });
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-2">
      <div>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFile(e.dataTransfer.files[0]);
          }}
          className={`flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed transition ${
            dragging ? "border-cyan bg-cyan/10" : "border-zinc-700 hover:border-zinc-500"
          }`}
        >
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="p-6 text-center text-zinc-400">
              Drag &amp; drop an image here
              <br />
              <span className="font-mono text-xs text-zinc-500">or click to choose · JPG, PNG, WebP</span>
            </span>
          )}
        </label>
        <p className="mt-2 font-mono text-xs text-zinc-500">
          {uploading ? "Uploading…" : "The original is kept; a web-optimised copy is made when you save."}
        </p>
      </div>

      <div className="space-y-5">
        <label className="block">
          <span className="mono-label label">Title</span>
          <input
            className="field"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </label>
        <label className="block">
          <span className="mono-label label">URL slug</span>
          <input
            className="field font-mono"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </label>
        <label className="block">
          <span className="mono-label label">Description</span>
          <textarea className="field" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex gap-2">
            {(["wall", "floor"] as Category[]).map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCategory(c)}
                className={`btn btn-small ${category === c ? "btn-cyan" : "border-zinc-700"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-cyan" />
            <span>Visible in shop</span>
          </label>
        </div>

        <fieldset>
          <legend className="mono-label mb-2">Sizes &amp; prices (inc. VAT)</legend>
          <div className="space-y-2">
            {sizes.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem_5.5rem_auto] gap-2">
                <input className="field" placeholder="Label" required value={s.label} onChange={(e) => updateSize(i, { label: e.target.value })} aria-label="Size label" />
                <input className="field" placeholder="W cm" type="number" min="1" required value={s.width} onChange={(e) => updateSize(i, { width: e.target.value })} aria-label="Width cm" />
                <input className="field" placeholder="H cm" type="number" min="1" required value={s.height} onChange={(e) => updateSize(i, { height: e.target.value })} aria-label="Height cm" />
                <input className="field" placeholder="£" type="number" min="1" step="0.01" required value={s.price} onChange={(e) => updateSize(i, { price: e.target.value })} aria-label="Price £" />
                <button
                  type="button"
                  className="px-2 text-zinc-500 hover:text-magenta disabled:opacity-30"
                  disabled={sizes.length === 1}
                  onClick={() => setSizes((rows) => rows.filter((_, j) => j !== i))}
                  aria-label="Remove size"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 font-mono text-xs text-cyan" onClick={() => setSizes((r) => [...r, { label: "", width: "", height: "", price: "" }])}>
            + Add size
          </button>
        </fieldset>

        {error && <p className="text-magenta">{error}</p>}
        <button className="btn btn-cyan" disabled={saving || uploading}>
          {saving ? "Saving…" : "Save product"}
        </button>
      </div>
    </form>
  );
}
