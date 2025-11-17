import "./styles.css";
import { createRoot } from "react-dom/client";
import App from "./app";
import Admin from "./admin";
import { Providers } from "@/providers";

const root = createRoot(document.getElementById("app")!);

// Detectar si estamos en la ruta /admin
const isAdmin = window.location.pathname === "/admin";

root.render(
  <Providers>
    <div className="bg-neutral-50 text-base text-neutral-900 antialiased transition-colors selection:bg-blue-700 selection:text-white dark:bg-neutral-950 dark:text-neutral-100">
      {isAdmin ? <Admin /> : <App />}
    </div>
  </Providers>
);
