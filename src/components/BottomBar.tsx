import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Car, List, User, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { actionsForRole, type ActionId } from "@/lib/roles";
import { dealershipSettingsQuery } from "@/lib/settings";
import huriLogo from "@/assets/huri-logo-new.png.asset.json";
import { Button } from "@/components/ui/button";
import { carTipKey, shouldShowCarTip } from "@/lib/car-shortcut";

export function BottomBar({ active }: { active: "pickup" | "lot" | "profile" }) {
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
      {item("pickup", "/pickup", <Car className="h-6 w-6" />, "Pickup")}
      {item("lot", "/lot", <List className="h-6 w-6" />, "Lot")}
      {item("profile", "/profile", <User className="h-6 w-6" />, "Profile")}
    </nav>
  );
}

/** Shared Huri wordmark used in every page header's top-left corner. */
export function HuriLogo() {
  return (
    <Link to="/pickup" aria-label="Huri home" className="flex select-none items-center">
      <img src={huriLogo.url} alt="Huri" className="h-[26px] w-auto object-contain" />
    </Link>
  );
}

/**
 * Role-based action menu in every authenticated header.
 * Valet-type roles get a single "New" button.
 */
export function TopActions({ hideStage }: { hideStage?: boolean } = {}) {
  const { profile } = useAuth();
  const role = profile?.role_name ?? "";
  const [open, setOpen] = useState(false);
  const [tipUser, setTipUser] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = profile?.id;
    let dismissed = false;
    try { dismissed = !!id && localStorage.getItem(carTipKey(id)) === "true"; } catch { /* blocked storage */ }
    setTipUser(shouldShowCarTip(role, id, dismissed) && id ? id : null);
  }, [profile?.id, role]);

  const dismissTip = () => {
    if (profile?.id) {
      try { localStorage.setItem(carTipKey(profile.id), "true"); } catch { /* session dismissal still works */ }
    }
    setTipUser(null);
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const { data: settings } = useQuery(dealershipSettingsQuery(profile?.dealership_id));
  const items: ActionId[] = actionsForRole(role, {
    enable_wash: settings?.enable_wash,
    enable_parts: settings?.enable_parts,
    enable_staging: settings?.enable_staging,
    isOwner: profile?.is_owner,
  }).filter((id) => !(id === "stage" && hideStage));
  if (items.length === 0) return null;

  const LABELS: Record<ActionId, string> = {
    pickup: "Pickup",
    new: "Add/Edit Car",
    stage: "Stage",
    parts: "Parts",
    park: "Park My Car",
    bringme: "Bring Me",
    wash: "Wash",
    reports: "Reports",
    flagged: "Flagged Cars",
    settings: "Company Settings",
    help: "Help",
  };

  // Short plain-English description shown under each action label (optional).
  const HINTS: Partial<Record<ActionId, string>> = {
    pickup: "Bring Me A Car",
    stage: "Bring Car To CP",
    parts: "Bring Me Parts",
    bringme: "Car or Parts",
    wash: "Bring Car To Wash",
    reports: "Stats & Claim Times",
    flagged: `Parked ${settings?.flagged_days ?? 14}+ Days`,
    settings: "Timing & Departments",
    help: "Contact Huri Support",
  };


  const linkProps = (id: ActionId): { to: string; search?: Record<string, unknown> } => {
    switch (id) {
      case "pickup": return { to: "/pickup-new" };
      case "stage": return { to: "/pickup-new", search: { staged: true } };
      case "new": return { to: "/park" };
      case "parts": return { to: "/parts" };
      case "park": return { to: "/park-request" };
      case "bringme": return { to: "/bring-me" };
      case "wash": return { to: "/wash" };
      case "reports": return { to: "/reports" };
      case "flagged": return { to: "/flagged" };
      case "settings": return { to: "/settings" };
      case "help": return { to: "/help" };
      default: return { to: "/pickup" };
    }
  };


  return (
    <div ref={rootRef} className="relative flex items-center gap-2 md:gap-3">
      {profile && items.includes("new") && (
        <div className="relative">
          <Link to="/park" aria-label="Update car location" title="Update car location" className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Car className="h-5 w-5" aria-hidden="true" />
          </Link>
          {tipUser === profile.id && (
            <div role="dialog" aria-label="Car location reminder" className="absolute -right-16 top-full z-[60] mt-3 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg">
              <span aria-hidden="true" className="absolute -top-2 right-20 h-3 w-3 rotate-45 border-l border-t border-border bg-popover" />
              <p className="text-sm font-semibold leading-relaxed">If you park a car, press the car button and update the location. Please and thanks.</p>
              <Button onClick={dismissTip} className="mt-3 w-full">Got it</Button>
            </div>
          )}
        </div>
      )}
      <Button
        type="button"
        aria-expanded={open}
        aria-label="Actions"
        onClick={() => setOpen((cur) => !cur)}
        className="flex items-center gap-1 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground md:gap-2 md:px-7 md:py-3.5 md:text-lg"
      >
        Actions
        <ChevronDown className={`h-4 w-4 transition-transform md:h-5 md:w-5 ${open ? "rotate-180" : ""}`} />
      </Button>
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
                {HINTS[id] && (
                  <span className="block whitespace-nowrap text-[11px] leading-tight text-muted-foreground md:text-xs">
                    {HINTS[id]}
                  </span>
                )}

              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

