// Patch para Chrome: evitar crash removeChild cuando React desmonta portales
if (typeof window !== "undefined") {
  const _removeChild = Node.prototype.removeChild;
  // @ts-ignore
  Node.prototype.removeChild = function<T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return _removeChild.call(this, child) as T;
  };
  const _insertBefore = Node.prototype.insertBefore;
  // @ts-ignore
  Node.prototype.insertBefore = function<T extends Node>(newNode: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) {
      return newNode;
    }
    return _insertBefore.call(this, newNode, ref) as T;
  };
}

import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evitar re-fetches innecesarios que causan rate limit en móvil
      staleTime: 60_000,           // datos frescos por 1 minuto
      refetchOnWindowFocus: false, // no re-fetchar al volver de otra app
      retry: 1,                    // solo 1 reintento en error
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
