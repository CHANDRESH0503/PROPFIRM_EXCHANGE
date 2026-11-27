"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, X } from "lucide-react";
import { removeScreenshot, uploadScreenshot } from "@/app/(app)/(shell)/accounts/actions";
import { Button } from "@/components/ui/button";

const MAX_EDGE = 1600;
const MAX_BYTES = 2 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Resizes on the device before upload (mid-range phones on slow connections): longest edge
 * 1,600 px, WebP where the browser can encode it, JPEG otherwise, stepping quality down to fit.
 */
async function compress(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.82, 0.7, 0.55]) {
    let blob = await toBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  return null;
}

export function Screenshots({
  tradeId,
  shots,
  symbol,
}: {
  tradeId: string;
  shots: { id: string; url: string }[];
  symbol: string;
}) {
  const t = useTranslations("journal.detail");
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const full = shots.length >= 4;

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        const blob = await compress(file);
        if (!blob) {
          setError(t("shotFailed"));
          return;
        }
        const data = new FormData();
        data.set(
          "file",
          new File([blob], blob.type === "image/webp" ? "shot.webp" : "shot.jpg", {
            type: blob.type,
          }),
        );
        const result = await uploadScreenshot(tradeId, data);
        if (result?.status === "error") setError(t("shotFailed"));
      } catch {
        setError(t("shotFailed"));
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  return (
    <section aria-labelledby="shots" className="space-y-3">
      <h2 id="shots" className="font-heading text-lg font-semibold">
        {t("screenshots")}
      </h2>
      {shots.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shots.map((s, i) => (
            <li
              key={s.id}
              className="relative overflow-hidden rounded-xl border border-hairline bg-ink-deep/60"
            >
              <a href={s.url} target="_blank" rel="noreferrer" className="block">
                {/* Signed, short-lived URLs from private storage: not optimisable by next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.url}
                  alt={`${symbol} ${i + 1}`}
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
              </a>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={t("removeShot")}
                className="absolute top-1.5 right-1.5 bg-ink/80"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await removeScreenshot(tradeId, s.id);
                    if (r?.status === "error") setError(t("shotFailed"));
                  })
                }
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {full ? (
        <p className="text-sm text-muted-foreground">{t("shotLimit")}</p>
      ) : (
        <div className="space-y-1.5">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="shot-input"
            aria-label={t("addShot")}
            tabIndex={-1}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            pending={pending}
            onClick={() => input.current?.click()}
          >
            <ImagePlus aria-hidden="true" />
            {pending ? t("uploading") : t("addShot")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("shotHint")}</p>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
