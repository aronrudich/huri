import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PickupSubmission } from "./pickup-notifications.server";

export const submitPickupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: PickupSubmission) => data)
  .handler(async ({ data, context }) => {
    const { createPickupAndNotify } = await import("./pickup-notifications.server");
    return createPickupAndNotify(context.supabase, context.userId, data);
  });