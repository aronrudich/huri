import type { ButtonHTMLAttributes } from "react";
import { parseServiceHours, formatClock } from "@/lib/company-configuration";

export function ArrivalActionButton({ className = "", muted = false, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { muted?: boolean }) {
  return <button {...props} className={`flex w-full items-center justify-center gap-2 font-semibold disabled:cursor-not-allowed ${muted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground disabled:opacity-60"} ${className}`} />;
}

export function ArrivalHoursNotice({ spanish = false, hours }: { spanish?: boolean; hours?: unknown }) {
  const schedule = parseServiceHours(hours);
  const labels = spanish ? ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return (
    <div role="status" aria-live="polite" className="mt-5 text-center text-sm">
      <p className="font-semibold text-foreground">{spanish ? "Lo sentimos. El departamento de servicio está cerrado a esa hora." : "We are sorry. The service department is closed at that time."}</p>
      <ul className="mt-3 space-y-1 text-muted-foreground">
        {schedule.map((day, index) => <li key={index}>{labels[index]}: {day ? `${formatClock(day.open)} – ${formatClock(day.close)}` : spanish ? "Cerrado" : "Closed"}</li>)}
      </ul>
    </div>
  );
}