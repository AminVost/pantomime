import { Button } from "./Button";

export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-handle" />
        <h2 id="modal-title">{title}</h2>
        <div className="modal-content">{children}</div>
        <Button tone="secondary" onClick={onClose}>بستن</Button>
      </section>
    </div>
  );
}
