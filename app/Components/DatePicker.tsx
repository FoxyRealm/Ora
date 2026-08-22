"use client";

import { CalendarDays, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  ariaLabel?: string;
};

function fromValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return value ? new Date(year, month - 1, day, 12) : new Date();
}

function toValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayValue(value: string) {
  return value
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(fromValue(value))
    : "Choose a date";
}

export default function DatePicker({ label, value, onChange, min, max, ariaLabel }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerId = useRef(`finance-date-${label}`);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [month, setMonth] = useState(() => {
    const initial = fromValue(value);
    return new Date(initial.getFullYear(), initial.getMonth(), 1, 12);
  });
  useEffect(() => {
    const close = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== pickerId.current) setOpen(false);
    };
    window.addEventListener("ora-picker-open", close);
    return () => window.removeEventListener("ora-picker-open", close);
  }, []);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
  function toggle() {
    if (!open && triggerRef.current) {
      const selected = fromValue(value);
      setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
      window.dispatchEvent(new CustomEvent("ora-picker-open", { detail: pickerId.current }));
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 6 + 340 > window.innerHeight ? Math.max(8, rect.top - 346) : rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)),
      });
    }
    setOpen((current) => !current);
  }
  const popover = open && typeof document !== "undefined"
    ? createPortal(
      <div className="compact-picker-popover portal-picker-popover date-picker-popover finance-date-popover" style={position} role="dialog" aria-label={`${label} calendar`}>
        <header>
          <button className="icon-button" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))} aria-label="Previous month"><ChevronRight className="flip" size={16} /></button>
          <strong>{month.toLocaleDateString("en", { month: "long", year: "numeric" })}</strong>
          <button className="icon-button" type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))} aria-label="Next month"><ChevronRight size={16} /></button>
        </header>
        <div className="calendar-weekdays">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-days">{days.map((day) => {
          const iso = toValue(day);
          const outside = day.getMonth() !== month.getMonth();
          const disabled = Boolean((min && iso < min) || (max && iso > max));
          return <button className={`${iso === value ? "selected" : ""} ${outside ? "outside" : ""}`} type="button" key={iso} disabled={disabled} onClick={() => { onChange(iso); setOpen(false); }}>{day.getDate()}</button>;
        })}</div>
      </div>,
      document.body,
    )
    : null;
  return <div className="field compact-picker-field finance-date-picker"><span>{label}</span><button ref={triggerRef} type="button" className="picker-trigger" onClick={toggle} aria-label={ariaLabel ?? label} aria-expanded={open}><CalendarDays size={16} /><strong>{displayValue(value)}</strong><ChevronRight size={14} /></button>{popover}</div>;
}
