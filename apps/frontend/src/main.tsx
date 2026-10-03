import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit, AppKitProvider } from "@reown/appkit/react";
import { BitcoinAdapter } from "@reown/appkit-adapter-bitcoin";
import { bitcoin, bitcoinTestnet } from "@reown/appkit/networks";
import { Toaster } from "@/components/ui/toaster";
import { App } from "@/App";
import "@/index.css";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || "";

const bitcoinAdapter = new BitcoinAdapter({
  projectId
});

createAppKit({
  adapters: [bitcoinAdapter],
  networks: [bitcoinTestnet, bitcoin],
  projectId,
  metadata: {
    name: "Kepler",
    description: "Kepler agent wallet",
    url: typeof window !== "undefined" ? window.location.origin : "https://kepler.app",
    icons: []
  },
  themeMode: "dark"
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <AppKitProvider
          adapters={[bitcoinAdapter]}
          networks={[bitcoinTestnet, bitcoin]}
          projectId={projectId}
        >
          <BrowserRouter>
            <App />
            <Toaster />
          </BrowserRouter>
        </AppKitProvider>
      </QueryClientProvider>
    </React.StrictMode>
  );
}
