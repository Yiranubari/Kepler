import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppKitProvider } from "@reown/appkit/react";
import {
  bitcoinAdapter,
  selectedBitcoinNetwork,
  reownProjectId
} from "@/lib/wallet";
import { Toaster } from "@/components/ui/toaster";
import { App } from "@/App";
import "@/index.css";

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
          networks={[selectedBitcoinNetwork]}
          projectId={reownProjectId}
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
