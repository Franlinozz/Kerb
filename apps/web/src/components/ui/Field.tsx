"use client";
import { useId } from "react";

/** Numeric field: right-aligned tabular input, unit suffix, Max chip, helper and error lines. */
export function Field({ label, value, onChange, unit, onMax, help, error, placeholder = "0.00", inputMode = "decimal", align = "right", name }: {
  label: string; value: string; onChange: (v: string) => void; unit?: string; onMax?: () => void;
  help?: React.ReactNode; error?: string | null; placeholder?: string; inputMode?: "decimal" | "text"; align?: "right" | "left"; name?: string;
}): React.ReactElement {
  const id = useId();
  return (
    <div className="fld" data-invalid={error ? "true" : undefined}>
      <label className="fld-label" htmlFor={id}>{label}</label>
      <div className="fld-box">
        <input
          id={id} name={name} value={value} placeholder={placeholder} inputMode={inputMode} autoComplete="off" spellCheck={false}
          className={align === "left" ? "left" : undefined}
          aria-invalid={error ? true : undefined} aria-describedby={help || error ? `${id}-d` : undefined}
          onChange={(e) => onChange(inputMode === "decimal" ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)}
        />
        {unit ? <span className="fld-unit">{unit}</span> : null}
        {onMax ? <button type="button" className="fld-max" onClick={onMax}>MAX</button> : null}
      </div>
      {error ? <div id={`${id}-d`} className="fld-error" role="alert">{error}</div> : help ? <div id={`${id}-d`} className="fld-help">{help}</div> : null}
    </div>
  );
}
