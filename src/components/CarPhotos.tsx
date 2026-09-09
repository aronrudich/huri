import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { carPhotosQuery, markPhotosSeen, uploadCarPhoto, useSignedPhotoUrls } from "@/lib/car-photos";
import { PhotoViewer } from "@/components/PhotoViewer";

/**
 * "Photos" section on the car info page — sits next to Notes. Anyone who can
 * change a car (everyone except spectators) can snap or attach photos here.
 */
export function CarPhotos({ ro, userId, canEdit }: { ro: string; userId?: string | null; canEdit: boolean }) {
  const target = ro.trim();
  const qc = useQueryClient();
  const { data: photos = [] } = useQuery(carPhotosQuery(target));
  const { data: urls } = useSignedPhotoUrls(photos.map((p) => p.storage_path));
  const [busy, setBusy] = useState(false);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["car-photos"] });
    void qc.invalidateQueries({ queryKey: ["car-photo-index"] });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!target) return toast.error("Add the RO # before attaching a photo");
    if (!userId) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        await uploadCarPhoto(file, target, userId);
      }
      refresh();
      toast.success(files.length > 1 ? "Photos attached" : "Photo attached");
    } catch (error) {
      toast.error((error as Error).message || "Could not attach photo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Photos</label>

      {photos.length > 0 && (
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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Camera className="h-4 w-4" /> {busy ? "Uploading…" : "Take Photo"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-3 text-base font-semibold text-foreground active:bg-accent disabled:opacity-60"
          >
            <ImagePlus className="h-4 w-4" /> Choose Photo
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
