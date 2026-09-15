import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachResilientSupabaseAuth } from "@/lib/resilient-auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  // /lovable/* server routes (webhooks, email callbacks) authenticate
  // themselves and must bypass app middleware untouched.
  const url = new URL(request.url);
  if (url.pathname.startsWith("/lovable/")) {
    return next();
  }
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachResilientSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
