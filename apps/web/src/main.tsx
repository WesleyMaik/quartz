import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app";
import { createServices } from "./app/services";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root element.");

createRoot(container).render(
  <StrictMode>
    <App services={createServices()} />
  </StrictMode>,
);
