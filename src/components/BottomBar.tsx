import { Link } from "@tanstack/react-router";
import { Inbox, Car, User, MapPin } from "lucide-react";

export function BottomBar({ active }: { active: "inbox" | "pickup" | "lot" }) {
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
      {item("lot", "/lot", <MapPin className="h-6 w-6" />, "Lot")}
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

/** Top-right profile button, shown on every main tab header. */
export function ProfileLink() {
  return (
    <Link
      to="/profile"
      aria-label="Profile"
      className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary active:scale-95"
    >
      <User className="h-5 w-5" />
    </Link>
  );
}
