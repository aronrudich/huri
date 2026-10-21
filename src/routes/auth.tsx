import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { confirmEmailForValidCredentials, createConfirmedAccount } from "@/lib/auth.functions";
import { loginWithPasswordFallback } from "@/lib/password-login.functions";
import { notifyOwnerOfPendingSignup } from "@/lib/admin.functions";
import { submitBusinessInquiry } from "@/lib/business.functions";
import { useAuth } from "@/lib/auth-context";
import { subscribePush } from "@/lib/push";
import { toast } from "sonner";
import { ROLE_OPTIONS } from "@/lib/roles";
import { BusinessAddress, emptyAddr, addrComplete, type Addr } from "@/components/BusinessAddress";
import huriLogo from "@/assets/huri-logo-new.png.asset.json";
import explainerVideo from "@/assets/huri-explainer-v8.mp4.asset.json";
import explainerWebm from "@/assets/huri-explainer-v8.webm.asset.json";
import explainerPreview from "@/assets/huri-explainer-v8-cover.jpg.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Huri" },
      { name: "description", content: "Sign in or register for Huri." },
      { property: "og:title", content: "Sign in · Huri" },
      { property: "og:description", content: "Sign in, register with your company code, or introduce your business to Huri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const DEFAULT_ROLES = ROLE_OPTIONS;
const isEmailNotConfirmed = (message?: string) => /email not confirmed/i.test(message ?? "");
const isNetworkFailure = (message?: string) => /failed to fetch|network request failed|fetch failed/i.test(message ?? "");
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "business">("login");
  const [busy, setBusy] = useState(false);
  const roles = DEFAULT_ROLES;

  // form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [role, setRole] = useState("Advisor");
  const [otherRole, setOtherRole] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    const resetEmail = email.trim().toLowerCase();
    if (!resetEmail) return toast.error("Enter your email first");
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetSent(true);
      toast.success("Reset link sent");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };


  // Returning users with a valid session never see the sign-in form.
  useEffect(() => {
    if (!loading && user) navigate({ to: "/pickup", replace: true });
  }, [user, loading, navigate]);


  const signInWithEmail = async (loginEmail: string) => {
    let error: { message: string } | null = null;
    const tryServerFallback = async () => {
      const session = await loginWithPasswordFallback({ data: { email: loginEmail, password } });
      const restored = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (restored.error) throw restored.error;
    };
    try {
      const direct = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      error = direct.error;
      if (isNetworkFailure(error?.message)) {
        await tryServerFallback();
        return;
      }
    } catch {
      await tryServerFallback();
      return;
    }

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
      const loginEmail = email.trim().toLowerCase();
      if (!loginEmail) throw new Error("Enter your email");
      if (!password) throw new Error("Enter your password");
      await signInWithEmail(loginEmail);
      toast.success("Welcome back");
      const { data } = await supabase.auth.getUser();
      if (data.user) subscribePush(data.user.id);
      navigate({ to: "/pickup", replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return toast.error("Name is required");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) return toast.error("Enter a valid email");
    if (!password) return toast.error("Password is required");
    const finalRole = role === "Other" ? otherRole.trim() : role;
    if (!finalRole) return toast.error("Please specify your role");
    const cleanCode = companyCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(cleanCode)) {
      return toast.error("Enter your company code (letters and numbers only)");
    }

    setBusy(true);
    try {
      await createConfirmedAccount({
        data: {
          email: cleanEmail,
          password,
          fullName: fullName.trim(),
          nickname: nickname.trim(),
          roleName: finalRole,
          companyCode: cleanCode,
        },
      });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
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
    toast.success("Account created");
    try {
      await notifyOwnerOfPendingSignup({ data: { fullName: fullName.trim(), role: finalRole } });
    } catch (notifyError) {
      // The owner notice is best-effort: sign-up already succeeded.
      console.warn("[auth] owner signup notice failed", notifyError);
    }

    subscribePush(uid);
    navigate({ to: "/pickup", replace: true });

  };

  // While the saved session is being restored (or after it resolves to a
  // signed-in user) show the logo instead of flashing the sign-in form.
  if (loading || user) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface safe-top safe-bottom">
        <img src={huriLogo.url} alt="Huri" className="h-10 w-auto opacity-80" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">

      <div className={`mx-auto px-5 py-12 ${mode === "business" ? "max-w-5xl" : "max-w-md"}`}>
        <div className="mb-8 text-center">
          <img src={huriLogo.url} alt="Huri" className="mx-auto mb-3 h-10 w-auto" />
          <p className="mt-1 text-sm text-muted-foreground">Time Is Money</p>
        </div>

        <div className={mode === "business" ? "" : "rounded-2xl bg-card p-6 shadow-sm"}>
          <div className={`mb-6 flex rounded-full bg-muted p-1 text-sm font-medium ${mode === "business" ? "md:max-w-md" : ""}`}>
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
            <button
              type="button"
              onClick={() => setMode("business")}
              className={`flex-1 rounded-full py-2 ${mode === "business" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              Business
            </button>
          </div>

          {mode === "business" ? (
            <BusinessForm />
          ) : mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
                required
              />
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="current-password"
                required
              />
              <button
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign In"}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="w-full py-1 text-center text-xs font-medium text-primary"
              >
                Forgot password?
              </button>
              {resetSent && (
                <p className="text-center text-xs text-muted-foreground">
                  Reset link sent. Check the email you signed up with, then follow the link to
                  create a new password.
                </p>
              )}
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
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Company Code</label>
                <input
                  value={companyCode}
                  onChange={(e) => setCompanyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  required
                  maxLength={16}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ABC12345"
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base tracking-[0.2em] outline-none focus:border-primary"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ask your manager for your company's code.
                </p>
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
                A manager at your company approves your account before you can use Huri.
              </p>

            </form>
          )}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            By continuing, you agree to Huri’s{" "}
            <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms of Service</Link>{" "}
            and acknowledge our{" "}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
          </p>
        </div>

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

function BusinessForm() {
  const [watching, setWatching] = useState(false);
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"dealership" | "auction" | "">("");
  const [message, setMessage] = useState("");
  const [addr, setAddr] = useState<Addr>(emptyAddr);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return toast.error("Enter a valid work email");
    if (!contactName.trim()) return toast.error("Enter your name");
    if (!name.trim()) return toast.error("Business name is required");
    if (!type) return toast.error("Choose Dealership or Auction");
    if (!addrComplete(addr)) return toast.error("Enter street, city, state and ZIP");
    setBusy(true);
    try {
      await submitBusinessInquiry({ data: { email: cleanEmail, contactName: contactName.trim(), businessName: name.trim(), businessType: type, message: message.trim(), submissionKey: key, address: { street: addr.street.trim(), city: addr.city.trim(), state: addr.state.trim(), zip: addr.zip.trim(), formatted: addr.formatted || undefined, lat: addr.lat, lng: addr.lng } } });
      setEmail(""); setContactName(""); setName(""); setType(""); setMessage(""); setAddr(emptyAddr);
      setKey(crypto.randomUUID());
      setDone(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <button
        type="button"
        onClick={() => setWatching(true)}
        aria-label="Play Huri explainer video"
        className="relative block aspect-video w-full overflow-hidden rounded-xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        <img src={explainerPreview.url} alt="" className="h-full w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-foreground/20">
          <Play className="h-14 w-14 rounded-full bg-primary p-4 text-primary-foreground" aria-hidden="true" />
        </span>
      </button>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Work Email" value={email} onChange={setEmail} type="email" autoComplete="email" required />
        <Field label="Your Name" value={contactName} onChange={(v) => setContactName(v.slice(0, 120))} autoComplete="name" required />
        <Field label="Business Name" value={name} onChange={(v) => setName(v.slice(0, 160))} required />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Business Type</label>
          <div className="flex gap-2">
            {(["dealership", "auction"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 rounded-xl border py-3 text-sm font-medium ${type === t ? "border-primary bg-primary/10 text-primary" : "border-input bg-background"}`}
              >
                {t === "dealership" ? "Dealership" : "Auction"}
              </button>
            ))}
          </div>
        </div>
        <BusinessAddress value={addr} onChange={setAddr} />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tell us about your business (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
            rows={4}
            className="w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary"
          />
        </div>
        <button disabled={busy} className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Submitting…" : "Submit"}
        </button>
      </form>
      <aside className="hidden min-w-0 overflow-hidden rounded-lg border border-border bg-card md:sticky md:top-6 md:block">
        <DemoVideo />
      </aside>
      </div>
      {watching && <ExplainerModal onClose={() => setWatching(false)} />}
      {done && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setDone(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold">Thank you very much!</h2>
            <p className="text-sm font-semibold text-primary">We will contact you in a Huri.</p>
            <p className="text-sm text-muted-foreground">
              In the meantime, watch this demonstration to learn more about Huri
            </p>
            <DemoVideo />
            <button
              onClick={() => setDone(false)}
              className="w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const DEMO_VIDEO_SRC = explainerVideo.url;

function ExplainerModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Huri explainer video"
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-auto h-dvh max-h-dvh w-screen max-w-none bg-background p-0 text-foreground backdrop:bg-foreground/60 md:h-auto md:max-w-4xl md:rounded-lg"
    >
      <div className="flex h-full flex-col justify-center safe-top safe-bottom">
        <div className="flex items-center justify-end border-b border-border px-4 py-3">
          <button type="button" onClick={onClose} aria-label="Close video" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <DemoVideo autoPlay />
      </div>
    </dialog>
  );
}

function DemoVideo({ autoPlay = false }: { autoPlay?: boolean }) {
  const [unavailable, setUnavailable] = useState(false);

  if (unavailable) {
    return (
      <div className="grid aspect-video w-full place-items-center rounded-xl border border-border bg-muted px-5 text-center">
        <p className="text-xs text-muted-foreground">Demonstration video coming soon.</p>
      </div>
    );
  }

  return (
    <video
      controls
      playsInline
      autoPlay={autoPlay}
      poster={explainerPreview.url}
      preload="metadata"
      onError={(event) => { if (event.target === event.currentTarget) setUnavailable(true); }}
      className="aspect-video max-h-[80dvh] w-full bg-muted object-contain"
    >
      <source src={DEMO_VIDEO_SRC} type={'video/mp4; codecs="avc1.640028, mp4a.40.2"'} />
      <source src={explainerWebm.url} type="video/webm" />
    </video>
  );
}
