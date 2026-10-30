import { Cloud, CloudOff, LogOut, RefreshCw } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/inputs";
import { Skeleton } from "@/components/ui/misc";
import { toast } from "@/components/ui/Toast";
import { loadSync, syncConfig, useSyncStatus, type SyncState } from "@/sync/status";

const STATUS: Record<Exclude<SyncState, "loading" | "signedOut">, string> = {
  idle: "Synced",
  syncing: "Syncing…",
  offline: "Offline. Changes sync when you're back online.",
  error: "Sync hit a snag",
};

export function SyncEditor() {
  const { state, email, lastSyncedAt, error } = useSyncStatus();
  useEffect(() => void loadSync(), []);

  if (!syncConfig) return <p className="text-sm text-muted">Sync isn't set up on this site yet.</p>;
  if (state === "loading") return <Skeleton className="h-24 w-full" />;
  if (state === "signedOut") return <SignInForm />;

  const time = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Signed in as <span className="font-medium">{email}</span>
      </p>
      <p aria-live="polite" className={state === "error" ? "flex items-center gap-2 text-sm text-danger" : "flex items-center gap-2 text-sm text-muted"}>
        {state === "offline" ? <CloudOff className="size-4" /> : <Cloud className="size-4" />}
        {STATUS[state]}
        {state === "idle" && time && ` at ${time}`}
        {state === "error" && error && ` — ${error}`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={state === "syncing"} onClick={() => void loadSync().then((m) => m?.syncNow())}>
          <RefreshCw className="size-4" /> Sync now
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            void loadSync()
              .then((m) => m?.signOut())
              .then(() => toast("Signed out. Your data stays in this browser."))
          }
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

function SignInForm() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (mode: "signIn" | "signUp") => {
    setError(null);
    setNotice(null);
    if (!email.trim() || password.length < 6) {
      setError("Enter your email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    const m = await loadSync();
    if (!m) return;
    if (mode === "signIn") {
      const err = await m.signIn(email.trim(), password);
      if (err) setError(err);
    } else {
      const r = await m.signUp(email.trim(), password);
      if (r.error) setError(r.error);
      else if (r.needsConfirm) setNotice("Almost there! Check your email, tap the confirm link, then sign in here.");
    }
    setBusy(false);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run("signIn");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted">
        Sign in with the same account on your laptop and phone. Your paydays, expenses and To-Buy list stay the same on both. The first time you sign in, what's already in this browser gets added to your account.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" htmlFor={`${id}-email`}>
          <TextInput id={`${id}-email`} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor={`${id}-pw`}>
          <TextInput id={`${id}-pw`} type="password" autoComplete="current-password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
      </div>
      {(error || notice) && (
        <p role={error ? "alert" : "status"} className={error ? "text-sm text-danger" : "text-sm text-success"}>
          {error ?? notice}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          Sign in
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void run("signUp")}>
          Create account
        </Button>
      </div>
    </form>
  );
}
