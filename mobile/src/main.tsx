import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/vazirmatn/index.css";
import "../generated/globals.css";
import "./mobile.css";
import { PersonalLibrary } from "./PersonalLibrary";
import { GameApp } from "../generated/components/game/GameApp";
import { registerNativeBack } from "./native-back";
document.documentElement.style.setProperty("--font-vazirmatn", '"Vazirmatn Variable"');
registerNativeBack();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><GameApp renderPersonalLibrary={onClose => <PersonalLibrary onClose={onClose} />} /></React.StrictMode>
);
