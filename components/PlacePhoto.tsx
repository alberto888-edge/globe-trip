"use client";
import { useEffect, useState } from "react";
import { usePlaceInfo, type PlaceQuery } from "@/lib/wiki";

/**
 * A place's photo: an explicit image (e.g. a frame from the video) or its
 * Wikipedia picture. If the sized rendition fails, falls back to the original thumbnail.
 */
export default function PlacePhoto({ q, src, className, alt, large }: { q?: PlaceQuery | null; src?: string; className?: string; alt?: string; large?: boolean }) {
  const { info, loading } = usePlaceInfo(src ? null : q ?? null);
  const wanted = src || (large ? info?.imageLarge : info?.image);
  const [url, setUrl] = useState(wanted);
  useEffect(() => setUrl(wanted), [wanted]);
  const onError = () => setUrl((u) => (info?.thumb && u !== info.thumb ? info.thumb : undefined));
  return (
    <div className={`photo ${className || ""} ${loading && !url ? "photo--loading" : ""}`}>
      {url
        ? <img src={url} alt={alt || q?.name || ""} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={onError} />
        : <span aria-hidden="true">{(q?.name || "?").slice(0, 1)}</span>}
    </div>
  );
}
