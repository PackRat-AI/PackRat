import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { App } from "./pages/app";
import "./shared/lib/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: false,
    },
  },
});

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </JotaiProvider>
  </StrictMode>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}
