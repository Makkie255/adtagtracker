import { QueryClient, QueryFunction } from "@tanstack/react-query";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/accept-invite"];

/** When the server returns 401, bounce the user to /login — unless they're
 *  already on a public route (e.g. the login page itself, or the password reset
 *  flow). Returns true if we redirected so callers can short-circuit. */
function handleUnauthorized(): boolean {
  if (typeof window === "undefined") return false;
  const current = window.location.pathname;
  if (PUBLIC_PATHS.some((p) => current === p || current.startsWith(p + "/"))) return false;
  // Use a hard nav so React Query state is fully reset
  window.location.href = "/login";
  return true;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && handleUnauthorized()) {
    // Throw a sentinel error that callers can ignore — page is navigating away anyway
    throw new Error("401: redirecting to login");
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "redirect";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401 }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, { credentials: "include" });

    if (res.status === 401) {
      if (on401 === "returnNull") return null as any;
      if (handleUnauthorized()) {
        // Page will reload, but make sure React Query doesn't surface an error first
        return null as any;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "redirect" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
