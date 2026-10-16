import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
export function registerNativeBack() {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener("backButton", () => {
    window.dispatchEvent(new Event("pantomime:native-back", { cancelable: true }));
  });
  window.addEventListener("pantomime:native-exit", () => {
    void App.exitApp();
  });
}
