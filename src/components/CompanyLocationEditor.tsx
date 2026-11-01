import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { sendHelpMessage } from "@/lib/help.functions";
import { describeLotLabels, LABEL_TYPE_OPTIONS, validateLot, type CompanyLot, type LabelType } from "@/lib/company-lots";

type Form = Omit<CompanyLot, "id" | "dealership_id">;
const EMPTY: Form = { lot_name: "", label_type: "numbers", prefix: "", range_start: "", range_end: "", has_blocking: false, blocking_explanation: "" };
const input = "w-full rounded-lg border border-input bg-background p-2 text-base";

export function CompanyLocationEditor({ companyId, companyName, companyCode }: { companyId: string; companyName: string; companyCode: string }) {
  const queryClient = useQueryClient();
  const { data: lots = [] } = useQuery({
    queryKey: ["company-lots", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_lots").select("*").eq("dealership_id", companyId).order("lot_name").order("id");
      if (error) throw error;
      return data as CompanyLot[];
    },
  });
  const [form, setForm] = useState<Form>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setForm((f) => ({ ...f, ...p }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["company-lots", companyId] });

  const save = async () => {
    const err = validateLot(form);
    if (err) return toast.error(err);
    const ranged = form.label_type !== "none";
    const row = {
      dealership_id: companyId,
      lot_name: form.lot_name.trim(),
      label_type: form.label_type,
      prefix: form.label_type === "letters_numbers" ? (form.prefix ?? "").trim() : null,
      range_start: ranged ? (form.range_start ?? "").trim().toUpperCase() : null,
      range_end: ranged ? (form.range_end ?? "").trim().toUpperCase() : null,
      has_blocking: form.has_blocking,
      blocking_explanation: form.has_blocking ? (form.blocking_explanation ?? "").trim() : null,
      updated_at: new Date().toISOString(),
    };
    setBusy(true);
    const { error } = editId
      ? await supabase.from("company_lots").update(row).eq("id", editId)
      : await supabase.from("company_lots").insert(row);
    if (error) { setBusy(false); return toast.error(error.message); }
    if (row.has_blocking) {
      try {
        await sendHelpMessage({ data: { attachments: [], body:
          `Blocking lot setup request\nDealership: ${companyName}\nCompany code: ${companyCode}\nLot: ${row.lot_name}\nSpots: ${describeLotLabels(row)}\nHow cars get blocked: ${row.blocking_explanation}` } });
      } catch { toast.error("Saved, but Huri Support couldn't be notified. Please message Support."); }
    }
    setBusy(false);
    await refresh();
    toast.success(row.has_blocking ? "Location saved — Huri will set up your blocking" : "Location saved");
    setForm(EMPTY); setEditId(null);
  };

  const remove = async (l: CompanyLot) => {
    if (!window.confirm(`Delete "${l.lot_name}"?`)) return;
    const { error } = await supabase.from("company_lots").delete().eq("id", l.id);
    if (error) return toast.error(error.message);
    if (editId === l.id) { setEditId(null); setForm(EMPTY); }
    await refresh();
    toast.success("Location deleted");
  };

  const ranged = form.label_type !== "none";
  const isLetters = form.label_type === "letters";
  return <section className="mb-5 space-y-3 border-t border-border pt-4">
    <h2 className="text-sm font-semibold">Parking locations</h2>
    {lots.length === 0 ? <p className="text-sm text-muted-foreground">No locations added yet.</p> :
      <ul className="space-y-2">{lots.map((l) => <li key={l.id} className="flex items-center gap-2 rounded-xl border border-border bg-background p-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{l.lot_name}</p>
          <p className="text-xs text-muted-foreground">{describeLotLabels(l)} · {l.has_blocking ? "Has blocking" : "No blocking"}</p>
        </div>
        <button type="button" aria-label={`Edit ${l.lot_name}`} className="grid h-9 w-9 place-items-center rounded-lg text-primary hover:bg-primary/10"
          onClick={() => { setEditId(l.id); setForm({ ...l, prefix: l.prefix ?? "", range_start: l.range_start ?? "", range_end: l.range_end ?? "", blocking_explanation: l.blocking_explanation ?? "" }); }}>
          <Pencil className="h-4 w-4" /></button>
        <button type="button" aria-label={`Delete ${l.lot_name}`} className="grid h-9 w-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10" onClick={() => remove(l)}>
          <Trash2 className="h-4 w-4" /></button>
      </li>)}</ul>}

    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <p className="text-sm font-semibold">{editId ? "Edit Location" : "Add Location"}</p>
      <label className="block text-sm">Lot name
        <input className={input} placeholder="Ex. Back Lot" maxLength={120} value={form.lot_name} onChange={(e) => set({ lot_name: e.target.value })} /></label>
      <label className="block text-sm">Label
        <select className={input} value={form.label_type} onChange={(e) => set({ label_type: e.target.value as LabelType, range_start: "", range_end: "" })}>
          {LABEL_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select></label>
      {form.label_type === "letters_numbers" && <label className="block text-sm">Prefix / letter
        <input className={input} placeholder="Ex. SV or Row A" maxLength={40} value={form.prefix ?? ""} onChange={(e) => set({ prefix: e.target.value })} /></label>}
      {ranged ? <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">{isLetters ? "Starting letter" : "Starting number"}
          <input className={input} inputMode={isLetters ? "text" : "numeric"} maxLength={isLetters ? 1 : 6} placeholder={isLetters ? "A" : "1"} value={form.range_start ?? ""} onChange={(e) => set({ range_start: e.target.value })} /></label>
        <label className="block text-sm">{isLetters ? "Ending letter" : "Ending number"}
          <input className={input} inputMode={isLetters ? "text" : "numeric"} maxLength={isLetters ? 1 : 6} placeholder={isLetters ? "Z" : "125"} value={form.range_end ?? ""} onChange={(e) => set({ range_end: e.target.value })} /></label>
      </div> : <p className="text-xs text-muted-foreground">This lot has no labeled or numbered spots (open lot or shared holding area).</p>}
      <div className="text-sm">
        <p>Is there blocking in this lot?</p>
        <div className="mt-1 flex gap-2">{[true, false].map((v) => <button key={String(v)} type="button" onClick={() => set({ has_blocking: v })}
          className={`flex-1 rounded-lg border px-3 py-2 font-medium ${form.has_blocking === v ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}>{v ? "Yes" : "No"}</button>)}</div>
      </div>
      {form.has_blocking && <label className="block text-sm">Explain how cars get blocked
        <textarea className={input} rows={3} maxLength={2000} required placeholder="Ex. Cars in spots 1-20 block spots 21-40" value={form.blocking_explanation ?? ""} onChange={(e) => set({ blocking_explanation: e.target.value })} /></label>}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={save}>{busy ? "Saving…" : editId ? "Save changes" : "Add location"}</Button>
        {editId && <Button className="bg-muted text-foreground" onClick={() => { setEditId(null); setForm(EMPTY); }}>Cancel</Button>}
      </div>
    </div>
  </section>;
}
