import { useRef, useState } from "react";
import { X, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/auth-context";
import { toast } from "sonner";
import { useSuspended } from "@/lib/suspension";

type Props = {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
};

/** Downscale a picked photo to a small square JPEG data URL so it can live on the profile row. */
async function toAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function EditProfileSheet({ profile, onClose, onSaved }: Props) {
  const suspended = useSuspended();
  const [tab, setTab] = useState<"info" | "password">("info");
  const [busy, setBusy] = useState(false);

  // info
  const [fullName, setFullName] = useState(profile.full_name);
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [avatar, setAvatar] = useState<string | null>(profile.avatar_url ?? null);
  const fileRef = useRef<HTMLInputElement>(null);

  // password
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Pick an image file");
    try {
      setBusy(true);
      setAvatar(await toAvatarDataUrl(file));
      toast.success("Photo ready — tap Save changes");
    } catch {
      toast.error("Couldn't read that photo");
    } finally {
      setBusy(false);
    }
  };

  const saveInfo = async () => {
    if (!fullName.trim()) return toast.error("Name is required");
    if (suspended) { toast.success("Profile updated"); onClose(); return; }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        nickname: nickname.trim() || null,
        avatar_url: avatar,
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
    if (suspended) { toast.success("Password updated"); onClose(); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPass });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-3xl bg-background p-5 shadow-2xl"
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
              <div className="flex items-center gap-3 pb-1">
                <div className="relative">
                  {avatar ? (
                    <img src={avatar} alt="Profile photo" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
                      {(nickname || fullName || "?")[0]?.toUpperCase()}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow"
                    aria-label="Add profile photo"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    {avatar ? "Change photo" : "Add profile photo"}
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar(null)}
                      className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/heic,image/webp"
                  className="hidden"
                  onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }}
                />
              </div>

              <Field label="Full name">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
              </Field>
              <Field label="Nickname">
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="input" />
              </Field>
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
