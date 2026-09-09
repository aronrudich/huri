import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { carPhotosQuery, markPhotosSeen, uploadCarPhoto, useSignedPhotoUrls } from "@/lib/car-photos";
import { PhotoViewer } from "@/components/PhotoViewer";

/**
 * "Photos" section on the car info page — sits next to Notes. Anyone who can
 * change a car (everyone except spectators) can snap photos here. Photos are
 * always taken live with the camera; there is no library option on purpose.
 *
 * When there is no RO # yet (logging a brand new car), photos are held in
 * `pendingRef` and the page attaches them right after the car is saved.
 */
export function CarPhotos({
  ro,
  userId,
  canEdit,
  pendingRef,
}: {
  ro: string;
  userId?: string | null;
  canEdit: boolean;
  pendingRef?: React.MutableRefObject<File[]>;
}) {
  const target = ro.trim();
  const hasRo = /^\d{6}$/.test(target);
  const qc = useQueryClient();
  const { data: photos = [] } = useQuery(carPhotosQuery(hasRo ? target : ""));
  const { data: urls } = useSignedPhotoUrls(photos.map((p) => p.storage_path));
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ file: File; url: string }[]>([]);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingRef) pendingRef.current = pending.map((p) => p.file);
  }, [pending, pendingRef]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["car-photos"] });
    void qc.invalidateQueries({ queryKey: ["car-photo-index"] });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    if (!userId) return;
    // No RO # yet: hold the photo until the car is saved.
    if (!hasRo) {
      setPending((prev) => [...prev, ...list.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
      return;
    }
    setBusy(true);
    try {
      for (const file of list) {
        await uploadCarPhoto(file, target, userId);
      }
      refresh();
      toast.success(list.length > 1 ? "Photos attached" : "Photo attached");
    } catch (error) {
      toast.error((error as Error).message || "Could not attach photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Photos</label>

      {(photos.length > 0 || pending.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { markPhotosSeen(photos); setViewerAt(i); }}
              className="h-20 w-20 overflow-hidden rounded-xl ring-2 ring-warning"
              aria-label="Open photo full screen"
            >
              {urls?.[p.storage_path] ? (
                <img src={urls[p.storage_path]} alt="Car photo" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-warning/15 text-warning">
                  <Camera className="h-5 w-5" />
                </span>
              )}
            </button>
          ))}
          {pending.map((p, i) => (
            <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-xl ring-2 ring-warning">
              <img src={p.url} alt="Photo waiting to attach" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => {
                  URL.revokeObjectURL(p.url);
                  setPending((prev) => prev.filter((_, idx) => idx !== i));
                }}
                className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-bl-lg bg-foreground/70 text-background"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {canEdit ? (
        <div className="flex gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Camera className="h-4 w-4" /> {busy ? "Uploading…" : "Add Photo"}
          </button>
        </div>
      ) : (
        photos.length === 0 && <p className="text-sm text-muted-foreground">No photos attached.</p>
      )}

      {viewerAt !== null && (
        <PhotoViewer
          photos={photos}
          startIndex={viewerAt}
          ro={target}
          canDelete={canEdit}
          onChanged={refresh}
          onClose={() => setViewerAt(null)}
        />
      )}
    </div>
  );
}
