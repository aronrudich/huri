import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { ensureServiceWorker } from "@/lib/push";
import { NotificationGate } from "@/components/NotificationGate";
import { PushSync } from "@/components/PushSync";
import { PendingGate } from "@/components/PendingGate";
import { TabPrefetcher } from "@/components/TabPrefetcher";
import { useRealtimeRecovery } from "@/lib/realtime-recovery";
import { useAppUpdate } from "@/lib/app-update";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ConnectionBanner } from "@/components/ConnectionBanner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <div className="mt-6">
          <Link to="/pickup" className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: import("@tanstack/react-router").ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">Try again or head home.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-input bg-background px-5 py-2 text-sm font-semibold">Home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Huri" },
      { name: "description", content: "Huri - Lot Management" },
      { name: "theme-color", content: "#007AFF" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Huri" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "Huri" },
      { name: "twitter:title", content: "Huri" },
      { property: "og:description", content: "Huri - Lot Management" },
      { name: "twitter:description", content: "Huri - Lot Management" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png?v=2" },
      { rel: "shortcut icon", href: "/favicon.ico?v=2" },
      { rel: "manifest", href: "/manifest.webmanifest?v=2" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png?v=2" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RealtimeRecovery() {
  useRealtimeRecovery();
  return null;
}

function SWRegistrar() {
  useEffect(() => { ensureServiceWorker(); }, []);
  return null;
}

function AppUpdater() {
  useAppUpdate();
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SWRegistrar />
        <AppUpdater />
        <PushSync />
        <RealtimeRecovery />
        <TabPrefetcher />
        <PullToRefresh>
          <Outlet />
        </PullToRefresh>

        <NotificationGate />
        <PendingGate />
        <ConnectionBanner />
        <Toaster position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
