import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, Bell, UserX, Shield, Pencil } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { requestNotifPermission, registerPushSubscription, getNotifPref, setNotifPref } from "@/lib/push";
import { useServerFn } from "@tanstack/react-start";
import { sendTestPush } from "@/lib/push.functions";
import { Switch } from "@/components/ui/switch";
import { EditProfileSheet } from "@/components/EditProfileSheet";
import { ChangeRoleSheet } from "@/components/ChangeRoleSheet";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · Huri" }] }),
  component: ProfilePage,
});

type Employee = {
  id: string; full_name: string; nickname: string | null;
  role_name: string; email: string; is_active: boolean;
};

const ADMIN_ROLES = ["General Manager", "Director"];
const PROTECTED_ROLES = ["General Manager", "Director"]; // Directors can't remove these

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [notifOn, setNotifOn] = useState(true);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Employee | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [roleEdit, setRoleEdit] = useState<Employee | null>(null);

  const isGM = profile?.role_name === "General Manager";
  const isAdmin = !!profile && ADMIN_ROLES.includes(profile.role_name);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) setPerm(Notification.permission);
    else setPerm("unsupported");
    setNotifOn(getNotifPref());
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("profiles").select("id, full_name, nickname, role_name, email, is_active")
      .eq("is_active", true).order("full_name")
      .then(({ data }) => setStaff((data as Employee[]) ?? []));
  }, [isAdmin]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const sendTest = useServerFn(sendTestPush);

  const toggleNotifs = async (on: boolean) => {
    if (!user) return;
    if (on) {
      if (perm !== "granted") {
        // Direct call from the click — no awaits before requestPermission().
        const result = await requestNotifPermission();
        if (result === "granted") {
          setPerm("granted"); setNotifOn(true); setNotifPref(true);
          toast.success("Notifications on");
          void registerPushSubscription(user.id);
          return;
        }
        if (result === "denied") return toast.error("Permission denied — enable in browser settings");
        return toast.error("Push not supported on this device");
      }
      setNotifPref(true); setNotifOn(true); toast.success("Notifications on");
      void registerPushSubscription(user.id);
    } else {
      setNotifPref(false); setNotifOn(false); toast.message("Notifications paused");
    }
  };

  const handleSendTest = async () => {
    try {
      const r = await sendTest({ data: {} });
      if (r.sent > 0) toast.success(`Test sent to ${r.sent} device${r.sent === 1 ? "" : "s"}`);
      else toast.error("No active push subscriptions on this device yet. Toggle off/on and try again.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const leaveDealership = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles")
      .update({ is_active: false, deactivated_at: new Date().toISOString(), deactivated_by: user.id })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    await supabase.auth.signOut();
    toast.success("Account deactivated");
    navigate({ to: "/auth", replace: true });
  };

  const removeEmployee = async (emp: Employee) => {
    if (!user) return;
    const { error } = await supabase.from("profiles")
      .update({ is_active: false, deactivated_at: new Date().toISOString(), deactivated_by: user.id })
      .eq("id", emp.id);
    if (error) return toast.error(error.message);
    setStaff((s) => s.filter((e) => e.id !== emp.id));
    setConfirmRemove(null);
    toast.success(`${emp.full_name} removed from dealership`);
  };

  return (
    <div className="min-h-screen bg-surface pb-32 safe-top safe-bottom">
      <header className="flex items-center gap-2 px-4 pb-3 pt-4">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full text-primary"><ArrowLeft className="h-5 w-5" /></Link>
        <HuriLogo />
        <div className="flex-1" />
        <TopActions />
      </header>


      {profile && (
        <section className="mx-3 overflow-hidden rounded-2xl bg-background">
          <div className="flex items-center gap-3 px-4 py-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {(profile.nickname || profile.full_name)[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold">{profile.full_name}</p>
              {profile.nickname && <p className="text-xs text-muted-foreground">"{profile.nickname}"</p>}
              <p className="text-sm text-primary">{profile.role_name}</p>
            </div>
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
          <Row label="Email" value={profile.email} />
        </section>
      )}

      <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
        <div className="flex items-center gap-3 px-4 py-4">
          <Bell className={`h-5 w-5 ${notifOn && perm === "granted" ? "text-primary" : "text-muted-foreground"}`} />
          <div className="flex-1">
            <p className="font-medium">Push notifications</p>
            <p className="text-xs text-muted-foreground">
              {perm === "unsupported"
                ? "Not supported on this device"
                : notifOn && perm === "granted"
                ? "On — you'll be alerted to new activity"
                : "Off — pause alerts while you're away from work"}
            </p>
          </div>
          <Switch
            checked={notifOn && perm === "granted"}
            disabled={perm === "unsupported"}
            onCheckedChange={toggleNotifs}
          />
        </div>
        {notifOn && perm === "granted" && (
          <button
            onClick={handleSendTest}
            className="w-full border-t border-border px-4 py-3 text-sm font-semibold text-primary active:bg-accent"
          >
            Send test notification
          </button>
        )}
      </section>

      {isAdmin && (
        <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
          <div className="flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Shield className="h-4 w-4 text-primary" /> Active Roster ({staff.length})
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {staff.filter((e) => e.id !== user?.id).map((emp) => {
              const protectedTarget = PROTECTED_ROLES.includes(emp.role_name);
              const canRemove = isGM || !protectedTarget;
              return (
                <li key={emp.id} className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{emp.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{emp.role_name}</p>
                  </div>
                  {isGM && (
                    <button
                      onClick={() => setRoleEdit(emp)}
                      className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                    >
                      Role
                    </button>
                  )}
                  {canRemove ? (
                    <button onClick={() => setConfirmRemove(emp)} className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
                      Remove
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Protected</span>
                  )}
                </li>
              );
            })}
            {staff.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted-foreground">No staff loaded.</li>}
          </ul>
        </section>
      )}

      <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
        <button onClick={() => setConfirmLeave(true)} className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-destructive active:bg-accent">
          <UserX className="h-5 w-5" />
          <span className="font-medium">Leave Dealership</span>
        </button>
        <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-4 text-destructive active:bg-accent">
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Log out</span>
        </button>
      </section>

      <p className="mt-6 px-5 text-center text-xs text-muted-foreground">
        Install Huri: open this page in Safari/Chrome → Share → Add to Home Screen.
      </p>

      {confirmLeave && (
        <ConfirmSheet
          title="Leave the dealership?"
          body="Your account will be deactivated immediately and you'll be signed out. Your historical messages and pickup records stay intact for auditing."
          confirmLabel="Yes, deactivate my account"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={leaveDealership}
        />
      )}
      {confirmRemove && (
        <ConfirmSheet
          title={`Remove ${confirmRemove.full_name}?`}
          body={`${confirmRemove.role_name} · ${confirmRemove.email}. This deactivates their account, signs them out of every device, and hides them from the active roster. All historical records are preserved.`}
          confirmLabel="Remove from Dealership"
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => removeEmployee(confirmRemove)}
        />
      )}

      {editOpen && profile && (
        <EditProfileSheet
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={() => refreshProfile()}
        />
      )}

      {roleEdit && (
        <ChangeRoleSheet
          employeeId={roleEdit.id}
          employeeName={roleEdit.full_name}
          currentRole={roleEdit.role_name}
          onClose={() => setRoleEdit(null)}
          onSaved={(newRole) =>
            setStaff((s) => s.map((e) => (e.id === roleEdit.id ? { ...e, role_name: newRole } : e)))
          }
        />
      )}


      <BottomBar active="profile" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ConfirmSheet({ title, body, confirmLabel, onCancel, onConfirm }:
  { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-3xl bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-destructive">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onConfirm} className="w-full rounded-xl bg-destructive py-3 text-base font-semibold text-destructive-foreground">
            {confirmLabel}
          </button>
          <button onClick={onCancel} className="w-full rounded-xl bg-muted py-3 text-base font-medium">Cancel</button>
        </div>
      </div>
    </div>
  );
}
