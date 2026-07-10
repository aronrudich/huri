import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { confirmEmailForValidCredentials, createConfirmedAccount } from "@/lib/auth.functions";
import { notifyOwnerOfPendingSignup } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { subscribePush } from "@/lib/push";
import { toast } from "sonner";

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
  const roles = DEFAULT_ROLES;
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [dealershipId, setDealershipId] = useState<string>("");

  // form fields
  const [email, setEmail] = useState("");
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


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    let { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (isEmailNotConfirmed(error?.message)) {
      try {
        await confirmEmailForValidCredentials({ data: { email: email.trim(), password } });
        const retry = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        error = retry.error;
      } catch (confirmError) {
        setBusy(false);
        return toast.error(errorMessage(confirmError));
      }
    }

    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    // try to subscribe to push (non-blocking)
    const { data } = await supabase.auth.getUser();
    if (data.user) subscribePush(data.user.id);
    navigate({ to: "/", replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!fullName.trim() || !trimmedEmail || !password) {
      return toast.error("Name, email, and password are required");
    }
    const finalRole = role === "Other" ? otherRole.trim() : role;
    if (!finalRole) return toast.error("Please specify your role");
    if (!dealershipId) return toast.error("Please pick your dealership");

    setBusy(true);
    try {
      await createConfirmedAccount({
        data: {
          email: trimmedEmail,
          password,
          fullName: fullName.trim(),
          nickname: nickname.trim(),
          roleName: finalRole,
          dealershipId,
        },
      });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
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
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-primary text-3xl font-bold text-primary-foreground">
            H
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Huri</h1>
          <p className="mt-1 text-sm text-muted-foreground">Service-lane coordination</p>
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
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
              />
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
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <Field label="Full Name" value={fullName} onChange={setFullName} required />
              <Field label="Nickname (optional)" value={nickname} onChange={setNickname} />
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                required
                autoComplete="email"
              />
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                required
                autoComplete="new-password"
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
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
                No email verification required.
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
      />
    </div>
  );
}
