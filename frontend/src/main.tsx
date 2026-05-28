import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";

import "./index.css";
import App from "./App.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#1e1e2a",
            color: "#f0f0f8",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px",
            fontSize: "13px",
            fontWeight: "500",
          },
          success: {
            iconTheme: { primary: "#22c55e", secondary: "#1e1e2a" },
          },
          error: {
            iconTheme: { primary: "#f87171", secondary: "#1e1e2a" },
          },
        }}
      />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);
