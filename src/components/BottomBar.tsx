import { Link } from "@tanstack/react-router";
import { Inbox, Car, List, User } from "lucide-react";

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
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-background/95 backdrop-blur safe-bottom">
      {item("inbox", "/", <Inbox className="h-6 w-6" />, "Inbox")}
      {item("pickup", "/pickup", <Car className="h-6 w-6" />, "Pickup")}
      {item("lot", "/lot", <List className="h-6 w-6" />, "Lot")}
      {item("profile", "/profile", <User className="h-6 w-6" />, "Profile")}
    </nav>
  );
}

/** Shared "Huri" wordmark used in every page header's top-left corner. */
export function HuriLogo() {
  return (
    <Link to="/" aria-label="Huri home" className="select-none text-xl font-bold tracking-tight text-primary">
      Huri
    </Link>
  );
}

/** Park + Pickup buttons shown in the top-right corner of every authenticated page. */
export function TopActions() {
  return (
    <div className="flex items-center gap-2">
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
