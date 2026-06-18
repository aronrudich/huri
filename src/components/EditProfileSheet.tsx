import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/auth-context";
import { toast } from "sonner";

type Props = {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
};

export function EditProfileSheet({ profile, onClose, onSaved }: Props) {
  const [tab, setTab] = useState<"info" | "email" | "password">("info");
  const [busy, setBusy] = useState(false);

  // info
  const [fullName, setFullName] = useState(profile.full_name);
  const [nickname, setNickname] = useState(profile.nickname ?? "");

  // email
  const [newEmail, setNewEmail] = useState(profile.email);

  // password
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const saveInfo = async () => {
    if (!fullName.trim()) return toast.error("Name is required");
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        nickname: nickname.trim() || null,
      })
      .eq("id", profile.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    onSaved();
    onClose();
  };

  const saveEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email.includes("@")) return toast.error("Enter a valid email");
    if (email === profile.email) return toast.message("That's already your email");
    setBusy(true);
    const { error: authErr } = await supabase.auth.updateUser({ email });
    if (authErr) { setBusy(false); return toast.error(authErr.message); }
    // mirror to profile row (will be re-synced if user confirms)
    await supabase.from("profiles").update({ email }).eq("id", profile.id);
    setBusy(false);
    toast.success("Check your new inbox to confirm the change");
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit profile</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl bg-muted p-1 text-sm">
          {(["info", "email", "password"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 font-medium capitalize ${tab === t ? "bg-background shadow" : "text-muted-foreground"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "info" && (
          <div className="space-y-3">
            <Field label="Full name">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
            </Field>
            <Field label="Nickname">
              <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="input" />
            </Field>
            <p className="text-xs text-muted-foreground">
              To change your role, ask a General Manager.
            </p>
            <PrimaryBtn busy={busy} onClick={saveInfo}>Save changes</PrimaryBtn>
          </div>
        )}

        {tab === "email" && (
          <div className="space-y-3">
            <Field label="New email">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="input"
                inputMode="email"
                autoCapitalize="off"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              We'll send a confirmation link to the new address. The change activates only after you click it.
            </p>
            <PrimaryBtn busy={busy} onClick={saveEmail}>Send confirmation</PrimaryBtn>
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
