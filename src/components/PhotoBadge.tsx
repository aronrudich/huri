import { useState } from "react";
import { Camera } from "lucide-react";
import { type CarPhoto, hasUnseenPhotos, markPhotosSeen, useSignedPhotoUrls } from "@/lib/car-photos";
import { PhotoViewer } from "@/components/PhotoViewer";

/**
 * Small photo thumbnail with a bright glowing ring, shown anywhere a car
 * appears. It pulses until this person has opened the photos once, so an
 * important picture is impossible to miss without strobing forever.
 */
export function PhotoBadge({
  photos,
  ro,
  canDelete,
  onChanged,
  size = 44,
}: {
  photos: CarPhoto[];
  ro?: string | null;
  canDelete?: boolean;
  onChanged?: () => void;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(() => hasUnseenPhotos(photos));
  const first = photos[0];
  const { data: urls } = useSignedPhotoUrls(first ? [first.storage_path] : []);
  if (!first) return null;
  const thumb = urls?.[first.storage_path];

  return (
    <>
      <button
        type="button"
        aria-label={`View ${photos.length} photo${photos.length === 1 ? "" : "s"} attached to this car`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          markPhotosSeen(photos);
          setUnseen(false);
          setOpen(true);
        }}
        style={{ width: size, height: size }}
        className={`relative shrink-0 overflow-hidden rounded-xl ring-2 ring-warning ring-offset-2 ring-offset-background ${
          unseen ? "photo-alert" : "shadow-[0_0_0_1px_hsl(var(--warning))]"
        }`}
      >
        {thumb ? (
          <img src={thumb} alt="Attached car photo" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-warning/20 text-warning">
            <Camera className="h-5 w-5" />
          </span>
        )}
        {photos.length > 1 && (
          <span className="absolute bottom-0 right-0 rounded-tl-md bg-warning px-1 text-[10px] font-bold text-warning-foreground">
            {photos.length}
          </span>
        )}
      </button>

      {open && (
        <PhotoViewer
          photos={photos}
          ro={ro}
          canDelete={canDelete}
          onChanged={onChanged}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
