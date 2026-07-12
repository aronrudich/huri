import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, Bell, UserX, Crown, Pencil, Search, Trash2, Check, X as XIcon, ArrowRightLeft, Briefcase } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BottomBar, HuriLogo, TopActions } from "@/components/BottomBar";
import { requestNotifPermission, registerPushSubscription, getNotifPref, setNotifPref } from "@/lib/push";
import { useServerFn } from "@tanstack/react-start";
import { sendTestPush } from "@/lib/push.functions";
import {
  listPendingApprovals,
  approveAccount,
  denyAccount,
  approveRoleChange,
  denyRoleChange,
  requestRoleChange,
  deleteOwnAccount,
  removeEmployee as removeEmployeeFn,
  transferOwnership,
} from "@/lib/admin.functions";
import { Switch } from "@/components/ui/switch";
import { EditProfileSheet } from "@/components/EditProfileSheet";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · Huri" }] }),
  component: ProfilePage,
});

const ROLE_OPTIONS = [
  "Valet", "Valet & Parts", "Advisor", "Technician", "Shop Foreman",
  "Service Manager", "Service Director", "General Manager", "Manager", "Other",
];

type Employee = { id: string; full_name: string; nickname: string | null; role_name: string; email: string; is_owner?: boolean };
type PendingAccount = { id: string; full_name: string; nickname: string | null; email: string; role_name: string; created_at: string };
type PendingRole = { id: string; full_name: string; nickname: string | null; email: string; role_name: string; pending_role_name: string };

function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [notifOn, setNotifOn] = useState(true);
  const [staff, setStaff] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ accounts: PendingAccount[]; roleChanges: PendingRole[] }>({ accounts: [], roleChanges: [] });
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Employee | null>(null);
  const [transferTo, setTransferTo] = useState<Employee | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [roleReqOpen, setRoleReqOpen] = useState(false);
  const [dealershipName, setDealershipName] = useState<string>("");

  const isOwner = !!profile?.is_owner;
  const ADMIN_ROLES = ["Manager", "Service Manager", "Service Director", "General Manager", "Director"];
  const isAdmin = isOwner || (profile ? ADMIN_ROLES.includes(profile.role_name) : false);


  const fetchPending = useServerFn(listPendingApprovals);
  const approveAcc = useServerFn(approveAccount);
  const denyAcc = useServerFn(denyAccount);
  const approveRC = useServerFn(approveRoleChange);
  const denyRC = useServerFn(denyRoleChange);
  const requestRC = useServerFn(requestRoleChange);
  const deleteSelf = useServerFn(deleteOwnAccount);
  const removeFn = useServerFn(removeEmployeeFn);
  const transferFn = useServerFn(transferOwnership);
  const sendTest = useServerFn(sendTestPush);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth", replace: true }); }, [user, loading, navigate]);
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) { setPerm("unsupported"); return; }
    const isTouch = window.matchMedia?.("(pointer: coarse)").matches;
    if (!isTouch) { setPerm("unsupported"); return; }
    setPerm(Notification.permission);
    setNotifOn(getNotifPref());
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("profiles").select("id, full_name, nickname, role_name, email, is_owner")
      .eq("is_active", true).eq("status", "approved").order("full_name")
      .then(({ data }) => setStaff((data as Employee[]) ?? []));
  }, [isAdmin]);

  const loadPending = async () => {
    try { const r = await fetchPending({}); setPending(r as typeof pending); }
    catch (e) { console.warn(e); }
  };
  useEffect(() => {
    if (!isAdmin) return;
    loadPending();
    const t = setInterval(loadPending, 15000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);


  const logout = async () => { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); };

  const toggleNotifs = async (on: boolean) => {
    if (!user) return;
    if (on) {
      if (perm !== "granted") {
        const result = await requestNotifPermission();
        if (result === "granted") {
          setPerm("granted"); setNotifOn(true); setNotifPref(true);
          toast.success("Notifications on"); void registerPushSubscription(user.id); return;
        }
        if (result === "denied") return toast.error("Permission denied — enable in browser settings");
        return toast.error("Push not supported on this device");
      }
      setNotifPref(true); setNotifOn(true); toast.success("Notifications on"); void registerPushSubscription(user.id);
    } else { setNotifPref(false); setNotifOn(false); toast.message("Notifications paused"); }
  };

  const handleSendTest = async () => {
    try {
      const r = await sendTest({ data: {} });
      if (r.sent > 0) toast.success(`Test sent to ${r.sent} device${r.sent === 1 ? "" : "s"}`);
      else toast.error("No active push subscriptions on this device yet.");
    } catch (e) { toast.error((e as Error).message); }
  };

  const leaveDealership = async () => {
    try { await deleteSelf({}); await supabase.auth.signOut(); toast.success("Account deleted"); navigate({ to: "/auth", replace: true }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const handleRemove = async (emp: Employee) => {
    try {
      await removeFn({ data: { userId: emp.id } });
      setStaff((s) => s.filter((e) => e.id !== emp.id));
      setConfirmRemove(null);
      toast.success(`${emp.full_name} removed and deleted`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleTransfer = async (emp: Employee) => {
    try {
      await transferFn({ data: { userId: emp.id } });
      toast.success(`${emp.full_name} is now the owner`);
      setTransferTo(null);
      await refreshProfile();
    } catch (e) { toast.error((e as Error).message); }
  };

  const handleApproveAcc = async (id: string) => {
    try { await approveAcc({ data: { userId: id } }); toast.success("Approved"); loadPending(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const handleDenyAcc = async (id: string) => {
    try { await denyAcc({ data: { userId: id } }); toast.message("Denied & deleted"); loadPending(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const handleApproveRC = async (id: string) => {
    try { await approveRC({ data: { userId: id } }); toast.success("Role updated"); loadPending(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const handleDenyRC = async (id: string) => {
    try { await denyRC({ data: { userId: id } }); toast.message("Role change denied"); loadPending(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const filtered = staff.filter((e) => {
    if (e.id === user?.id) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return e.full_name.toLowerCase().includes(q) || (e.nickname ?? "").toLowerCase().includes(q) || e.role_name.toLowerCase().includes(q);
  });

  const totalPending = pending.accounts.length + pending.roleChanges.length;

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
              <p className="text-lg font-semibold flex items-center gap-1.5">
                {profile.full_name}
                {isOwner && <Crown className="h-4 w-4 text-amber-500" />}
              </p>
              {profile.nickname && <p className="text-xs text-muted-foreground">"{profile.nickname}"</p>}
              <p className="text-sm text-primary">
                {profile.role_name}
                {profile.pending_role_name && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                    Pending: {profile.pending_role_name}
                  </span>
                )}
              </p>
            </div>
            <button onClick={() => setEditOpen(true)} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          </div>
          <Row label="Email" value={profile.email} />
          <button
            onClick={() => setRoleReqOpen(true)}
            className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-sm font-medium text-primary active:bg-accent"
          >
            <Briefcase className="h-4 w-4" />
            Request role change
          </button>
        </section>
      )}

      {isAdmin && (

        <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
          <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-500" /> Approvals</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${totalPending > 0 ? "bg-amber-100 text-amber-700" : "bg-muted"}`}>
              {totalPending} pending
            </span>
          </div>
          {totalPending === 0 ? (
            <p className="px-4 py-4 text-center text-xs text-muted-foreground">Nothing waiting — all caught up.</p>
          ) : (
            <ul>
              {pending.accounts.map((a) => (
                <li key={`acc-${a.id}`} className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">New account · {a.role_name}</p>
                  </div>
                  <button onClick={() => handleApproveAcc(a.id)} className="grid h-8 w-8 place-items-center rounded-full bg-green-600 text-white"><Check className="h-4 w-4" /></button>
                  <button onClick={() => handleDenyAcc(a.id)} className="grid h-8 w-8 place-items-center rounded-full bg-destructive text-destructive-foreground"><XIcon className="h-4 w-4" /></button>
                </li>
              ))}
              {pending.roleChanges.map((r) => (
                <li key={`rc-${r.id}`} className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.role_name} → <span className="font-semibold text-foreground">{r.pending_role_name}</span></p>
                  </div>
                  <button onClick={() => handleApproveRC(r.id)} className="grid h-8 w-8 place-items-center rounded-full bg-green-600 text-white"><Check className="h-4 w-4" /></button>
                  <button onClick={() => handleDenyRC(r.id)} className="grid h-8 w-8 place-items-center rounded-full bg-destructive text-destructive-foreground"><XIcon className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
        <div className="flex items-center gap-3 px-4 py-4">
          <Bell className={`h-5 w-5 ${notifOn && perm === "granted" ? "text-primary" : "text-muted-foreground"}`} />
          <div className="flex-1">
            <p className="font-medium">Push notifications</p>
            <p className="text-xs text-muted-foreground">
              {perm === "unsupported" ? "Not supported on this device"
                : notifOn && perm === "granted" ? "On — you'll be alerted to new activity"
                : "Off — pause alerts while you're away from work"}
            </p>
          </div>
          <Switch checked={notifOn && perm === "granted"} disabled={perm === "unsupported"} onCheckedChange={toggleNotifs} />
        </div>
        {notifOn && perm === "granted" && (
          <button onClick={handleSendTest} className="w-full border-t border-border px-4 py-3 text-sm font-semibold text-primary active:bg-accent">
            Send test notification
          </button>
        )}
      </section>

      {isAdmin && (
        <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
          <div className="flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Crown className="h-4 w-4 text-amber-500" /> Roster ({staff.filter((e) => e.id !== user?.id).length})
          </div>
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full bg-transparent text-sm outline-none" />
            </div>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {filtered.map((emp) => (
              <li key={emp.id} className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium flex items-center gap-1.5">
                    {emp.full_name}
                    {emp.is_owner && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{emp.role_name} · {emp.email}</p>
                </div>
                {!emp.is_owner && (
                  <>
                    {isOwner && (
                      <button onClick={() => setTransferTo(emp)} className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-amber-700" title="Transfer ownership">
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => setConfirmRemove(emp)} className="grid h-8 w-8 place-items-center rounded-full bg-destructive/10 text-destructive" title="Remove & delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}

              </li>
            ))}
            {filtered.length === 0 && <li className="px-4 py-6 text-center text-xs text-muted-foreground">No matches.</li>}
          </ul>
        </section>
      )}

      <section className="mx-3 mt-4 overflow-hidden rounded-2xl bg-background">
        <button onClick={() => setConfirmLeave(true)} className="flex w-full items-center gap-3 border-b border-border px-4 py-4 text-destructive active:bg-accent">
          <UserX className="h-5 w-5" />
          <span className="font-medium">Leave Dealership (delete account)</span>
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
        <ConfirmSheet title="Leave & delete your account?"
          body="Your Huri account will be permanently deleted. You can sign up again anytime, but you'll need owner approval to get back in."
          confirmLabel="Yes, delete my account" onCancel={() => setConfirmLeave(false)} onConfirm={leaveDealership} />
      )}
      {confirmRemove && (
        <ConfirmSheet title={`Remove ${confirmRemove.full_name}?`}
          body={`${confirmRemove.role_name} · ${confirmRemove.email}. Their account will be permanently deleted from Huri. They can sign up again but will need your approval.`}
          confirmLabel="Remove & delete" onCancel={() => setConfirmRemove(null)} onConfirm={() => handleRemove(confirmRemove)} />
      )}
      {transferTo && (
        <ConfirmSheet title={`Transfer ownership to ${transferTo.full_name}?`}
          body={`They will gain full Owner powers (approve accounts, change roles, remove people). You will lose those powers immediately. This cannot be undone without the new owner transferring back to you.`}
          confirmLabel="Yes, transfer ownership" onCancel={() => setTransferTo(null)} onConfirm={() => handleTransfer(transferTo)} />
      )}

      {editOpen && profile && (
        <EditProfileSheet profile={profile} onClose={() => setEditOpen(false)} onSaved={() => refreshProfile()} />
      )}

      {roleReqOpen && profile && (
        <RequestRoleSheet
          currentRole={profile.role_name}
          pendingRole={profile.pending_role_name ?? null}
          onClose={() => setRoleReqOpen(false)}
          onSubmit={async (newRole) => {
            try { await requestRC({ data: { newRole } }); toast.success("Request sent to owner"); await refreshProfile(); setRoleReqOpen(false); }
            catch (e) { toast.error((e as Error).message); }
          }}
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

function ConfirmSheet({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-3xl bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-destructive">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button onClick={onConfirm} className="w-full rounded-xl bg-destructive py-3 text-base font-semibold text-destructive-foreground">{confirmLabel}</button>
          <button onClick={onCancel} className="w-full rounded-xl bg-muted py-3 text-base font-medium">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function RequestRoleSheet({ currentRole, pendingRole, onClose, onSubmit }:
  { currentRole: string; pendingRole: string | null; onClose: () => void; onSubmit: (role: string) => void }) {
  const [pick, setPick] = useState(pendingRole ?? currentRole);
  const [other, setOther] = useState("");
  const final = pick === "Other" ? other.trim() : pick;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Request role change</h2>
        <p className="mt-1 text-xs text-muted-foreground">Current role: <span className="font-medium text-foreground">{currentRole}</span>. The owner must approve before it takes effect.</p>
        <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
          {ROLE_OPTIONS.map((r) => (
            <button key={r} onClick={() => setPick(r)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${pick === r ? "border-primary bg-primary/5 font-semibold" : "border-border"}`}>
              <span>{r}</span>{pick === r && <span className="text-primary">✓</span>}
            </button>
          ))}
        </div>
        {pick === "Other" && (
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Specify role"
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary" />
        )}
        <button disabled={!final || final === currentRole}
          onClick={() => onSubmit(final)}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-base font-semibold text-primary-foreground disabled:opacity-50">
          Send request
        </button>
        <button onClick={onClose} className="mt-2 w-full rounded-xl bg-muted py-3 text-base font-medium">Cancel</button>
      </div>
    </div>
  );
}
