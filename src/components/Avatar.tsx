import { X } from "lucide-react";

/**
 * Round profile photo (or initial fallback). Tapping the photo opens it full-size
 * via `onExpand` so employees can identify each other.
 */
export function Avatar({
  url,
  name,
  size = 40,
  onExpand,
  className = "",
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  onExpand?: (url: string, name: string) => void;
  className?: string;
}) {
  const display = name?.trim() || "Unknown";
  const initial = display[0]?.toUpperCase() ?? "?";
  const style = { width: size, height: size };

  if (url) {
    return (
      <button
        type="button"
        onClick={(e) => {
          if (!onExpand) return;
          e.preventDefault();
          e.stopPropagation();
          onExpand(url, display);
        }}
        aria-label={`View ${display} profile photo`}
        className={`shrink-0 overflow-hidden rounded-full ${className}`}
        style={style}
      >
        <img src={url} alt={`${display} profile photo`} className="h-full w-full object-cover" />
      </button>
    );
  }

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary ${className}`}
      style={{ ...style, fontSize: Math.max(12, Math.round(size * 0.4)) }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

/** Full-screen photo viewer. */
export function AvatarViewer({
  url,
  name,
  onClose,
}: {
  url: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close photo"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
      >
        <X className="h-5 w-5" />
      </button>
      <figure className="max-h-full w-full max-w-md text-center" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt={`${name} profile photo`} className="mx-auto max-h-[70vh] w-full rounded-2xl object-contain" />
        <figcaption className="mt-3 text-sm font-medium text-white">{name}</figcaption>
      </figure>
    </div>
  );
}
