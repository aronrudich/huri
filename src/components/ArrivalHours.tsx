import type { ButtonHTMLAttributes } from "react";

export function ArrivalActionButton({ className = "", muted = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { muted?: boolean }) {
  return <button {...props} className={`flex w-full items-center justify-center gap-2 font-semibold disabled:cursor-not-allowed ${muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground disabled:opacity-60"} ${className}`} />;
}

export function ArrivalHoursNotice({ spanish = false }: { spanish?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="mt-5 text-center text-sm">
      <p className="font-semibold text-foreground">{spanish ? "Lo sentimos. El departamento de servicio está cerrado a esa hora." : "We are sorry. The service department is closed at that time."}</p>
      <ul className="mt-3 space-y-1 text-muted-foreground">
        <li>{spanish ? "Lunes – Viernes" : "Monday – Friday"}: 6:30 AM – 6:00 PM</li>
        <li>{spanish ? "Sábado" : "Saturday"}: 8:00 AM – 4:00 PM</li>
        <li>{spanish ? "Domingo: Cerrado" : "Sunday: Closed"}</li>
      </ul>
    </div>
  );
}