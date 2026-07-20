import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/auth-context";
import { toast } from "sonner";
import { normalizePhone, formatPhone } from "@/lib/phone";

type Props = {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
};

export function EditProfileSheet({ profile, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<"info" | "password">("info");
  const [busy, setBusy] = useState(false);

  // info
  const [fullName, setFullName] = useState(profile.full_name);
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [phone, setPhone] = useState(profile.phone_number ?? "");

  // password
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const saveInfo = async () => {
    if (!fullName.trim()) return toast.error("Name is required");
    let phoneToSave: string | null = null;
    if (phone.trim()) {
      const normalized = normalizePhone(phone);
      if (!normalized) return toast.error("Enter a valid phone number");
      phoneToSave = normalized;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        nickname: nickname.trim() || null,
        phone_number: phoneToSave,
      })
      .eq("id", profile.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
    onClose();
  };

  const savePassword = async () => {
    if (newPass.length < 8) return toast.error("Password must be 8+ characters");
    if (newPass !== confirmPass) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[100dvh] w-full max-w-md flex-col rounded-t-3xl bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[85dvh] sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-lg font-semibold">Edit profile</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 flex shrink-0 gap-1 rounded-xl bg-muted p-1 text-sm">
          {(["info", "password"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 font-medium capitalize ${tab === t ? "bg-background shadow" : "text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "info" && (
            <div className="space-y-3">
              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
              </Field>
              <Field label="Nickname">
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="input" />
              </Field>
              <Field label="Phone number">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 555-1234"
                  className="input"
                />
              </Field>
              {phone.trim() && normalizePhone(phone) && (
                <p className="-mt-1 text-xs text-muted-foreground">
                  Saved as {formatPhone(normalizePhone(phone))}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                To change your role, close this and tap "Request role change" — the owner has to approve it.
              </p>
              <PrimaryBtn busy={busy} onClick={saveInfo}>Save changes</PrimaryBtn>
            </div>
          )}

          {tab === "password" && (
            <div className="space-y-3">
              <Field label="New password">
                <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="input" autoComplete="new-password" />
              </Field>
              <Field label="Confirm new password">
                <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} className="input" autoComplete="new-password" />
              </Field>
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              <PrimaryBtn busy={busy} onClick={savePassword}>Update password</PrimaryBtn>
            </div>
          )}
        </div>
      </div>
      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:0.6rem 0.85rem;font-size:0.95rem;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PrimaryBtn({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="mt-2 w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
    >
      {busy ? "Saving..." : children}
    </button>
  );
}
