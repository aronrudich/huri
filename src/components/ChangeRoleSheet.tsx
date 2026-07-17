import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { setEmployeeRole } from "@/lib/admin.functions";
import { toast } from "sonner";

type Props = {
  employeeId: string;
  employeeName: string;
  currentRole: string;
  onClose: () => void;
  onSaved: (newRole: string) => void;
};

const FALLBACK = ["Advisor", "Technician", "Valet", "Valet & Parts", "Manager", "Director", "General Manager"];

export function ChangeRoleSheet({ employeeId, employeeName, currentRole, onClose, onSaved }: Props) {
  const [roles, setRoles] = useState<string[]>(FALLBACK);
  const [selected, setSelected] = useState(currentRole);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("roles").select("name").order("created_at", { ascending: true }).then(({ data }) => {
      if (data && data.length) {
        const names = Array.from(new Set([...data.map((r) => r.name as string), currentRole]));
        setRoles(names);
      }
    });
  }, [currentRole]);

  const setRole = useServerFn(setEmployeeRole);

  const save = async () => {
    if (selected === currentRole) return onClose();
    setBusy(true);
    try {
      await setRole({ data: { userId: employeeId, newRole: selected } });
      toast.success(`${employeeName} is now ${selected}`);
      onSaved(selected);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Change role</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">{employeeName} — currently <span className="font-medium text-foreground">{currentRole}</span></p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {roles.map((r) => (
            <button
              key={r}
              onClick={() => setSelected(r)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${selected === r ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}
            >
              <span>{r}</span>
              {selected === r && <span className="text-primary">✓</span>}
            </button>
          ))}
        </div>
        <button onClick={save} disabled={busy} className="mt-4 w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Saving..." : "Save role"}
        </button>
      </div>
    </div>
  );
}
