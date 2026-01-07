import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../styles/index.css";

// Create root after DOM is loaded
const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
