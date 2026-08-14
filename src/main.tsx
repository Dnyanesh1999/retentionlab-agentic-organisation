import "@fontsource/instrument-serif";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource-variable/manrope";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { MotionConfigProvider } from "./components/motion/MotionConfigProvider";
import "./styles/tokens.css";
import "./styles/global.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("RetentionLab root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <MotionConfigProvider>
      <App />
    </MotionConfigProvider>
  </StrictMode>,
);
