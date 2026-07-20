import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { confirmEmailForValidCredentials, createConfirmedAccount, resolveEmailForPhone } from "@/lib/auth.functions";
import { notifyOwnerOfPendingSignup } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { subscribePush } from "@/lib/push";
import { toast } from "sonner";
import { normalizePhone, phoneToSyntheticEmail, formatPhone, digitsOnly } from "@/lib/phone";
import huriLogo from "@/assets/huri-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Huri" },
      { name: "description", content: "Sign in or register for Huri." },
    ],
  }),
  component: AuthPage,
});

const DEFAULT_ROLES = [
  "Valet",
  "Valet & Parts",
  "Advisor",
  "Technician",
  "Shop Foreman",
  "Service Manager",
  "Service Director",
  "General Manager",
  "Other",
];
const isEmailNotConfirmed = (message?: string) => /email not confirmed/i.test(message ?? "");
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

type Dealership = { id: string; name: string };

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [useLegacyEmail, setUseLegacyEmail] = useState(false);
  const roles = DEFAULT_ROLES;
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [dealershipId, setDealershipId] = useState<string>("");

  // form fields
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(""); // only for legacy email login
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState("Advisor");
  const [otherRole, setOtherRole] = useState("");

  useEffect(() => {
    supabase.from("dealerships").select("id, name").order("name").then(({ data }) => {
      if (data && data.length) {
        setDealerships(data as Dealership[]);
        setDealershipId((prev) => prev || data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  const signInWithEmail = async (loginEmail: string) => {
    let { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (isEmailNotConfirmed(error?.message)) {
      try {
        await confirmEmailForValidCredentials({ data: { email: loginEmail, password } });
        const retry = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        error = retry.error;
      } catch (confirmError) {
        throw new Error(errorMessage(confirmError));
      }
    }
    if (error) throw new Error(error.message);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let loginEmail: string;
      if (useLegacyEmail) {
        loginEmail = email.trim();
        if (!loginEmail) throw new Error("Enter your email");
      } else {
        const normalized = normalizePhone(phone);
        if (!normalized) throw new Error("Enter a valid phone number");
        try {
          const r = await resolveEmailForPhone({ data: { phone: normalized } });
          loginEmail = r.email;
        } catch {
          // Fall back to synthetic email for accounts created via phone but not yet indexed.
          loginEmail = phoneToSyntheticEmail(normalized);
        }
      }
      await signInWithEmail(loginEmail);
      toast.success("Welcome back");
      const { data } = await supabase.auth.getUser();
      if (data.user) subscribePush(data.user.id);
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Name is required");
    const normalized = normalizePhone(phone);
    if (!normalized) return toast.error("Enter a valid phone number");
    if (!password) return toast.error("Password is required");
    const finalRole = role === "Other" ? otherRole.trim() : role;
    if (!finalRole) return toast.error("Please specify your role");
    if (!dealershipId) return toast.error("Please pick your dealership");

    const syntheticEmail = phoneToSyntheticEmail(normalized);

    setBusy(true);
    try {
      await createConfirmedAccount({
        data: {
          email: syntheticEmail,
          password,
          fullName: fullName.trim(),
          nickname: nickname.trim(),
          roleName: finalRole,
          dealershipId,
          phoneNumber: normalized,
        },
      });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });
      if (signInError) throw signInError;
    } catch (createError) {
      setBusy(false);
      return toast.error(errorMessage(createError));
    }

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      setBusy(false);
      return toast.error("Sign-up failed — try again");
    }

    setBusy(false);
    toast.success("Account created — waiting for approval");
    try { await notifyOwnerOfPendingSignup({ data: { fullName: fullName.trim(), role: finalRole } }); } catch {}
    subscribePush(uid);
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <div className="mx-auto max-w-md px-5 py-12">
        <div className="mb-8 text-center">
          <img src={huriLogo.url} alt="Huri" className="mx-auto mb-3 h-14 w-auto" />
          <p className="mt-1 text-sm text-muted-foreground">Lot Management</p>
        </div>

        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <div className="mb-6 flex rounded-full bg-muted p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-full py-2 ${mode === "login" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-full py-2 ${mode === "register" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Register
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              {useLegacyEmail ? (
                <Field
                  label="Email (legacy)"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="email"
                />
              ) : (
                <Field
                  label="Phone number"
                  value={phone}
                  onChange={setPhone}
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="(555) 555-1234"
                />
              )}
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="current-password"
              />
              <button
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign In"}
              </button>
              <button
                type="button"
                onClick={() => setUseLegacyEmail((v) => !v)}
                className="mx-auto block text-xs text-muted-foreground underline"
              >
                {useLegacyEmail ? "Sign in with phone instead" : "Sign in with email (legacy)"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <Field label="Full Name" value={fullName} onChange={setFullName} required />
              <Field label="Nickname (optional)" value={nickname} onChange={setNickname} />
              <Field
                label="Phone number"
                value={phone}
                onChange={setPhone}
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="(555) 555-1234"
              />
              {phone && normalizePhone(phone) && (
                <p className="-mt-2 text-xs text-muted-foreground">
                  Saved as {formatPhone(normalizePhone(phone))}
                </p>
              )}
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                required
                autoComplete="new-password"
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Dealership</label>
                <select
                  value={dealershipId}
                  onChange={(e) => setDealershipId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base"
                >
                  {dealerships.length === 0 && <option value="">Loading…</option>}
                  {dealerships.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {role === "Other" && (
                <Field
                  label="Specify your role"
                  value={otherRole}
                  onChange={setOtherRole}
                  required
                />
              )}

              <button
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create Account"}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                No email or SMS verification required — waiting for owner approval.
              </p>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Tap{" "}
          <Link to="/" className="text-primary">
            Share → Add to Home Screen
          </Link>{" "}
          after signing in to install Huri.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
  inputMode,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
  placeholder?: string;
}) {
  // Reference digitsOnly so the tree-shaker keeps our helper import graph honest.
  void digitsOnly;
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
      />
    </div>
  );
}
