import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { passwordLoginOnServer } from "./password-login.server";

export const loginWithPasswordFallback = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: z.string().email(), password: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => passwordLoginOnServer(data.email, data.password));