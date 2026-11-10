"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: IconName;
  trailing?: ReactNode;
  shortcut?: ReactNode;
  size?: "sm" | "md";
}

export function Input({ label, hint, error, icon, trailing, shortcut, size = "md", disabled, id, className = "", style, ...rest }: InputProps) {
  const auto = useId();
  const fid = id || auto;
  const wrap = ["pc-inputwrap", size === "sm" ? "pc-inputwrap--sm" : "", error ? "is-error" : "", disabled ? "is-disabled" : ""].filter(Boolean).join(" ");
  return (
    <div className={"pc-field " + className} style={style}>
      {label ? <label className="pc-label" htmlFor={fid}>{label}</label> : null}
      <div className={wrap}>
        {icon ? <Icon name={icon} size={size === "sm" ? 15 : 17} /> : null}
        <input id={fid} className="pc-input" disabled={disabled} aria-invalid={!!error || undefined} {...rest} />
        {shortcut ? <span className="pc-kbd">{shortcut}</span> : null}
        {trailing}
      </div>
      {error ? <span className="pc-hint pc-hint--error">{error}</span> : hint ? <span className="pc-hint">{hint}</span> : null}
    </div>
  );
}
