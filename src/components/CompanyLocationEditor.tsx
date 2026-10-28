import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { companyLocationsQuery } from "@/lib/company-locations";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function CompanyLocationEditor({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const { data: rules = [] } = useQuery(companyLocationsQuery(companyId));
  const [label,setLabel] = useState("");
  const [lot,setLot] = useState("");
  const [shared,setShared] = useState(false);
  const [blockers,setBlockers] = useState("");
  const [busy,setBusy] = useState(false);
  const save = async () => {
    if(!label.trim() || !lot.trim()) return;
    setBusy(true);
    const {error} = await supabase.from("company_location_rules").upsert({dealership_id:companyId,label:label.trim().toUpperCase(),lot_name:lot.trim(),capacity:shared?0:1,blockers:blockers.split(",").map((s)=>s.trim().toUpperCase()).filter(Boolean)});
    setBusy(false);
    if(error) return toast.error(error.message);
    await queryClient.invalidateQueries({queryKey:["company-locations"]});
    toast.success("Location saved");setLabel("");setBlockers("");
  };
  return <section className="space-y-3 border-t border-border py-4">
    <h2 className="text-sm font-semibold">Parking locations</h2>
    <div className="grid gap-2 sm:grid-cols-2">
      <input aria-label="Lot name" placeholder="Lot name" value={lot} maxLength={120} onChange={(e)=>setLot(e.target.value)} className="rounded-lg border border-input bg-background p-2 text-sm" />
      <input aria-label="Spot label" placeholder="Spot label" value={label} maxLength={60} onChange={(e)=>setLabel(e.target.value)} className="rounded-lg border border-input bg-background p-2 text-sm" />
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shared} onChange={(e)=>setShared(e.target.checked)} />Shared area</label>
    <input aria-label="Blocking spots" placeholder="Blocking spots, separated by commas" value={blockers} onChange={(e)=>setBlockers(e.target.value)} className="w-full rounded-lg border border-input bg-background p-2 text-sm" />
    <Button disabled={busy || !lot.trim() || !label.trim()} onClick={save}>Save location</Button>
    <ul className="text-sm">{rules.map((r)=><li key={r.label} className="flex items-center justify-between gap-3 border-b border-border py-2"><span>{r.lot_name} · {r.label} · {r.capacity===0?"Shared":"One car"}</span><Button className="bg-muted text-foreground" onClick={()=>{setLabel(r.label);setLot(r.lot_name);setShared(r.capacity===0);setBlockers(r.blockers.join(", "));}}>Edit</Button></li>)}</ul>
  </section>;
}