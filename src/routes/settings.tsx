import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Settings as SettingsIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { canViewSettings } from "@/lib/roles";
import { Switch } from "@/components/ui/switch";
import {
  dealershipSettingsQuery,
  SETTINGS_LIMITS,
  TIMEZONE_OPTIONS,
  type DealershipSettings,
} from "@/lib/settings";
import { customerArrivalTemplate } from "@/lib/arrive-link";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Company Settings · Huri" },
      {
        name: "description",
        content: "Set your company's Huri parameters: inactive-car days, reminder minutes and pickup list timing.",
      },
      { property: "og:title", content: "Company Settings · Huri" },
      { property: "og:description", content: "Upper management controls for your company's Huri parameters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

type Draft = {
  flagged_days: string;
  reminder_minutes: string;
  claim_hide_minutes: string;
  timezone: string;
  enable_wash: boolean;
  enable_parts: boolean;
  enable_staging: boolean;
};

const toDraft = (s: DealershipSettings): Draft => ({
  flagged_days: String(s.flagged_days),
  reminder_minutes: String(s.reminder_minutes),
  claim_hide_minutes: String(s.claim_hide_minutes),
  timezone: s.timezone,
  enable_wash: s.enable_wash,
  enable_parts: s.enable_parts,
  enable_staging: s.enable_staging,
});

function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const allowed = canViewSettings(profile?.role_name, profile?.is_owner);

  const { data: settings } = useQuery(dealershipSettingsQuery(profile?.dealership_id));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && user && profile && !allowed) navigate({ to: "/pickup", replace: true });
  }, [allowed, profile, user, loading, navigate]);

  useEffect(() => {
    if (settings && !draft) setDraft(toDraft(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const copyCode = async () => {
    if (!settings?.company_code) return;
    try {
      await navigator.clipboard.writeText(settings.company_code);
      toast.success("Company code copied");
    } catch {
      toast.message(settings.company_code);
    }
  };

  const copyTemplate = async () => {
    if (!settings?.slug) return;
    const template = customerArrivalTemplate(settings.slug);
    try {
      await navigator.clipboard.writeText(template);
      toast.success("Customer link copied");
    } catch {
      toast.message(template);
    }
  };

  const save = async () => {
    if (!draft || !settings) return;
    const nums: Array<[keyof typeof SETTINGS_LIMITS, string, string]> = [
      ["flagged_days", draft.flagged_days, "Days before a car is flagged"],
      ["reminder_minutes", draft.reminder_minutes, "Reminder minutes"],
      ["claim_hide_minutes", draft.claim_hide_minutes, "Minutes a claimed car stays on the list"],
    ];
    const parsed: Record<string, number> = {};
    for (const [key, raw, label] of nums) {
      const value = Number(raw);
      const { min, max } = SETTINGS_LIMITS[key];
      if (!Number.isInteger(value) || value < min || value > max) {
        return toast.error(`${label}: enter a whole number between ${min} and ${max}`);
      }
      parsed[key] = value;
    }

    setSaving(true);
    const { error } = await supabase
      .from("dealerships")
      .update({
        flagged_days: parsed.flagged_days,
        reminder_minutes: parsed.reminder_minutes,
        claim_hide_minutes: parsed.claim_hide_minutes,
        timezone: draft.timezone,
        enable_wash: draft.enable_wash,
        enable_parts: draft.enable_parts,
        enable_staging: draft.enable_staging,
      })
      .eq("id", settings.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["dealership-settings"] });
    toast.success("Settings saved");
  };

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top safe-bottom">
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Link to="/pickup" className="grid h-9 w-9 place-items-center rounded-full text-primary">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <HuriLogo />
        <div className="flex-1" />
        <TopActions />
      </header>

      <div className="px-4 pb-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <SettingsIcon className="h-5 w-5 text-primary" />
          Company Settings
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {settings?.name ? `${settings.name} · ` : ""}Only upper management can open this screen.
        </p>
      </div>

      {settings && draft ? (
        <>
          <section className="mx-3 mt-3 overflow-hidden rounded-2xl bg-background">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Company code
                </p>
                <p className="mt-1 font-mono text-lg font-bold tracking-[0.2em]">{settings.company_code}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  New employees type this when they create their account.
                </p>
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Customer arrival link
                </p>
                <p className="mt-1 break-all font-mono text-xs font-semibold">
                  {customerArrivalTemplate(settings.slug)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Paste this once into your "Vehicle Ready" text template. The RO # fills in
                  automatically and customers never see your company code.
                </p>
              </div>
              <button
                onClick={copyTemplate}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </section>

          <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
            <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Timing
            </p>
            <NumberRow
              label="Flagged Cars list"
              hint="Days a car sits untouched before it lands on the Flagged Cars list."
              unit="days"
              value={draft.flagged_days}
              onChange={(v) => setDraft({ ...draft, flagged_days: v })}
            />
            <NumberRow
              label="Unclaimed reminder"
              hint="Minutes before valets get a reminder about an unclaimed request. 0 turns it off."
              unit="min"
              value={draft.reminder_minutes}
              onChange={(v) => setDraft({ ...draft, reminder_minutes: v })}
            />
            <NumberRow
              label="Claimed car clears the list"
              hint="Minutes a claimed request stays on the pickup list before it disappears."
              unit="min"
              value={draft.claim_hide_minutes}
              onChange={(v) => setDraft({ ...draft, claim_hide_minutes: v })}
            />
            <div className="border-t border-border px-4 py-3">
              <p className="text-sm font-medium">Time zone</p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Used for the morning list and the hour-by-hour reports.
              </p>
              <select
                value={draft.timezone}
                onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base"
              >
                {TIMEZONE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
            <p className="px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Departments
            </p>
            <ToggleRow
              label="Car Wash"
              hint="Turn off if your store doesn't run washes through Huri."
              checked={draft.enable_wash}
              onChange={(v) => setDraft({ ...draft, enable_wash: v })}
            />
            <ToggleRow
              label="Parts"
              hint="Turn off to remove parts requests from the Actions menu."
              checked={draft.enable_parts}
              onChange={(v) => setDraft({ ...draft, enable_parts: v })}
            />
            <ToggleRow
              label="Staged cars"
              hint="Turn off to remove staging from the Actions menu."
              checked={draft.enable_staging}
              onChange={(v) => setDraft({ ...draft, enable_staging: v })}
            />
          </section>

          <div className="mx-3 mt-5">
            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading settings…</p>
      )}

      <BottomBar active="profile" />
    </div>
  );
}

function NumberRow({
  label,
  hint,
  unit,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          className="w-16 rounded-xl border border-input bg-background px-2 py-2 text-center text-base outline-none focus:border-primary"
        />
        <span className="w-8 text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
