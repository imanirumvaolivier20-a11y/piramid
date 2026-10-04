"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buttonClass } from "@/components/ui";

const MAX_EDGE = 1600;

/** Shrinks a phone photo before upload so reports send quickly on mobile data. */
async function downscale(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // let the server validate the original
  }
}

/**
 * Collects photos from the camera or the gallery and exposes them to the
 * surrounding <form> through a hidden file input named `name`.
 */
export function PhotoPicker({ name, max = 10 }: { name: string; max?: number }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const output = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  // Mirror the selection into the real input that the form submits.
  useEffect(() => {
    if (!output.current) return;
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    output.current.files = transfer.files;
  }, [files]);

  async function add(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length === 0) return;
    setBusy(true);
    const resized = await Promise.all(picked.map(downscale));
    setFiles((current) => [...current, ...resized].slice(0, max));
    setBusy(false);
  }

  const full = files.length >= max;

  return (
    <div>
      <input ref={output} type="file" name={name} multiple hidden />

      <div className="flex flex-wrap gap-2">
        <label className={`${buttonClass.secondary} cursor-pointer ${full ? "pointer-events-none opacity-60" : ""}`}>
          Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={add} disabled={full} />
        </label>
        <label className={`${buttonClass.secondary} cursor-pointer ${full ? "pointer-events-none opacity-60" : ""}`}>
          Choose from gallery
          <input type="file" accept="image/*" multiple className="sr-only" onChange={add} disabled={full} />
        </label>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {busy ? "Preparing photos…" : `${files.length} of ${max} photos added.`}
      </p>

      {files.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map((url, index) => (
            <li key={url} className="relative aspect-square overflow-hidden rounded-lg bg-zinc-100">
              {/* Local blob preview; next/image cannot optimise it. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm text-white"
                aria-label={`Remove photo ${index + 1}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
