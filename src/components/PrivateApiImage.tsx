import { useEffect, useState } from "react";
import { getApiToken } from "@/lib/api";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export default function PrivateApiImage({ src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [objectUrl, setObjectUrl] = useState("");
  useEffect(() => {
    if (!src) { setObjectUrl(""); return; }
    const controller = new AbortController();
    let currentUrl = "";
    fetch(src.startsWith("/api/") ? `${API_BASE}${src.slice(4)}` : src, {
      headers: { Authorization: `Bearer ${getApiToken()}` }, signal: controller.signal
    }).then((response) => {
      if (!response.ok) throw new Error("Image unavailable");
      return response.blob();
    }).then((blob) => {
      currentUrl = URL.createObjectURL(blob); setObjectUrl(currentUrl);
    }).catch(() => setObjectUrl(""));
    return () => { controller.abort(); if (currentUrl) URL.revokeObjectURL(currentUrl); };
  }, [src]);
  return objectUrl ? <img {...props} src={objectUrl} /> : null;
}
