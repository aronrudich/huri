import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { isValidSpot } from "@/lib/lot";

type ParkSearch = { tag?: string };

export const Route = createFileRoute("/park")({
  head: () => ({ meta: [{ title: "Park a Car · Huri" }] }),
  validateSearch: (s: Record<string, unknown>): ParkSearch => ({
    tag: typeof s.tag === "string" ? s.tag : undefined,
  }),
  component: ParkPage,
});

function ParkPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { tag: tagParam } = Route.useSearch();
  const [tag, setTag] = useState(tagParam ?? "");
  const [ro, setRo] = useState("");
  const [model, setModel] = useState("");
  const [pos, setPos] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);

  // Prefill from existing car if tag passed
  useEffect(() => {
    if (!tagParam) return;
    supabase.from("parked_cars").select("*").eq("tag_number", tagParam).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setEditing(true);
        setTag(data.tag_number);
        setRo(data.ro_number ?? "");
        setModel(data.car_model ?? "");
        setPos(data.lot_position === "UNKNOWN" ? "" : data.lot_position);
        setNotes(data.notes ?? "");
      });
  }, [tagParam]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag.trim()) return toast.error("Tag # is required");
    const cleanPos = pos.trim();
    if (cleanPos && !isValidSpot(cleanPos)) return toast.error("Spot must be a number 1–147");
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("parked_cars").upsert(
      {
        tag_number: tag.trim(),
        ro_number: ro.trim() || null,
        car_model: model.trim() || null,
        lot_position: cleanPos || "UNKNOWN",
        notes: notes.trim() || null,
        parked_by: user.id,
      },
      { onConflict: "tag_number" },
    );
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Car updated" : "Car logged");
    navigate({ to: "/pickup", replace: true });
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/pickup" className="grid h-8 w-8 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-center text-base font-semibold">{editing ? "Edit Car" : "Park a Car"}</h1>
        <div className="w-8" />
      </header>

      <form onSubmit={submit} className="space-y-3 p-4">
        <Field label="Tag Number" value={tag} onChange={setTag} required />
        <Field label="RO Number" value={ro} onChange={setRo} />
        <Field label="Car Model" value={model} onChange={setModel} />
        <Field label="Spot Number (1–147)" value={pos} onChange={setPos} placeholder="Leave blank if unknown" />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes (battery dead, key fob broken, …)</label>
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : editing ? "Save Changes" : "Log Vehicle"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, required, placeholder }:
  { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
    </div>
  );
}
