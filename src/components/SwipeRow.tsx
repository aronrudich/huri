import { useRef, useState, type ReactNode, type PointerEvent } from "react";
import { Trash2 } from "lucide-react";

type Props = {
  children: ReactNode;
  onDelete: () => void;
};

const REVEAL = 88; // px width of delete action
const THRESHOLD = 44;

export function SwipeRow({ children, onDelete }: Props) {
  const [dx, setDx] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const locked = useRef<"h" | "v" | null>(null);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    locked.current = null;
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (startX.current == null || startY.current == null) return;
    const ddx = e.clientX - startX.current;
    const ddy = e.clientY - startY.current;
    if (!locked.current) {
      if (Math.abs(ddx) < 6 && Math.abs(ddy) < 6) return;
      locked.current = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
    }
    if (locked.current !== "h") return;
    const base = open ? -REVEAL : 0;
    const next = Math.min(0, Math.max(-REVEAL - 20, base + ddx));
    setDx(next);
  };
  const onUp = () => {
    if (locked.current === "h") {
      const shouldOpen = dx < -THRESHOLD;
      setOpen(shouldOpen);
      setDx(shouldOpen ? -REVEAL : 0);
    }
    startX.current = null;
    startY.current = null;
    locked.current = null;
  };

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={onDelete}
        className="absolute inset-y-0 right-0 grid w-[88px] place-items-center bg-destructive text-destructive-foreground"
        aria-label="Delete"
      >
        <span className="flex flex-col items-center gap-1 text-xs font-semibold">
          <Trash2 className="h-5 w-5" />
          Delete
        </span>
      </button>
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ transform: `translate3d(${dx}px,0,0)`, touchAction: "pan-y" }}
        className="relative bg-background transition-transform duration-150 ease-out will-change-transform"
      >
        {children}
      </div>
    </div>
  );
}
