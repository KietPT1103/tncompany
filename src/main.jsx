import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./App.css";
import "./admin.css";
import { AuthProvider } from "./context/AuthContext";
import { StoreProvider } from "./context/StoreContext";
import "@fontsource-variable/nunito-sans";
import "@fontsource-variable/smooch-sans";
import "@fontsource/fira-sans/400.css";
import "@fontsource/fira-sans/500.css";
import "@fontsource/fira-sans/600.css";
import "@fontsource/fira-sans/700.css";
const rootElement = document.getElementById("root");
const pathname = typeof window !== "undefined" ? window.location.pathname : "";
const isNewsRoute = pathname === "/tin-tuc" || pathname.startsWith("/tin-tuc/");
const app = (
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if (rootElement.hasChildNodes() && !isNewsRoute) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
