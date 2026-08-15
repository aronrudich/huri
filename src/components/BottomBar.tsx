import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Inbox, Car, List, User, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { actionsForRole, type ActionId } from "@/lib/roles";
import huriLogo from "@/assets/huri-logo.png.asset.json";

export function BottomBar({ active }: { active: "inbox" | "pickup" | "lot" | "profile" }) {
  const item = (key: string, to: string, icon: React.ReactNode, label: string) => (
    <Link
      to={to}
      aria-label={label}
      className={`flex flex-1 items-center justify-center py-3 ${
        active === key ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
    </Link>
  );
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-background/95 backdrop-blur safe-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {item("inbox", "/", <Inbox className="h-6 w-6" />, "Inbox")}
      {item("pickup", "/pickup", <Car className="h-6 w-6" />, "Pickup")}
      {item("lot", "/lot", <List className="h-6 w-6" />, "Lot")}
      {item("profile", "/profile", <User className="h-6 w-6" />, "Profile")}
    </nav>
  );
}

/** Shared Huri wordmark used in every page header's top-left corner. */
export function HuriLogo() {
  return (
    <Link to="/" aria-label="Huri home" className="flex select-none items-center">
      <img src={huriLogo.url} alt="Huri" className="h-12 w-auto" />
    </Link>
  );
}

/**
 * Role-based action menu in every authenticated header.
 * Valet-type roles get a single "New" button; Shuttle gets nothing.
 */
export function TopActions({ hideStage }: { hideStage?: boolean } = {}) {
  const { profile } = useAuth();
  const role = profile?.role_name ?? "";
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const items: ActionId[] = actionsForRole(role).filter((id) => !(id === "stage" && hideStage));
  if (items.length === 0) return null;

  const LABELS: Record<ActionId, string> = {
    pickup: "Pickup",
    new: "Add Car to Huri",
    stage: "Stage",
    parts: "Parts",
    shuttle: "Shuttle",
    park: "Park My Car",
    bringme: "Bring Me",
  };

  // Short plain-English description shown under each action label.
  const HINTS: Record<ActionId, string> = {
    pickup: "Bring Me A Car",
    new: "Log Car Into Huri",
    stage: "Bring Car To CP",
    parts: "Bring Me Parts",
    shuttle: "Pickup/Dropoff Customer",
    park: "Park Car For Me",
    bringme: "Bring Me A Car Or Parts",
  };

  const linkProps = (id: ActionId): { to: string; search?: Record<string, unknown> } => {
    switch (id) {
      case "pickup": return { to: "/pickup-new" };
      case "stage": return { to: "/pickup-new", search: { staged: true } };
      case "new": return { to: "/park" };
      case "parts": return { to: "/parts" };
      case "shuttle": return { to: "/shuttle" };
      case "park": return { to: "/park-request" };
      case "bringme": return { to: "/bring-me" };
      default: return { to: "/pickup" };
    }
  };

  // Single-action roles (valets) skip the dropdown entirely.
  if (items.length === 1) {
    const only = items[0]!;
    const props = linkProps(only);
    return (
      <Link
        to={props.to}
        search={props.search as never}
        className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground md:px-6 md:py-3 md:text-base"
      >
        {LABELS[only]}
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Actions"
        onClick={() => setOpen((cur) => !cur)}
        className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground md:gap-2 md:px-7 md:py-3.5 md:text-lg"
      >
        Actions
        <ChevronDown className={`h-4 w-4 transition-transform md:h-5 md:w-5 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-popover shadow-lg md:w-64">
          {items.map((id) => {
            const props = linkProps(id);
            return (
              <Link
                key={id}
                to={props.to}
                search={props.search as never}
                onClick={() => setOpen(false)}
                className="block border-b border-border px-4 py-2.5 last:border-b-0 active:bg-accent"
              >
                <span className="block text-sm font-semibold leading-tight md:text-base">{LABELS[id]}</span>
                <span className="block whitespace-nowrap text-[11px] leading-tight text-muted-foreground md:text-xs">
                  {HINTS[id]}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

