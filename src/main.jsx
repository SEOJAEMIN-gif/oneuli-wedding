import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

document.body.style.margin = "0";
document.documentElement.style.background = "#ffffff";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
