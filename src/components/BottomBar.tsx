import { Link } from "@tanstack/react-router";
import { Inbox, Car, List, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
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
      <img src={huriLogo.url} alt="Huri" className="h-7 w-auto" />
    </Link>
  );
}

/** Park + Pickup buttons shown in the top-right corner of every authenticated page. Techs also see Parts. */
export function TopActions() {
  const { profile } = useAuth();
  const isTech = profile?.role_name === "Technician";
  return (
    <div className="flex items-center gap-2">
      {isTech && (
        <Link
          to="/parts"
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Parts
        </Link>
      )}
      <Link
        to="/park"
        className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        Park
      </Link>
      <Link
        to="/pickup-new"
        className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        Pickup
      </Link>
    </div>
  );
}
