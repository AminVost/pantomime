import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger" | "ghost";
  wide?: boolean;
};

export function Button({ tone = "primary", wide = true, className = "", ...props }: Props) {
  return <button className={`btn btn-${tone} ${wide ? "btn-wide" : ""} ${className}`} {...props} />;
}
