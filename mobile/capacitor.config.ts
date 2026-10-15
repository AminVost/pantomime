import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "ir.aminvost.pantomime",
  appName: "پانتومین",
  webDir: "dist",
  backgroundColor: "#f6f3ef",
  android: { allowMixedContent: false, backgroundColor: "#f6f3ef" },
  server: { androidScheme: "https" }
};
export default config;
