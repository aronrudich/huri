import { useEffect, useRef, useState } from "react";
import { X, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { directoryQuery } from "@/lib/queries";
import { type CarPhoto, deleteCarPhoto, useSignedPhotoUrls } from "@/lib/car-photos";

/**
 * Full-screen car photo viewer. Swipe (or tap the arrows) to move between the
 * photos attached to one car; tap the backdrop to close.
 */
export function PhotoViewer({
  photos,
  startIndex = 0,
  ro,
  canDelete,
  onClose,
  onChanged,
}: {
  photos: CarPhoto[];
  startIndex?: number;
  ro?: string | null;
  canDelete?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, photos.length - 1)));
  const [busy, setBusy] = useState(false);
  const startX = useRef<number | null>(null);
  const { data: urls } = useSignedPhotoUrls(photos.map((p) => p.storage_path));
  const { data: directory } = useQuery(directoryQuery());

  useEffect(() => {
    if (index > photos.length - 1) setIndex(Math.max(0, photos.length - 1));
  }, [photos.length, index]);

  useEffect(() => {
    if (photos.length === 0) onClose();
  }, [photos.length, onClose]);

  const photo = photos[index];
  if (!photo) return null;
  const url = urls?.[photo.storage_path];
  const who = photo.uploaded_by ? directory?.[photo.uploaded_by]?.name : null;

  const move = (delta: number) => {
    setIndex((i) => Math.min(photos.length - 1, Math.max(0, i + delta)));
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      onClick={onClose}
      onTouchStart={(e) => { startX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        const from = startX.current;
        startX.current = null;
        const to = e.changedTouches[0]?.clientX;
        if (from == null || to == null) return;
        if (Math.abs(to - from) > 50) move(to < from ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 safe-top" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-sm font-semibold text-white">
          {ro ? `RO #${ro}` : "Car photo"}
          <span className="ml-2 font-normal text-white/60">
            {index + 1} of {photos.length}
          </span>
        </p>
        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              type="button"
              disabled={busy}
              aria-label="Delete photo"
              onClick={async () => {
                if (!window.confirm("Delete this photo?")) return;
                setBusy(true);
                try {
                  await deleteCarPhoto(photo);
                  onChanged?.();
                  toast.success("Photo deleted");
                } catch (error) {
                  toast.error((error as Error).message || "Could not delete photo");
                } finally {
                  setBusy(false);
                }
              }}
              className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white disabled:opacity-50"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 px-2" onClick={(e) => e.stopPropagation()}>
        {photos.length > 1 && (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => move(-1)}
            disabled={index === 0}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <figure className="min-w-0 flex-1 text-center">
          {url ? (
            <img src={url} alt="Car photo" className="mx-auto max-h-[70vh] w-full rounded-2xl object-contain" />
          ) : (
            <div className="mx-auto grid h-64 place-items-center text-sm text-white/60">Loading photo…</div>
          )}
          <figcaption className="mt-3 text-xs text-white/70">
            {[who, format(new Date(photo.created_at), "MMM d, yyyy · h:mm a")].filter(Boolean).join(" · ")}
          </figcaption>
        </figure>
        {photos.length > 1 && (
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => move(1)}
            disabled={index === photos.length - 1}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
      <div className="pb-[calc(1rem+env(safe-area-inset-bottom))]" />
    </div>
  );
}
