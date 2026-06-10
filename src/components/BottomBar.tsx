import { Link } from "@tanstack/react-router";
import { Inbox, Car, User } from "lucide-react";

export function BottomBar({ active }: { active: "inbox" | "pickup" | "profile" }) {
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
      {item("profile", "/profile", <User className="h-6 w-6" />, "Profile")}
    </nav>
  );
}
