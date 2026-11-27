"use client";

import { Children, cloneElement, isValidElement, useId } from "react";

const fieldClass = "block space-y-1.5 text-sm text-text-soft";

/**
 * A label linked to its single control by id, so the control's accessible name is exactly the
 * label text (a control nested inside its label would add its own value to the name).
 */
export function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  const generated = useId();
  const child = Children.only(children);
  if (!isValidElement<{ id?: string }>(child)) return null;
  const id = child.props.id ?? generated;
  return (
    <div className={fieldClass}>
      <label htmlFor={id} className="block">
        {label}
      </label>
      {cloneElement(child, { id })}
    </div>
  );
}
