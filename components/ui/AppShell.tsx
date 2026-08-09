import { AmbientBackground } from "./AmbientBackground";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="app-root">
      <AmbientBackground />
      <section className="app-shell">{children}</section>
    </main>
  );
}
