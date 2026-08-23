"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircleMore,
  Moon,
  PackageCheck,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Printer,
  ReceiptText,
  ScanLine,
  Send,
  Stethoscope,
  Sun,
  Truck,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import DentalReferenceChart from "../Components/DentalReferenceChart";
import { printInvoicePages } from "../Components/InvoicePrint";
import TablePagination, { useTablePagination } from "../Components/TablePagination";
import type {
  CaseServiceLine,
  Doctor,
  DoctorCaseAttachment,
  DeliveryTask,
  LabCase,
  OraData,
} from "./mock-data";

type DoctorPortalView = "dashboard" | "cases" | "delivery" | "invoices";
type RequestKind = "new-case" | "scan-appointment" | "pickup" | null;

interface DoctorPortalNotification {
  id: string;
  date: string;
  title: string;
  subject: string;
  caseId?: string;
  destination: "cases" | "delivery" | "invoices";
  tone: string;
}

function formatMoney(value: number, currency: OraData["currency"]) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}
function formatDate(value?: string) {
  return value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value}T12:00:00`))
    : "Not set";
}

function escapePrintHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printDoctorInvoices(
  data: OraData,
  doctor: Doctor,
  invoices: LabCase[],
) {
  if (!invoices.length) return false;
  return printInvoicePages(invoices.map((labCase) => {
      const serviceLines = labCase.serviceLines?.length
        ? labCase.serviceLines
        : [
            {
              service: labCase.service,
              units: labCase.units,
              shade: labCase.shade,
              unitPrice: labCase.price / Math.max(1, labCase.units),
            },
          ];
      const payments = data.payments
        .filter((payment) => payment.caseId === labCase.id)
        .sort((first, second) => first.date.localeCompare(second.date));
      const remaining = Math.max(0, labCase.price - labCase.paid);
      return { number: `INV-${labCase.caseNumber}`, status: invoiceStatus(labCase), brandTitle: data.branding.title, brandSubtitle: data.branding.subtitle, doctor: doctor.name, clinic: doctor.clinic, patient: labCase.patient || "Not recorded", issued: formatDate(labCase.receivedDate), caseNumber: labCase.caseNumber, services: serviceLines.map((line) => ({ service: line.service, shade: line.shade || "Not recorded", units: String(line.units), unitPrice: formatMoney(line.unitPrice, data.currency), amount: formatMoney(line.units * line.unitPrice, data.currency) })), payments: payments.map((payment) => ({ date: new Date(payment.date).toLocaleString("en-GB"), label: payment.amount < 0 ? "Payment correction" : "Payment received", amount: formatMoney(Math.abs(payment.amount), data.currency), negative: payment.amount < 0 })), total: formatMoney(labCase.price, data.currency), paid: formatMoney(labCase.paid, data.currency), balance: formatMoney(remaining, data.currency) };
    }));
}

function doctorPriceListRows(data: OraData, doctor: Doctor) {
  return data.serviceTypes.map((service) => ({
    service,
    price: Number(doctor.priceList[service] ?? 0),
  }));
}

function printDoctorPriceList(data: OraData, doctor: Doctor) {
  const rows = doctorPriceListRows(data, doctor)
    .map(
      ({ service, price }) => `<tr>
        <td>${escapePrintHtml(service)}</td>
        <td>${escapePrintHtml(formatMoney(price, data.currency))}</td>
        <td>per unit</td>
      </tr>`,
    )
    .join("");
  const popup = window.open("", "_blank", "width=820,height=900");
  if (!popup) return false;
  popup.document.write(`<!doctype html><html><head><title>${escapePrintHtml(doctor.name)} price list</title><style>
    *{box-sizing:border-box}body{margin:0;padding:38px;color:#17211f;font-family:Arial,sans-serif;font-size:12px}.head{display:flex;justify-content:space-between;gap:24px;padding-bottom:20px;border-bottom:2px solid #15695f}.brand{font-size:28px;font-weight:800;color:#15695f}.brand small,.meta small{display:block;margin-top:4px;color:#65726f;font-size:9px;letter-spacing:1px;text-transform:uppercase}.title{text-align:right}.title h1{margin:0;font-size:21px}.title p{margin:6px 0 0;color:#65726f}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}.meta div{padding:11px;border:1px solid #dce5e2;background:#f8fbfa}.meta strong{display:block;margin-top:5px;font-size:12px}table{width:100%;border-collapse:collapse}th{padding:10px;background:#edf4f2;color:#4e625e;text-align:left;font-size:9px;letter-spacing:.6px;text-transform:uppercase}th:nth-child(2),th:nth-child(3){text-align:right}td{padding:12px 10px;border-bottom:1px solid #dde7e4}td:nth-child(2){font-weight:800;text-align:right}td:nth-child(3){color:#65726f;text-align:right}.note{margin-top:24px;padding-top:12px;border-top:1px solid #dce5e2;color:#65726f;font-size:10px}@media print{body{padding:0}@page{margin:18mm}}</style></head><body><header class="head"><div class="brand">${escapePrintHtml(data.branding.title)}<small>${escapePrintHtml(data.branding.subtitle)}</small></div><div class="title"><h1>My price list</h1><p>Issued ${escapePrintHtml(formatDate(new Date().toISOString().slice(0, 10)))}</p></div></header><section class="meta"><div><small>Doctor</small><strong>${escapePrintHtml(doctor.name)}</strong></div><div><small>Clinic</small><strong>${escapePrintHtml(doctor.clinic)}</strong></div></section><table><thead><tr><th>Service</th><th>Unit price</th><th>Basis</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Prices are shown in ${escapePrintHtml(data.currency)} and are subject to the laboratory's current terms.</p><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),120));<\/script></body></html>`);
  popup.document.close();
  return true;
}

async function exportDoctorPriceListPdf(data: OraData, doctor: Doctor) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const rows = doctorPriceListRows(data, doctor);
  let y = 20;
  const drawHeader = () => {
    doc.setTextColor(21, 95, 87);
    doc.setFontSize(19);
    doc.text(data.branding.title, 16, y);
    doc.setTextColor(71, 91, 87);
    doc.setFontSize(9);
    doc.text(data.branding.subtitle, 16, y + 6);
    doc.setTextColor(25, 33, 31);
    doc.setFontSize(17);
    doc.text("My price list", pageWidth - 16, y, { align: "right" });
    doc.setFontSize(9);
    doc.setTextColor(86, 104, 99);
    doc.text(`Doctor: ${doctor.name}`, pageWidth - 16, y + 6, { align: "right" });
    doc.text(`Clinic: ${doctor.clinic}`, pageWidth - 16, y + 11, { align: "right" });
    y += 27;
    doc.setDrawColor(188, 210, 204);
    doc.line(16, y - 8, pageWidth - 16, y - 8);
    doc.setFillColor(237, 244, 242);
    doc.rect(16, y, pageWidth - 32, 8, "F");
    doc.setTextColor(71, 91, 87);
    doc.setFontSize(9);
    doc.text("SERVICE", 20, y + 5.3);
    doc.text("UNIT PRICE", pageWidth - 20, y + 5.3, { align: "right" });
    y += 14;
  };
  drawHeader();
  rows.forEach(({ service, price }) => {
    if (y > 273) {
      doc.addPage();
      y = 20;
      drawHeader();
    }
    doc.setTextColor(34, 45, 42);
    doc.setFontSize(10);
    const serviceLines = doc.splitTextToSize(service, pageWidth - 85);
    doc.text(serviceLines, 20, y);
    doc.setFontSize(10);
    doc.setTextColor(21, 95, 87);
    doc.text(`${formatMoney(price, data.currency)} / unit`, pageWidth - 20, y, { align: "right" });
    const rowHeight = Math.max(9, serviceLines.length * 5 + 4);
    doc.setDrawColor(222, 230, 227);
    doc.line(16, y + rowHeight - 4, pageWidth - 16, y + rowHeight - 4);
    y += rowHeight;
  });
  doc.setTextColor(101, 116, 112);
  doc.setFontSize(8);
  doc.text("Prices are shown per unit and are subject to the laboratory's current terms.", 16, 287);
  doc.save(`${doctor.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-price-list.pdf`);
}

function formatStatus(labCase: LabCase) {
  if (labCase.onHold) return "On hold";
  if (labCase.intakeApprovalPending) return "Awaiting Approval";
  if (labCase.deliveryStatus === "delivered") return "Delivered";
  if (labCase.deliveryStatus === "out_for_delivery") return "Out for delivery";
  if (labCase.status === "Closed") return "Done";
  return labCase.status;
}
function doctorStatusTone(labCase: LabCase) {
  const status = formatStatus(labCase);
  const tones: Record<string, string> = {
    "Awaiting Approval": "awaiting",
    "On hold": "on-hold",
    Received: "received",
    Approved: "approved",
    Casting: "casting",
    Design: "design",
    Printing: "printing",
    Production: "production",
    Finishing: "finishing",
    "Build Up": "build-up",
    Glazing: "glazing",
    "Quality Review": "review",
    Done: "closed",
    Closed: "closed",
    "Out for delivery": "delivery",
    Delivered: "delivered",
  };
  return tones[status] ?? "received";
}
function invoiceStatus(labCase: LabCase) {
  if (labCase.paid <= 0)
    return labCase.dueDate < new Date().toISOString().slice(0, 10)
      ? "Overdue"
      : "Sent";
  if (labCase.paid < labCase.price) return "Partial";
  return "Paid";
}
function ServiceSummary({ labCase, className }: { labCase: LabCase; className?: string }) {
  const lines = labCase.serviceLines?.length
    ? labCase.serviceLines
    : [{ service: labCase.service, units: labCase.units }];
  return (
    <span className={className} title={className ? lines.map((line) => line.service).join(", ") : undefined}>
      {lines[0].service} ({lines[0].units} unit{lines[0].units === 1 ? "" : "s"}
      ){lines.length > 1 ? ` +${lines.length - 1} more` : ""}
    </span>
  );
}

function toISODate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function PortalDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerId = useRef(`portal-date:${label}`);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const [month, setMonth] = useState(
    new Date(initial.getFullYear(), initial.getMonth(), 1, 12),
  );
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
  useEffect(() => {
    const close = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== pickerId.current)
        setOpen(false);
    };
    window.addEventListener("ora-picker-open", close);
    return () => window.removeEventListener("ora-picker-open", close);
  }, []);
  function toggle() {
    if (!open && triggerRef.current) {
      window.dispatchEvent(
        new CustomEvent("ora-picker-open", { detail: pickerId.current }),
      );
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top:
          rect.bottom + 346 > window.innerHeight
            ? Math.max(8, rect.top - 346)
            : rect.bottom + 6,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)),
      });
    }
    setOpen((current) => !current);
  }
  const popover = open
    ? createPortal(
        <div
          className="compact-picker-popover portal-picker-popover date-picker-popover"
          style={position}
        >
          <header>
            <button
              className="icon-button"
              type="button"
              onClick={() =>
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() - 1, 1, 12),
                )
              }
              aria-label="Previous month"
            >
              <ChevronRight className="flip" size={16} />
            </button>
            <strong>
              {month.toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              className="icon-button"
              type="button"
              onClick={() =>
                setMonth(
                  new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
                )
              }
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </header>
          <div className="calendar-weekdays">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((day) => {
              const iso = toISODate(day);
              return (
                <button
                  className={`${iso === value ? "selected" : ""} ${day.getMonth() !== month.getMonth() ? "outside" : ""}`}
                  type="button"
                  key={iso}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
          <button
            className="text-button picker-today"
            type="button"
            onClick={() => {
              const today = toISODate(new Date());
              onChange(today);
              setMonth(new Date());
              setOpen(false);
            }}
          >
            Today
          </button>
        </div>,
        document.body,
      )
    : null;
  return (
    <div className="doctor-picker-field">
      <span>{label}</span>
      <button
        ref={triggerRef}
        className="picker-trigger"
        type="button"
        onClick={toggle}
        aria-expanded={open}
      >
        <CalendarDays size={16} />
        <strong>{value ? formatDate(value) : "Choose a date"}</strong>
        <ChevronRight size={14} />
      </button>
      {popover}
    </div>
  );
}

function PortalTimePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerId = useRef(`portal-time:${label}`);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [hour, setHour] = useState(value.slice(0, 2));
  const [minute, setMinute] = useState(value.slice(3, 5));
  useEffect(() => {
    const close = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== pickerId.current)
        setOpen(false);
    };
    window.addEventListener("ora-picker-open", close);
    return () => window.removeEventListener("ora-picker-open", close);
  }, []);
  function toggle() {
    if (!open && triggerRef.current) {
      window.dispatchEvent(
        new CustomEvent("ora-picker-open", { detail: pickerId.current }),
      );
      setHour(value.slice(0, 2));
      setMinute(value.slice(3, 5));
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top:
          rect.bottom + 220 > window.innerHeight
            ? Math.max(8, rect.top - 226)
            : rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - 250, window.innerWidth - 258)),
      });
    }
    setOpen((current) => !current);
  }
  const popover = open
    ? createPortal(
        <div
          className="compact-picker-popover portal-picker-popover time-picker-popover"
          style={position}
        >
          <strong>24-hour time</strong>
          <div>
            <label>
              <span>Hour</span>
              <select
                value={hour}
                onChange={(event) => setHour(event.target.value)}
              >
                {Array.from({ length: 24 }, (_, index) =>
                  String(index).padStart(2, "0"),
                ).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <b>:</b>
            <label>
              <span>Minute</span>
              <input
                aria-label="Minute"
                inputMode="numeric"
                maxLength={2}
                pattern="[0-5][0-9]"
                placeholder="00"
                value={minute}
                onChange={(event) =>
                  setMinute(event.target.value.replace(/\D/g, "").slice(0, 2))
                }
              />
            </label>
          </div>
          <div className="picker-actions">
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              className="primary-button compact"
              type="button"
              onClick={() => {
                const parsedMinute = Number(minute || "0");
                onChange(`${hour}:${String(Math.min(59, parsedMinute)).padStart(2, "0")}`);
                setOpen(false);
              }}
            >
              Set time
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;
  return (
    <div className="doctor-picker-field">
      <span>{label}</span>
      <button
        ref={triggerRef}
        className="picker-trigger time-trigger"
        type="button"
        onClick={toggle}
        aria-expanded={open}
      >
        <Clock3 size={16} />
        <strong>{value || "Choose a time"}</strong>
        <ChevronRight size={14} />
      </button>
      {popover}
    </div>
  );
}

function AttachmentPreview({
  attachment,
}: {
  attachment: DoctorCaseAttachment;
}) {
  if (attachment.type.startsWith("image/"))
    return (
      <a
        className="doctor-file-preview image"
        href={attachment.dataUrl}
        target="_blank"
        rel="noreferrer"
      >
        <Image
          src={attachment.dataUrl}
          alt={attachment.name}
          width={320}
          height={220}
          unoptimized
        />
        <span>{attachment.name}</span>
      </a>
    );
  if (attachment.type.startsWith("video/"))
    return (
      <div className="doctor-file-preview video">
        <video src={attachment.dataUrl} controls preload="metadata" />
        <span>{attachment.name}</span>
      </div>
    );
  return (
    <a
      className="doctor-file-chip"
      href={attachment.dataUrl}
      download={attachment.name}
      target="_blank"
      rel="noreferrer"
    >
      <Paperclip size={14} />
      <span>
        <strong>{attachment.name}</strong>
        <small>{Math.max(1, Math.round(attachment.size / 1024))} KB</small>
      </span>
    </a>
  );
}

function InvoiceDrawer({
  data,
  doctor,
  labCase,
  onClose,
  onAccept,
}: {
  data: OraData;
  doctor: Doctor;
  labCase: LabCase;
  onClose: () => void;
  onAccept: (caseIds: string[]) => void;
}) {
  const payments = data.payments
    .filter((payment) => payment.caseId === labCase.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const remaining = Math.max(0, labCase.price - labCase.paid);
  return (
    <div
      className="doctor-portal-drawer-backdrop"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <aside
        className="doctor-portal-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Invoice ${labCase.caseNumber}`}
      >
        <header>
          <div>
            <span>Invoice</span>
            <h2>INV-{labCase.caseNumber}</h2>
          </div>
          <button
            className="portal-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close invoice"
          >
            <X size={18} />
          </button>
        </header>
        <section className="doctor-invoice-amount">
          <small>Balance due</small>
          <strong>{formatMoney(remaining, data.currency)}</strong>
          <span
            className={`doctor-invoice-status ${invoiceStatus(labCase).toLowerCase()}`}
          >
            {invoiceStatus(labCase)}
          </span>
        </section>
        <section className="doctor-invoice-detail-grid">
          <div>
            <small>Doctor</small>
            <strong>{doctor.name}</strong>
          </div>
          <div>
            <small>Patient</small>
            <strong>{labCase.patient}</strong>
          </div>
          <div>
            <small>Issued</small>
            <strong>{formatDate(labCase.receivedDate)}</strong>
          </div>
          <div>
            <small>Case</small>
            <strong>{labCase.caseNumber}</strong>
          </div>
        </section>
        <section className="doctor-invoice-services">
          <h3>Services</h3>
          <div>
            <span>
              <ServiceSummary labCase={labCase} />
            </span>
            <strong>{formatMoney(labCase.price, data.currency)}</strong>
          </div>
          <footer>
            <span>Total</span>
            <strong>{formatMoney(labCase.price, data.currency)}</strong>
          </footer>
        </section>
        <section className="doctor-invoice-payments">
          <h3>Payment history</h3>
          {payments.map((payment) => (
            <div key={payment.id}>
              <span>
                <strong>
                  {payment.amount < 0
                    ? "Payment correction"
                    : "Payment received"}
                </strong>
                <small>{new Date(payment.date).toLocaleString("en-GB")}</small>
              </span>
              <b>
                {payment.amount < 0 ? "-" : "+"}
                {formatMoney(Math.abs(payment.amount), data.currency)}
              </b>
            </div>
          ))}
          {!payments.length && (
            <p>No payment has been recorded for this invoice yet.</p>
          )}
        </section>
        <footer className="doctor-drawer-actions">
          {labCase.invoiceAcceptedAt ? (
            <span className="doctor-invoice-accepted">
              <Check size={16} />
              Invoice accepted
            </span>
          ) : (
            <button
              className="doctor-primary-button"
              type="button"
              onClick={() => onAccept([labCase.id])}
            >
              <Check size={16} />
              Accept invoice
            </button>
          )}
          <button
            className="portal-secondary-button"
            type="button"
            onClick={() => printDoctorInvoices(data, doctor, [labCase])}
          >
            <Printer size={16} />
            Print invoice
          </button>
        </footer>
      </aside>
    </div>
  );
}

function DoctorPriceListDrawer({
  data,
  doctor,
  approvedAt,
  onClose,
  onApprove,
}: {
  data: OraData;
  doctor: Doctor;
  approvedAt: string | null;
  onClose: () => void;
  onApprove: () => void;
}) {
  const rows = doctorPriceListRows(data, doctor);
  return (
    <div
      className="doctor-portal-drawer-backdrop"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <aside
        className="doctor-portal-drawer doctor-price-list-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="My price list"
      >
        <header>
          <div>
            <span>Billing</span>
            <h2>My price list</h2>
          </div>
          <button
            className="portal-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close price list"
          >
            <X size={18} />
          </button>
        </header>
        <section className="doctor-price-list-summary">
          <FileText size={18} />
          <div>
            <strong>{doctor.name}</strong>
            <small>{doctor.clinic}</small>
          </div>
          <span>{data.currency}</span>
        </section>
        <section className="doctor-price-list-table" aria-label="Service prices">
          <header>
            <span>Service</span>
            <span>Unit price</span>
          </header>
          {rows.map(({ service, price }) => (
            <div key={service}>
              <strong title={service}>{service}</strong>
              <span>{formatMoney(price, data.currency)} / unit</span>
            </div>
          ))}
        </section>
        <p className="doctor-price-list-note">
          Prices are shown per unit and follow Ora&apos;s current laboratory terms.
        </p>
        <footer className="doctor-drawer-actions doctor-price-list-actions">
          {approvedAt ? (
            <span className="doctor-invoice-accepted">
              <Check size={16} /> One-time approval recorded
            </span>
          ) : (
            <button className="doctor-primary-button" type="button" onClick={onApprove}>
              <Check size={16} /> Approve for one time only
            </button>
          )}
          <button
            className="portal-secondary-button"
            type="button"
            onClick={() => printDoctorPriceList(data, doctor)}
          >
            <Printer size={16} /> Print
          </button>
          <button
            className="portal-secondary-button"
            type="button"
            onClick={() => void exportDoctorPriceListPdf(data, doctor)}
          >
            <Download size={16} /> Export PDF
          </button>
        </footer>
      </aside>
    </div>
  );
}

function CaseConversationDrawer({
  labCase,
  onClose,
  onSend,
}: {
  labCase: LabCase;
  onClose: () => void;
  onSend: (text: string, attachments: DoctorCaseAttachment[]) => void;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<DoctorCaseAttachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const productionWorkflow =
    labCase.impressionType === "Physical Impression"
      ? [
          "Received",
          "Casting",
          "Approved",
          "Design",
          "Production",
          "Finishing",
          "Build Up",
          "Glazing",
          "Quality Review",
          "Closed",
        ]
      : [
          "Received",
          "Approved",
          "Design",
          "Production",
          "Printing",
          "Finishing",
          "Build Up",
          "Glazing",
          "Quality Review",
          "Closed",
        ];
  const workflow = [
    ...productionWorkflow.map((stage) =>
      stage === "Closed" ? "Done" : stage,
    ),
    "Out for delivery",
    "Delivered",
  ];
  const currentWorkflowStage =
    labCase.deliveryStatus === "delivered"
      ? "Delivered"
      : labCase.deliveryStatus === "out_for_delivery"
        ? "Out for delivery"
        : labCase.status === "Closed"
          ? "Done"
          : labCase.status;
  const currentIndex = workflow.indexOf(currentWorkflowStage);
  function readFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(0, 5);
    Promise.all(
      files.map(
        (file) =>
          new Promise<DoctorCaseAttachment>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `file-${Date.now()}-${file.name}`,
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                dataUrl: String(reader.result),
              });
            reader.readAsDataURL(file);
          }),
      ),
    ).then((items) =>
      setAttachments((current) => [...current, ...items].slice(0, 5)),
    );
    event.target.value = "";
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!text.trim() && !attachments.length) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
  }
  return (
    <div
      className="doctor-portal-drawer-backdrop"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <aside
        className="doctor-portal-drawer doctor-case-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Case ${labCase.caseNumber}`}
      >
        <header>
          <div>
            <span>Case {labCase.caseNumber}</span>
            <h2>{labCase.patient}</h2>
            <p>
              {labCase.intakeApprovalPending
                ? "Awaiting lab approval"
                : formatStatus(labCase)}
            </p>
          </div>
          <button
            className="portal-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close case"
          >
            <X size={18} />
          </button>
        </header>
        <section className="doctor-case-details">
          <div>
            <small>Service</small>
            <strong>
              <ServiceSummary labCase={labCase} />
            </strong>
          </div>
          <div>
            <small>Due</small>
            <strong>
              {formatDate(labCase.dueDate)} · {labCase.dueTime}
            </strong>
          </div>
          <div>
            <small>Impression</small>
            <strong>{labCase.impressionType}</strong>
          </div>
        </section>
        <section className="doctor-case-workflow">
          <div className="section-title">
            <span>
              <Gauge size={17} />
              Workflow
            </span>
            <em className={doctorStatusTone(labCase)}>
              {formatStatus(labCase)}
            </em>
          </div>
          <div
            className="workflow-steps doctor-workflow-steps"
            style={{
              gridTemplateColumns: `repeat(${workflow.length}, minmax(70px, 1fr))`,
            }}
          >
            {workflow.map((stage, index) => (
              <button
                type="button"
                tabIndex={-1}
                aria-disabled="true"
                className={`${index < currentIndex ? "done" : ""} ${stage === currentWorkflowStage ? "current" : ""}`}
                key={stage}
              >
                <span>{index < currentIndex ? <Check size={13} /> : index + 1}</span>
                <small>{stage}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="doctor-conversation">
          <header>
            <div>
              <span>
                <MessageCircleMore size={17} />
                Conversation
              </span>
              <p>Visible to the Ora lab team.</p>
            </div>
          </header>
          <div className="doctor-conversation-list">
            {(labCase.doctorMessages ?? []).map((message) => (
              <article key={message.id} className={message.author}>
                <header>
                  <strong>{message.authorName}</strong>
                  <small>
                    {new Date(message.createdAt).toLocaleString("en-GB")}
                  </small>
                </header>
                {message.text && <p>{message.text}</p>}
                {message.attachments.length > 0 && (
                  <div className="doctor-conversation-files">
                    {message.attachments.map((attachment) => (
                      <AttachmentPreview
                        key={attachment.id}
                        attachment={attachment}
                      />
                    ))}
                  </div>
                )}
              </article>
            ))}
            {!labCase.doctorMessages?.length && (
              <p className="doctor-empty">
                Ask the lab a question or attach case files here.
              </p>
            )}
          </div>
          <form className="doctor-message-form" onSubmit={submit}>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.stl,.ply"
              hidden
              onChange={readFiles}
            />
            {attachments.length > 0 && (
              <div className="doctor-uploaded-files">
                {attachments.map((attachment) => (
                  <span key={attachment.id}>
                    {attachment.name}
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((item) => item.id !== attachment.id),
                        )
                      }
                      aria-label={`Remove ${attachment.name}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
             
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                window.requestAnimationFrame(() => {
                  const element = textareaRef.current;
                  if (!element) return;
                  element.style.height = "auto";
                  element.style.height = `${Math.min(element.scrollHeight, 150)}px`;
                });
              }}
              placeholder="Write a message to Ora..."
              rows={1}
            />
            <div className="doctor-message-tools">
              <div>
                <button
                  type="button"
                  className="portal-icon-button"
                  onClick={() => fileInput.current?.click()}
                  aria-label="Attach files"
                  title="Attach files"
                >
                  <Paperclip size={17} />
                </button>
              </div>
              <button
                className="doctor-primary-button doctor-send-icon"
                type="submit"
                aria-label="Send message"
                title="Send message"
              >
                <Send size={15} />
              </button>
            </div>
          </form>
        </section>
      </aside>
    </div>
  );
}

function PortalRequestModal({
  kind,
  doctor,
  data,
  onClose,
  onRequest,
}: {
  kind: Exclude<RequestKind, null>;
  doctor: Doctor;
  data: OraData;
  onClose: () => void;
  onRequest: (
    kind: Exclude<RequestKind, null>,
    fields: Record<string, string>,
  ) => void;
}) {
  const isCase = kind === "new-case";
  const isScan = kind === "scan-appointment";
  const title = isCase
    ? "Send a new oral scan"
    : isScan
      ? "Request an oral scan appointment"
      : "Ask for a delivery";
  const subtitle = isCase
    ? "Send case details to Ora for review before production starts."
    : isScan
      ? "Ask Ora to visit your clinic with the oral scan device."
      : "Ask Ora to collect a physical impression from your clinic.";
  const clinic = data.clinicProfiles[doctor.clinic];
  const registeredAddress =
    doctor.address?.trim() || clinic?.address?.trim() || "";
  const [step, setStep] = useState(0);
  const [patient, setPatient] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [pickupTiming, setPickupTiming] = useState<
    "asap" | "scheduled" | null
  >(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [requestError, setRequestError] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(registeredAddress);
  const [editingDeliveryAddress, setEditingDeliveryAddress] = useState(
    !registeredAddress,
  );
  const [lines, setLines] = useState([
    {
      id: "portal-service-1",
      service: data.serviceTypes[0] ?? "Zirconia Crown",
      units: "1",
      shade: "",
    },
  ]);
  const [attachments, setAttachments] = useState<DoctorCaseAttachment[]>([]);
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [toothConnections, setToothConnections] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const deliveryAddressInput = useRef<HTMLInputElement>(null);
  const reviewReached = useRef(false);
  const steps = ["Case details", "Appointment", "Notes & files", "Review"];
  const updateLine = (id: string, values: Partial<(typeof lines)[number]>) =>
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...values } : line)),
    );
  const toggleTooth = (tooth: string) => {
    const nextTeeth = selectedTeeth.includes(tooth)
      ? selectedTeeth.filter((item) => item !== tooth)
      : [...selectedTeeth, tooth];
    setSelectedTeeth(nextTeeth);
    setToothConnections((current) =>
      current.filter((connection) =>
        connection.split(":").every((item) => nextTeeth.includes(item)),
      ),
    );
    setLines((current) =>
      current.map((line, index) =>
        index === 0
          ? { ...line, units: String(Math.max(1, nextTeeth.length)) }
          : line,
      ),
    );
  };
  const toggleConnection = (first: string, second: string) => {
    if (!selectedTeeth.includes(first) || !selectedTeeth.includes(second)) return;
    const key = [first, second].sort().join(":");
    setToothConnections((current) =>
      current.includes(key)
        ? current.filter((connection) => connection !== key)
        : [...current, key],
    );
  };
  function readFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(
      0,
      Math.max(0, 5 - attachments.length),
    );
    Promise.all(
      files.map(
        (file) =>
          new Promise<DoctorCaseAttachment>((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `file-${Date.now()}-${file.name}`,
                name: file.name,
                type: file.type || "application/octet-stream",
                size: file.size,
                dataUrl: String(reader.result),
              });
            reader.readAsDataURL(file);
          }),
      ),
    ).then((items) =>
      setAttachments((current) => [...current, ...items].slice(0, 5)),
    );
    event.target.value = "";
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCase && (step !== steps.length - 1 || !reviewReached.current)) {
      advanceStep(event.currentTarget);
      return;
    }
    if (
      !isCase &&
      !isScan &&
      (!pickupTiming || (pickupTiming === "scheduled" && (!pickupDate || !pickupTime)))
    ) {
      setRequestError("Choose whether this is as soon as possible or set both a requested date and time.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const fields = Object.fromEntries(
      [...form.entries()].map(([key, value]) => [key, String(value)]),
    );
    if (isCase) {
      fields.serviceLines = JSON.stringify(
        lines.map((line) => ({
          service: line.service,
          units: Math.max(1, Number(line.units) || 1),
          shade: line.shade || "Not recorded",
        })),
      );
      fields.appointmentDate = appointmentDate;
      fields.appointmentTime = appointmentTime;
      fields.attachments = JSON.stringify(attachments);
      fields.teeth = JSON.stringify(selectedTeeth);
      fields.toothConnections = JSON.stringify(toothConnections);
    } else if (!isScan) {
      fields.timingMode = pickupTiming ?? "";
      fields.scheduledDate = pickupDate;
      fields.scheduledTime = pickupTime;
    }
    onRequest(kind, fields);
  }
  function advanceStep(form: HTMLFormElement) {
    setRequestError("");
    const section = form.querySelector<HTMLElement>(
      `[data-doctor-wizard-step="${step}"]`,
    );
    const requiredControls = Array.from(
      section?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[required]",
      ) ?? [],
    );
    const invalid = requiredControls.find((control) => !control.checkValidity());
    if (invalid) {
      setRequestError("Complete the required fields before continuing.");
      invalid.reportValidity();
      return;
    }
    if (
      step === 0 &&
      (!patient.trim() ||
        lines.some((line) => !line.service || Number(line.units) < 1))
    ) {
      setRequestError("Add the patient details and at least one service before continuing.");
      return;
    }
    if (isCase && step === 1 && (!appointmentDate || !appointmentTime)) {
      setRequestError("Choose both the appointment date and time before continuing.");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("ora-picker-open", { detail: "__close__" }),
    );
    if (step === steps.length - 2) reviewReached.current = true;
    setStep((current) => Math.min(steps.length - 1, current + 1));
  }
  return (
    <div
      className="doctor-request-backdrop"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section
        className={`doctor-request-modal ${isCase ? "doctor-case-request-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <span>{isCase ? "Case request" : "Delivery request"}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button
            className="portal-icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close request"
          >
            <X size={18} />
          </button>
        </header>
        <form onSubmit={submit}>
          {isCase && (
            <div className="doctor-request-steps">
              {steps.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={
                    index === step ? "active" : index < step ? "done" : ""
                  }
                  disabled={index > step}
                  onClick={() => index < step && setStep(index)}
                >
                  <span>{index < step ? <Check size={12} /> : index + 1}</span>
                  <strong>{item}</strong>
                </button>
              ))}
            </div>
          )}
          <div className="doctor-request-grid">
            {isCase && (
              <>
                <section
                  className="doctor-wizard-section"
                  data-doctor-wizard-step="0"
                  hidden={step !== 0}
                >
                  <label className="span-2">
                    <span>Patient name / initials</span>
                    <input
                      name="patient"
                      value={patient}
                      onChange={(event) => setPatient(event.target.value)}
                      placeholder="e.g. M. A."
                      required
                    />
                  </label>
                  <div className="doctor-oral-scan-details">
                    <div className="doctor-oral-scan-teeth">
                      <DentalReferenceChart
                        selectedTeeth={selectedTeeth}
                        toothConnections={toothConnections}
                        onToggleTooth={toggleTooth}
                        onToggleConnection={toggleConnection}
                      />
                    </div>
                    <div className="doctor-oral-scan-services">
                  <div className="doctor-service-lines">
                    {lines.map((line, index) => (
                      <article key={line.id}>
                        <header>
                          <strong>Service {index + 1}</strong>
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setLines((current) =>
                                  current.filter((item) => item.id !== line.id),
                                )
                              }
                              aria-label={`Remove service ${index + 1}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </header>
                        <div>
                          <label>
                            <span>Service type</span>
                            <select
                              value={line.service}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  service: event.target.value,
                                })
                              }
                            >
                              {data.serviceTypes.map((service) => (
                                <option key={service}>{service}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Teeth / units</span>
                            <input
                              type="number"
                              min="1"
                              value={line.units}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  units: event.target.value,
                                })
                              }
                              required
                            />
                          </label>
                          <label>
                            <span>Shade</span>
                            <input
                              value={line.shade}
                              onChange={(event) =>
                                updateLine(line.id, {
                                  shade: event.target.value,
                                })
                              }
                              placeholder="A2 / BL2"
                            />
                          </label>
                        </div>
                      </article>
                    ))}
                  </div>
                  <button
                    className="doctor-add-service"
                    type="button"
                    onClick={() =>
                      setLines((current) => [
                        ...current,
                        {
                          id: `portal-service-${Date.now()}`,
                          service: data.serviceTypes[0] ?? "Zirconia Crown",
                          units: "1",
                          shade: "",
                        },
                      ])
                    }
                  >
                    <Plus size={16} />
                    Add another service
                  </button>
                    </div>
                  </div>
                </section>
                <section
                  className="doctor-wizard-section"
                  data-doctor-wizard-step="1"
                  hidden={step !== 1}
                >
                  <div className="doctor-appointment-pickers">
                    <PortalDatePicker
                      label="Appointment date"
                      value={appointmentDate}
                      onChange={setAppointmentDate}
                    />
                    <PortalTimePicker
                      label="Appointment time"
                      value={appointmentTime}
                      onChange={setAppointmentTime}
                    />
                  </div>
                </section>
                <section
                  className="doctor-wizard-section"
                  data-doctor-wizard-step="2"
                  hidden={step !== 2}
                >
                  <label className="span-2">
                    <span>Notes</span>
                    <textarea
                      name="note"
                     
                      placeholder="Important details for the Ora team..."
                      rows={4}
                    />
                  </label>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.stl,.ply"
                    hidden
                    onChange={readFiles}
                  />
                  <section className="doctor-case-upload">
                    <div>
                      <strong>Case files</strong>
                      <small>
                        Photos, videos, scans, STL, PLY, PDF, or documents.
                      </small>
                    </div>
                    <button
                      className="portal-secondary-button"
                      type="button"
                      onClick={() => fileInput.current?.click()}
                    >
                      <Paperclip size={16} />
                      Upload files
                    </button>
                  </section>
                  {attachments.length > 0 && (
                    <div className="doctor-uploaded-files doctor-request-files">
                      {attachments.map((attachment) => (
                        <span key={attachment.id}>
                          {attachment.name}
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments((current) =>
                                current.filter(
                                  (item) => item.id !== attachment.id,
                                ),
                              )
                            }
                            aria-label={`Remove ${attachment.name}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </section>
                <section
                  className="doctor-wizard-section"
                  data-doctor-wizard-step="3"
                  hidden={step !== 3}
                >
                  <div className="doctor-request-review">
                    <section>
                      <small>Patient</small>
                      <strong>{patient || "Not entered"}</strong>
                    </section>
                    <section>
                      <small>Services</small>
                      <strong>
                        {lines
                          .map((line) => `${line.service} (${line.units})`)
                          .join(", ")}
                      </strong>
                    </section>
                    <section>
                      <small>Selected teeth</small>
                      <strong>{selectedTeeth.length || "None selected"}</strong>
                    </section>
                    <section>
                      <small>Appointment</small>
                      <strong>
                        {formatDate(appointmentDate)} at {appointmentTime}
                      </strong>
                    </section>
                    <section>
                      <small>Files attached</small>
                      <strong>{attachments.length || "No"}</strong>
                    </section>
                  </div>
                </section>
              </>
            )}
            {!isCase && (
              <>
                {isScan ? (
                  <label className="span-2">
                    <span>Scan location</span>
                    <input
                      name="address"
                      defaultValue={registeredAddress}
                      placeholder="Clinic address"
                      required
                    />
                  </label>
                ) : (
                  <div className="doctor-request-field span-2">
                    <span>Pickup location</span>
                    <div className="doctor-address-control">
                      <input
                        ref={deliveryAddressInput}
                        name="address"
                        value={deliveryAddress}
                        readOnly={!editingDeliveryAddress}
                        onChange={(event) =>
                          setDeliveryAddress(event.target.value)
                        }
                        placeholder="Enter the pickup address"
                        required
                      />
                      {registeredAddress && (
                        <button
                          className="portal-secondary-button"
                          type="button"
                          onClick={() => {
                            if (editingDeliveryAddress) {
                              setDeliveryAddress(registeredAddress);
                              setEditingDeliveryAddress(false);
                              return;
                            }
                            setEditingDeliveryAddress(true);
                            window.setTimeout(
                              () => deliveryAddressInput.current?.focus(),
                              0,
                            );
                          }}
                        >
                          {editingDeliveryAddress
                            ? "Use registered"
                            : "Change address"}
                        </button>
                      )}
                    </div>
                    <small>
                      {editingDeliveryAddress
                        ? registeredAddress
                          ? "Enter a different address for this request only."
                          : "No registered clinic address was found."
                        : "Using the registered clinic address."}
                    </small>
                  </div>
                )}
                {isScan ? (
                  <>
                    <label>
                      <span>Requested date</span>
                      <input
                        name="scheduledDate"
                        type="date"
                        defaultValue=""
                        required
                      />
                    </label>
                    <label>
                      <span>Requested time</span>
                      <input
                        name="scheduledTime"
                        type="time"
                      defaultValue=""
                        step="900"
                        required
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className="doctor-request-field doctor-pickup-timing span-2">
                      <span>When should Ora collect it?</span>
                      <div className="doctor-timing-options">
                        <button
                          type="button"
                          className={pickupTiming === "asap" ? "selected" : ""}
                          aria-pressed={pickupTiming === "asap"}
                          onClick={() => {
                            setPickupTiming("asap");
                            window.dispatchEvent(
                              new CustomEvent("ora-picker-open", {
                                detail: "__close__",
                              }),
                            );
                          }}
                        >
                          <Clock3 size={17} />
                          <span>
                            <strong>As soon as possible</strong>
                            <small>No fixed appointment</small>
                          </span>
                          {pickupTiming === "asap" && <Check size={16} />}
                        </button>
                        <button
                          type="button"
                          className={
                            pickupTiming === "scheduled" ? "selected" : ""
                          }
                          aria-pressed={pickupTiming === "scheduled"}
                          onClick={() => setPickupTiming("scheduled")}
                        >
                          <CalendarDays size={17} />
                          <span>
                            <strong>Set date and time</strong>
                            <small>Choose an appointment</small>
                          </span>
                          {pickupTiming === "scheduled" && <Check size={16} />}
                        </button>
                      </div>
                    </div>
                    {pickupTiming === "scheduled" && (
                      <div className="doctor-appointment-pickers doctor-pickup-schedule">
                        <PortalDatePicker
                          label="Requested date"
                          value={pickupDate}
                          onChange={setPickupDate}
                        />
                        <PortalTimePicker
                          label="Requested time"
                          value={pickupTime}
                          onChange={setPickupTime}
                        />
                      </div>
                    )}
                  </>
                )}
                <label className="span-2">
                  <span>Contact details</span>
                  <input
                    name="contactDetails"
                    defaultValue={doctor.phone}
                    placeholder="Phone number or contact person"
                    required
                  />
                </label>
                <label className="span-2">
                  <span>Request note</span>
                  <textarea
                    name="note"
                   
                    placeholder="Anything the driver needs to know..."
                    rows={3}
                  />
                </label>
              </>
            )}
          </div>
          {requestError && <p className="doctor-request-error" role="alert">{requestError}</p>}
          <footer>
            {isCase && step > 0 && (
              <button
                className="portal-secondary-button"
                type="button"
                onClick={() => setStep((current) => current - 1)}
              >
                Back
              </button>
            )}
            <button
              className="portal-secondary-button"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            {isCase && step < steps.length - 1 ? (
              <button
                className="doctor-primary-button"
                type="button"
                disabled={
                  step === 0 &&
                  (!patient.trim() ||
                    lines.some(
                      (line) => !line.service || Number(line.units) < 1,
                    ))
                }
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (form) advanceStep(form);
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                className="doctor-primary-button"
                type={isCase ? "button" : "submit"}
                disabled={
                  !isCase &&
                  !isScan &&
                  (!pickupTiming ||
                    (pickupTiming === "scheduled" && !pickupDate))
                }
                onClick={
                  isCase
                    ? (event) => {
                        if (
                          step === steps.length - 1 &&
                          reviewReached.current
                        ) {
                          event.currentTarget.form?.requestSubmit();
                        }
                      }
                    : undefined
                }
              >
                <Send size={16} />
                Send request
              </button>
            )}
          </footer>
        </form>
      </section>
    </div>
  );
}

type DoctorDeliveryKind = "pickup" | "delivery" | "oral-scan";

interface DoctorDeliveryTrackingItem {
  id: string;
  kind: DoctorDeliveryKind;
  title: string;
  detail: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  isAsap?: boolean;
  address: string;
  contact: string;
  driver: string;
  requestedAt: string;
  approvalLabel: string;
  approvedAt?: string;
  outAt?: string;
  collectedAt?: string;
  completedAt?: string;
}

function deliveryTaskStatus(task: DeliveryTask) {
  if (task.approvalPending) return "Awaiting approval";
  if (task.status === "out") {
    return task.type === "pickup"
      ? "Out for pickup"
      : task.type === "oral-scan"
        ? "Out for scan"
        : "Out for delivery";
  }
  if (task.type === "pickup" && task.status === "collected") {
    return "Returning to lab";
  }
  if (task.status === "completed") {
    return task.type === "pickup"
      ? "Arrived at lab"
      : task.type === "oral-scan"
        ? "Scan completed"
        : "Delivered";
  }
  return "Scheduled";
}

function deliveryCaseKind(labCase: LabCase): DoctorDeliveryKind | null {
  if (
    labCase.status === "Closed" ||
    ["ready", "out_for_delivery", "delivered"].includes(
      labCase.deliveryStatus ?? "",
    )
  )
    return "delivery";
  if (
    labCase.intakeSource === "doctor" &&
    labCase.impressionType === "Physical Impression" &&
    [
      "awaiting_pickup",
      "out_for_pickup",
      "picked_up",
      "received_at_lab",
    ].includes(
      labCase.deliveryStatus ?? "awaiting_pickup",
    )
  )
    return "pickup";
  if (
    labCase.intakeSource === "doctor" &&
    labCase.impressionType === "Oral Scan" &&
    [
      "awaiting_scan_approval",
      "awaiting_scan",
      "out_for_scan",
      "scanned",
    ].includes(labCase.deliveryStatus ?? "")
  )
    return "oral-scan";
  return null;
}

function deliveryCaseStatus(labCase: LabCase, kind: DoctorDeliveryKind) {
  if (kind === "pickup") {
    if (labCase.deliveryStatus === "out_for_pickup") return "Out for pickup";
    if (labCase.deliveryStatus === "picked_up") return "Returning to lab";
    if (labCase.deliveryStatus === "received_at_lab") return "Arrived at lab";
    return "Awaiting pickup";
  }
  if (kind === "oral-scan") {
    if (labCase.deliveryStatus === "awaiting_scan_approval")
      return "Awaiting approval";
    if (labCase.deliveryStatus === "out_for_scan") return "Out for scan";
    if (labCase.deliveryStatus === "scanned") return "Scan completed";
    return "Scheduled";
  }
  if (labCase.deliveryStatus === "out_for_delivery")
    return "Out for delivery";
  if (labCase.deliveryStatus === "delivered") return "Delivered";
  return "Ready to deliver";
}

function deliveryStatusClass(status: string) {
  return status.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatTrackingTimestamp(value?: string) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function DoctorDeliveryView({
  data,
  doctor,
}: {
  data: OraData;
  doctor: Doctor;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [mobileLane, setMobileLane] = useState<DoctorDeliveryKind>("pickup");
  const taskItems: DoctorDeliveryTrackingItem[] = data.deliveryTasks
    .filter((task) => task.doctorId === doctor.id)
    .map((task) => ({
      id: `task-${task.id}`,
      kind: task.type,
      title:
        task.type === "oral-scan"
          ? "Oral scan appointment"
          : task.type === "pickup"
            ? "Clinic pickup request"
            : "Case delivery",
      detail: "Requested through the doctor portal",
      status: deliveryTaskStatus(task),
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      isAsap: task.isAsap,
      address: task.address,
      contact: task.contactDetails,
      driver:
        data.staff.find((member) => member.id === task.assignedTo)?.name ??
        "Not assigned",
      requestedAt: task.createdAt,
      approvalLabel: "Approved",
      approvedAt: task.approvedAt,
      outAt: task.outAt,
      collectedAt: task.collectedAt,
      completedAt: task.completedAt,
    }));
  const caseItems: DoctorDeliveryTrackingItem[] = data.cases
    .filter(
      (labCase) => labCase.doctorId === doctor.id && !labCase.archived,
    )
    .flatMap((labCase) => {
      const kind = deliveryCaseKind(labCase);
      if (!kind) return [];
      const history = labCase.history.filter(
        (entry) => entry.action === "delivery",
      );
      const findDate = (label: string) =>
        history.find((entry) => entry.label === label)?.date;
      const approvedAt =
        kind === "oral-scan"
          ? findDate("Approved oral scan request for dispatch")
          : kind === "delivery"
            ? labCase.history.find(
                (entry) =>
                  entry.action === "status" && entry.toStatus === "Closed",
              )?.date
            : labCase.deliveryAssignedAt ??
              `${labCase.receivedDate}T12:00:00`;
      const outAt =
        kind === "pickup"
          ? findDate("Marked out for pickup")
          : kind === "oral-scan"
            ? findDate("Marked out for oral scan")
            : findDate("Marked out for delivery");
      const collectedAt =
        kind === "pickup"
          ? history.find((entry) =>
              entry.label.includes("Picked up physical"),
            )?.date
          : undefined;
      const completedAt =
        kind === "pickup"
          ? findDate("Received physical impression at the lab")
          : kind === "oral-scan"
            ? findDate("Completed oral scan at the clinic")
            : findDate("Marked delivered to the clinic");
      return [
        {
          id: `case-${labCase.id}`,
          kind,
          title: `Case ${labCase.caseNumber}`,
          detail: labCase.patient || "Patient not recorded",
          status: deliveryCaseStatus(labCase, kind),
          scheduledDate: labCase.appointmentDate ?? labCase.dueDate,
          scheduledTime: labCase.appointmentTime ?? labCase.dueTime,
          address:
            labCase.deliveryLocation ||
            data.clinicProfiles[doctor.clinic]?.address ||
            doctor.clinic,
          contact: doctor.phone || "Not recorded",
          driver:
            data.staff.find(
              (member) => member.id === labCase.deliveryAssigneeId,
            )?.name ?? "Not assigned",
          requestedAt: `${labCase.receivedDate}T12:00:00`,
          approvalLabel:
            kind === "pickup"
              ? "Scheduled"
              : kind === "delivery"
                ? "Ready"
                : "Approved",
          approvedAt,
          outAt,
          collectedAt,
          completedAt,
        },
      ];
    });
  const items = [...taskItems, ...caseItems].sort((first, second) =>
    `${second.scheduledDate}T${second.scheduledTime}`.localeCompare(
      `${first.scheduledDate}T${first.scheduledTime}`,
    ),
  );
  const laneConfig: Array<{
    kind: DoctorDeliveryKind;
    title: string;
    icon: typeof Truck;
  }> = [
    { kind: "pickup", title: "Pick Up", icon: PackageCheck },
    { kind: "delivery", title: "Deliver", icon: Truck },
    { kind: "oral-scan", title: "Oral Scan", icon: ScanLine },
  ];

  return (
    <section className="doctor-delivery-page">
      <header className="doctor-delivery-intro">
        <div>
          <span>Trip tracking</span>
          <h2>Appointments and deliveries</h2>
          <p>Follow requests for your clinic from approval to completion.</p>
        </div>
        <strong>{items.length} records</strong>
      </header>
      <div className="doctor-delivery-mobile-switch" role="tablist" aria-label="Delivery tracking type">
        {laneConfig.map((lane) => {
          const Icon = lane.icon;
          const count = items.filter((item) => item.kind === lane.kind).length;
          return (
            <button
              type="button"
              role="tab"
              key={lane.kind}
              aria-selected={mobileLane === lane.kind}
              className={`${lane.kind} ${mobileLane === lane.kind ? "active" : ""}`}
              onClick={() => setMobileLane(lane.kind)}
            >
              <Icon size={17} />
              <span>{lane.title}</span>
              <b>{count}</b>
            </button>
          );
        })}
      </div>
      <div className="doctor-delivery-grid">
        {laneConfig.map((lane) => {
          const laneItems = items.filter((item) => item.kind === lane.kind);
          const Icon = lane.icon;
          return (
            <section
              className={`doctor-delivery-lane ${lane.kind} ${mobileLane === lane.kind ? "mobile-lane-active" : "mobile-lane-hidden"}`}
              key={lane.kind}
            >
              <header>
                <span><Icon size={20} /></span>
                <h3>{lane.title}</h3>
                <b>{laneItems.length}</b>
              </header>
              <div className="doctor-delivery-list">
                {laneItems.map((item) => {
                  const expanded = expandedId === item.id;
                  const outLabel =
                    item.kind === "pickup"
                      ? "Out for pickup"
                      : item.kind === "oral-scan"
                        ? "Out for scan"
                        : "Out for delivery";
                  const completeLabel =
                    item.kind === "pickup"
                      ? "Arrived at lab"
                      : item.kind === "oral-scan"
                        ? "Scan completed"
                        : "Delivered";
                  return (
                    <article
                      className={`doctor-delivery-card ${expanded ? "expanded" : ""}`}
                      key={item.id}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        aria-expanded={expanded}
                      >
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.isAsap
                              ? "As soon as possible"
                              : `${formatDate(item.scheduledDate)} at ${item.scheduledTime}`}
                          </small>
                        </span>
                        <em className={`doctor-delivery-status ${deliveryStatusClass(item.status)}`}>
                          {item.status}
                        </em>
                        <ChevronRight size={16} />
                      </button>
                      <div className="doctor-delivery-expand">
                        <div>
                          <p>{item.detail}</p>
                          <dl>
                            <div>
                              <dt><MapPin size={13} /> Location</dt>
                              <dd>{item.address || "Not recorded"}</dd>
                            </div>
                            <div>
                              <dt><Truck size={13} /> Assigned driver</dt>
                              <dd>{item.driver}</dd>
                            </div>
                            <div>
                              <dt><Clock3 size={13} /> Appointment</dt>
                              <dd>
                                {item.isAsap
                                  ? "As soon as possible"
                                  : `${formatDate(item.scheduledDate)} at ${item.scheduledTime}`}
                              </dd>
                            </div>
                            <div>
                              <dt><Stethoscope size={13} /> Contact</dt>
                              <dd>{item.contact}</dd>
                            </div>
                          </dl>
                          <div className="doctor-delivery-timeline">
                            <span className="done"><i><Check size={11} /></i><small>Requested</small><strong>{formatTrackingTimestamp(item.requestedAt)}</strong></span>
                            <span className={item.approvedAt ? "done" : ""}><i>{item.approvedAt ? <Check size={11} /> : "2"}</i><small>{item.approvalLabel}</small><strong>{formatTrackingTimestamp(item.approvedAt)}</strong></span>
                            <span className={item.outAt ? "done" : ""}><i>{item.outAt ? <Check size={11} /> : "3"}</i><small>{outLabel}</small><strong>{formatTrackingTimestamp(item.outAt)}</strong></span>
                            {item.kind === "pickup" && (
                              <span className={item.collectedAt ? "done" : ""}><i>{item.collectedAt ? <Check size={11} /> : "4"}</i><small>Picked up</small><strong>{formatTrackingTimestamp(item.collectedAt)}</strong></span>
                            )}
                            <span className={item.completedAt ? "done" : ""}><i>{item.completedAt ? <Check size={11} /> : item.kind === "pickup" ? "5" : "4"}</i><small>{completeLabel}</small><strong>{formatTrackingTimestamp(item.completedAt)}</strong></span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!laneItems.length && (
                  <div className="doctor-delivery-empty">
                    <Check size={18} />
                    <span>No {lane.title.toLowerCase()} records yet</span>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default function DoctorPortalPage({
  data,
  doctor,
  preview = false,
  onExit,
  onUpdate,
}: {
  data: OraData;
  doctor: Doctor;
  preview?: boolean;
  onExit: () => void;
  onUpdate: (updater: (current: OraData) => OraData) => void;
}) {
  const [view, setView] = useState<DoctorPortalView>("dashboard");
  const [requestKind, setRequestKind] = useState<RequestKind>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const priceListApprovedAt = doctor.priceListApprovedAt ?? null;
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const doctorCases = useMemo(
    () =>
      data.cases
        .filter(
          (labCase) => labCase.doctorId === doctor.id && !labCase.archived,
        )
        .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate)),
    [data.cases, doctor.id],
  );
  const activeCases = doctorCases.filter(
    (labCase) =>
      labCase.status !== "Closed" || labCase.deliveryStatus !== "delivered",
  );
  const openBalance = doctorCases.reduce(
    (sum, labCase) => sum + Math.max(0, labCase.price - labCase.paid),
    0,
  );
  const selectedInvoice =
    doctorCases.find((labCase) => labCase.id === selectedInvoiceId) ?? null;
  const selectedInvoices = doctorCases.filter((labCase) =>
    selectedInvoiceIds.includes(labCase.id),
  );
  const allInvoicesSelected =
    doctorCases.length > 0 && selectedInvoices.length === doctorCases.length;
  const caseTablePagination = useTablePagination(
    doctorCases,
    `doctor-cases-${doctor.id}-${doctorCases.length}`,
  );
  const invoiceTablePagination = useTablePagination(
    doctorCases,
    `doctor-invoices-${doctor.id}-${doctorCases.length}`,
  );
  const selectedCase =
    doctorCases.find((labCase) => labCase.id === selectedCaseId) ?? null;
  const nav = [
    { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    { id: "cases" as const, label: "Cases", icon: ClipboardList },
    { id: "delivery" as const, label: "Delivery", icon: Truck },
    { id: "invoices" as const, label: "Invoices", icon: ReceiptText },
  ];
  function newId(prefix: string) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }
  function acceptInvoices(caseIds: string[]) {
    const eligibleIds = caseIds.filter((caseId) => {
      const invoice = doctorCases.find((item) => item.id === caseId);
      return invoice && !invoice.invoiceAcceptedAt;
    });
    if (!eligibleIds.length) return;
    const acceptedAt = new Date().toISOString();
    onUpdate((current) => ({
      ...current,
      cases: current.cases.map((labCase) =>
        labCase.doctorId === doctor.id && eligibleIds.includes(labCase.id)
          ? {
              ...labCase,
              invoiceAcceptedAt: acceptedAt,
              invoiceAcceptedBy: doctor.id,
            }
          : labCase,
      ),
    }));
    setNotice(
      `${eligibleIds.length} invoice${eligibleIds.length === 1 ? "" : "s"} accepted.`,
    );
    setSelectedInvoiceIds((current) =>
      current.filter((caseId) => !eligibleIds.includes(caseId)),
    );
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const caseId = params.get("case");
    if (!caseId) return;
    const labCase = doctorCases.find((item) => item.id === caseId);
    if (!labCase) return;
    const timer = window.setTimeout(() => {
      if (params.get("qr") === "sticker") {
        setView("delivery");
      } else {
        setView("cases");
        setSelectedCaseId(labCase.id);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [doctorCases]);
  function handleRequest(
    kind: Exclude<RequestKind, null>,
    fields: Record<string, string>,
  ) {
    const now = new Date().toISOString();
    if (kind === "new-case") {
      const max = Math.max(
        1000,
        ...data.cases.map((item) => Number(item.caseNumber) || 0),
      );
      const requestedLines = JSON.parse(fields.serviceLines || "[]") as Array<{
        service: string;
        units: number;
        shade: string;
      }>;
      const serviceLines: CaseServiceLine[] = requestedLines.map(
        (requestedLine) => ({
          id: newId("service"),
          service: requestedLine.service,
          units: Math.max(1, Number(requestedLine.units) || 1),
          shade: requestedLine.shade || "Not recorded",
          unitPrice: doctor.priceList[requestedLine.service] ?? 0,
        }),
      );
      const line = serviceLines[0] ?? {
        id: newId("service"),
        service: data.serviceTypes[0] ?? "Zirconia Crown",
        units: 1,
        shade: "Not recorded",
        unitPrice: 0,
      };
      const caseAttachments = JSON.parse(
        fields.attachments || "[]",
      ) as DoctorCaseAttachment[];
      const teeth = (JSON.parse(fields.teeth || "[]") as unknown[])
        .map((tooth) => String(tooth))
        .filter((tooth) => /^[1-4][1-8]$/.test(tooth));
      const toothConnections = (JSON.parse(
        fields.toothConnections || "[]",
      ) as unknown[])
        .map((connection) => String(connection))
        .filter((connection) => {
          const [first, second] = connection.split(":");
          return /^[1-4][1-8]$/.test(first) && /^[1-4][1-8]$/.test(second)
            && teeth.includes(first) && teeth.includes(second);
        });
      const labCase: LabCase = {
        id: newId("case"),
        caseNumber: String(max + 1),
        doctorId: doctor.id,
        patient: fields.patient,
        patientRef: "",
        service: line.service,
        units: line.units,
        shade: line.shade,
        serviceLines,
        teeth,
        toothConnections,
        receivedDate: now.slice(0, 10),
        dueDate: fields.appointmentDate,
        dueTime: fields.appointmentTime,
        appointmentDate: fields.appointmentDate,
        appointmentTime: fields.appointmentTime,
        intakeSource: "doctor",
        intakeApprovalPending: true,
        deliveryStatus: "picked_up",
        impressionType: "Oral Scan",
        status: "Received",
        priority: "Normal",
        assignedTo: "",
        telegramRef: "Doctor portal submission",
        price: serviceLines.reduce(
          (sum, serviceLine) => sum + serviceLine.units * serviceLine.unitPrice,
          0,
        ),
        paid: 0,
        notes: [],
        doctorMessages:
          fields.note || caseAttachments.length
            ? [
                {
                  id: newId("message"),
                  author: "doctor",
                  authorName: doctor.name,
                  text: fields.note,
                  createdAt: now,
                  attachments: caseAttachments,
                },
              ]
            : [],
        materialUsage: [],
        history: [
          {
            id: newId("history"),
            date: now,
            staffId: "doctor-portal",
            action: "created",
            label: "Doctor submitted an oral scan case for approval",
          },
        ],
      };
      onUpdate((current) => ({
        ...current,
        cases: [labCase, ...current.cases],
      }));
      setNotice(`Case ${labCase.caseNumber} was sent to Ora for approval.`);
    } else {
      const type =
        kind === "scan-appointment"
          ? ("oral-scan" as const)
          : ("pickup" as const);
      const requestedAt = new Date();
      const isAsap = type === "pickup" && fields.timingMode === "asap";
      onUpdate((current) => ({
        ...current,
        deliveryTasks: [
          {
            id: newId("delivery"),
            type,
            isAsap,
            address: fields.address,
            doctorId: doctor.id,
            doctorLabel: doctor.name,
            contactDetails: fields.contactDetails,
            scheduledDate: isAsap
              ? toISODate(requestedAt)
              : fields.scheduledDate,
            scheduledTime: isAsap
              ? `${String(requestedAt.getHours()).padStart(2, "0")}:${String(requestedAt.getMinutes()).padStart(2, "0")}`
              : fields.scheduledTime,
            assignedTo: "",
            assignedAt: now,
            status: "scheduled",
            approvalPending: true,
            createdAt: now,
          },
          ...current.deliveryTasks,
        ],
      }));
      setNotice(
        `${type === "oral-scan" ? "Oral scan appointment" : "Pickup"} request sent to Ora for review.`,
      );
    }
    setRequestKind(null);
    window.setTimeout(() => setNotice(null), 3500);
  }
  function sendMessage(text: string, attachments: DoctorCaseAttachment[]) {
    if (!selectedCase) return;
    const message = {
      id: newId("message"),
      author: "doctor" as const,
      authorName: doctor.name,
      text,
      createdAt: new Date().toISOString(),
      attachments,
    };
    onUpdate((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === selectedCase.id
          ? {
              ...item,
              doctorMessages: [...(item.doctorMessages ?? []), message],
            }
          : item,
      ),
    }));
  }
  const requestActions = (
    <article className="doctor-portal-panel doctor-request-panel">
      <header>
        <div>
          <span>Requests</span>
          <h2>Send to Ora</h2>
        </div>
      </header>
      <div className="doctor-request-actions">
        <button
          type="button"
          className="scan-upload"
          onClick={() => setRequestKind("new-case")}
        >
          <span>
            <FileText size={20} />
          </span>
          <div>
            <strong>Send a New Oral Scan</strong>
            <small>Submit a case for review.</small>
          </div>
          <ChevronRight size={17} />
        </button>
        <button
          type="button"
          className="scan-visit"
          onClick={() => setRequestKind("scan-appointment")}
        >
          <span>
            <ScanLine size={20} />
          </span>
          <div>
            <strong>Request an Oral Scan Appointment</strong>
            <small>Ask Ora to visit your clinic.</small>
          </div>
          <ChevronRight size={17} />
        </button>
        <button
          type="button"
          className="pickup-request"
          onClick={() => setRequestKind("pickup")}
        >
          <span>
            <PackageCheck size={20} />
          </span>
          <div>
            <strong>Ask for a Delivery</strong>
            <small>Request physical impression pickup.</small>
          </div>
          <ChevronRight size={17} />
        </button>
      </div>
    </article>
  );
  const dashboardMetrics = (
    <section className="doctor-portal-metrics">
      <article>
        <small>Active cases</small>
        <strong>{activeCases.length}</strong>
        <span>Currently with Ora</span>
      </article>
      <article>
        <small>Awaiting delivery</small>
        <strong>
          {
            doctorCases.filter(
              (labCase) =>
                labCase.status === "Closed" &&
                labCase.deliveryStatus !== "delivered",
            ).length
          }
        </strong>
        <span>Finished by the lab</span>
      </article>
      <article>
        <small>Open balance</small>
        <strong>{formatMoney(openBalance, data.currency)}</strong>
        <span>Across all invoices</span>
      </article>
    </section>
  );
  const caseNotifications: DoctorPortalNotification[] = doctorCases
    .flatMap((labCase): DoctorPortalNotification[] => {
      const milestoneUpdates = labCase.history.flatMap(
        (entry): DoctorPortalNotification[] => {
        if (entry.action === "status" && entry.toStatus === "Approved") {
          return [{
            id: entry.id,
            date: entry.date,
            title: "Your case was approved and is now in production.",
            subject: `Case ${labCase.caseNumber}`,
            caseId: labCase.id,
            destination: "cases" as const,
            tone: "workflow",
          }];
        }
        if (entry.action === "status" && entry.toStatus === "Closed") {
          return [{
            id: entry.id,
            date: entry.date,
            title: "Your case has been finished and is ready for delivery.",
            subject: `Case ${labCase.caseNumber}`,
            caseId: labCase.id,
            destination: "cases" as const,
            tone: "workflow",
          }];
        }
        if (entry.action === "delivery" && entry.label === "Marked out for delivery") {
          return [{
            id: entry.id,
            date: entry.date,
            title: "Your case is out for delivery.",
            subject: `Case ${labCase.caseNumber}`,
            caseId: labCase.id,
            destination: "delivery" as const,
            tone: "delivery",
          }];
        }
        if (entry.action === "delivery" && entry.label === "Marked delivered to the clinic") {
          return [{
            id: entry.id,
            date: entry.date,
            title: "Your case was delivered to the clinic.",
            subject: `Case ${labCase.caseNumber}`,
            caseId: labCase.id,
            destination: "delivery" as const,
            tone: "delivery",
          }];
        }
          return [];
        },
      );
      const labReplies: DoctorPortalNotification[] = (
        labCase.doctorMessages ?? []
      )
        .filter(
          (message) =>
            message.author === "lab" &&
            message.text !== "Your case has been approved and is now in production.",
        )
        .map((message) => ({
          id: message.id,
          date: message.createdAt,
          title: message.text || "Ora shared files with you",
          subject: `Case ${labCase.caseNumber}`,
          caseId: labCase.id,
          destination: "cases" as const,
          tone: "message",
        }));
      return [...milestoneUpdates, ...labReplies];
    });
  const deliveryNotifications: DoctorPortalNotification[] = data.deliveryTasks
    .filter((task) => task.doctorId === doctor.id)
    .flatMap((task) => {
      const subject =
        task.type === "oral-scan"
          ? "Oral scan appointment"
          : task.type === "pickup"
            ? "Pickup request"
            : "Delivery request";
      const updates: DoctorPortalNotification[] = [];
      if (task.approvedAt) {
        updates.push({
          id: `${task.id}-approved`,
          date: task.approvedAt,
          title:
            task.type === "oral-scan"
              ? "Your oral scan appointment was approved."
              : "Your clinic pickup request was approved.",
          subject,
          destination: "delivery",
          tone: "delivery",
        });
      }
      if (task.outAt) {
        updates.push({
          id: `${task.id}-out`,
          date: task.outAt,
          title:
            task.type === "oral-scan"
              ? "Ora's scan specialist is on the way to your clinic."
              : task.type === "pickup"
                ? "Ora's driver is on the way for pickup."
                : "Your case is out for delivery.",
          subject,
          destination: "delivery",
          tone: "delivery",
        });
      }
      if (task.completedAt) {
        updates.push({
          id: `${task.id}-completed`,
          date: task.completedAt,
          title:
            task.type === "oral-scan"
              ? "Your oral scan appointment was completed."
              : task.type === "pickup"
                ? "Your clinic pickup was completed."
                : "Your delivery was completed.",
          subject,
          destination: "delivery",
          tone: "delivery",
        });
      }
      return updates;
    });
  const priceListNotifications: DoctorPortalNotification[] = (doctor.priceListUpdates ?? []).map((update) => ({
    id: update.id,
    date: update.date,
    title: "Your price list was updated.",
    subject: update.changes
      .map((change) =>
        change.previousPrice === null
          ? `${change.service} added at ${formatMoney(change.nextPrice, data.currency)}`
          : `${change.service}: ${formatMoney(change.previousPrice, data.currency)} to ${formatMoney(change.nextPrice, data.currency)}`,
      )
      .join(" · "),
    destination: "invoices" as const,
    tone: "message",
  }));
  const notifications = [...caseNotifications, ...deliveryNotifications, ...priceListNotifications]
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 8);
  const notificationsPanel = (
    <article className="doctor-portal-panel doctor-notifications-panel">
      <header>
        <div>
          <span>Notifications</span>
          <h2>Latest from Ora</h2>
        </div>
        <small>{notifications.length} updates</small>
      </header>
      <div>
        {notifications.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.destination === "delivery") {
                setView("delivery");
                return;
              }
              if (item.destination === "invoices") {
                setView("invoices");
                return;
              }
              if ("caseId" in item && item.caseId) {
                setSelectedCaseId(item.caseId);
                setView("cases");
              }
            }}
          >
            <i className={item.tone} />
            <span>
              <strong>{item.subject}</strong>
              <small>{item.title}</small>
            </span>
            <time>
              {new Date(item.date).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
              })}
            </time>
          </button>
        ))}
        {!notifications.length && (
          <p className="doctor-empty">
            Ora will post updates about your cases here.
          </p>
        )}
      </div>
    </article>
  );
  const activityPanels = (
    <section className="doctor-portal-grid">
      <article className="doctor-portal-panel">
        <header>
          <div>
            <span>Case activity</span>
            <h2>Recent cases</h2>
          </div>
          <button type="button" onClick={() => setView("cases")}>
            View all <ChevronRight size={15} />
          </button>
        </header>
        <div className="doctor-recent-cases">
          {doctorCases.slice(0, 5).map((labCase) => (
            <button
              type="button"
              className={labCase.onHold ? "doctor-on-hold" : ""}
              key={labCase.id}
              onClick={() => {
                setSelectedCaseId(labCase.id);
                setView("cases");
              }}
            >
              <span>
                <strong>
                  {labCase.caseNumber} · {labCase.patient}
                </strong>
                <small>
                  <ServiceSummary labCase={labCase} />
                </small>
              </span>
              <em className={doctorStatusTone(labCase)}>
                {formatStatus(labCase)}
              </em>
            </button>
          ))}
          {!doctorCases.length && (
            <p className="doctor-empty">
              Your cases will appear here when they are received by Ora.
            </p>
          )}
        </div>
      </article>
      <article className="doctor-portal-panel doctor-account-summary">
        <header>
          <div>
            <span>Account overview</span>
            <h2>Invoices needing attention</h2>
          </div>
          <WalletCards size={19} />
        </header>
        {doctorCases
          .filter((labCase) => labCase.paid < labCase.price)
          .slice(0, 4)
          .map((labCase) => (
            <button
              type="button"
              key={labCase.id}
              onClick={() => setSelectedInvoiceId(labCase.id)}
            >
              <span>
                <strong>INV-{labCase.caseNumber}</strong>
                <small>
                  {labCase.patient} · {invoiceStatus(labCase)}
                </small>
              </span>
              <b>{formatMoney(labCase.price - labCase.paid, data.currency)}</b>
            </button>
          ))}
        {!doctorCases.some((labCase) => labCase.paid < labCase.price) && (
          <p className="doctor-empty">There are no outstanding invoices.</p>
        )}
      </article>
    </section>
  );
  return (
    <div
      className={`doctor-portal-shell ${navigationCollapsed ? "navigation-collapsed" : ""}`}
    >
      <aside
        className={`doctor-portal-sidebar ${navigationCollapsed ? "collapsed" : ""}`}
      >
        <button
          className="doctor-sidebar-toggle"
          type="button"
          onClick={() => setNavigationCollapsed(!navigationCollapsed)}
          aria-label={navigationCollapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!navigationCollapsed}
          title={navigationCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {navigationCollapsed ? (
            <PanelLeftOpen size={15} />
          ) : (
            <PanelLeftClose size={15} />
          )}
        </button>
        <div className="doctor-portal-brand">
          <span className="doctor-portal-mark">O</span>
          <span>
            <strong>Ora</strong>
            <small>Doctor portal</small>
          </span>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={view === item.id ? "active" : ""}
                type="button"
                onClick={() => setView(item.id)}
                aria-label={item.label}
                title={navigationCollapsed ? item.label : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <footer>
          <div className="doctor-portal-profile">
            <span>
              {doctor.name
                .replace(/^Dr\.\s*/i, "")
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("") || "DR"}
            </span>
            <div>
              <strong>{doctor.name}</strong>
              <small>{doctor.clinic}</small>
            </div>
          </div>
          <button
            className="doctor-portal-exit"
            type="button"
            onClick={onExit}
            aria-label={preview ? "Back to lab" : "Sign out"}
            title={navigationCollapsed ? (preview ? "Back to lab" : "Sign out") : undefined}
          >
            <LogOut size={16} />
            <span>{preview ? "Back to lab" : "Sign out"}</span>
          </button>
        </footer>
      </aside>
      <main className="doctor-portal-main">
        <header className="doctor-portal-header">
          <div>
            <span>{preview ? "Admin preview" : "Doctor workspace"}</span>
            <h1>
              {view === "dashboard"
                ? `Welcome, ${doctor.name.replace(/^Dr\.\s*/i, "")}`
                : view === "cases"
                  ? "My cases"
                  : view === "delivery"
                    ? "Delivery tracking"
                    : "My invoices"}
            </h1>
          </div>
          <div className="doctor-portal-header-actions">
            <button
              className="doctor-header-theme-toggle"
              type="button"
              onClick={() => onUpdate((current) => ({ ...current, theme: current.theme === "dark" ? "light" : "dark" }))}
              aria-label={`Switch to ${data.theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${data.theme === "dark" ? "light" : "dark"} mode`}
            >
              {data.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {preview && (
              <div className="doctor-preview-notice">
                <Stethoscope size={15} />
                Viewing as {doctor.name}
              </div>
            )}
          </div>
        </header>
        <div className="doctor-portal-content">
          {notice && <div className="doctor-portal-notice">{notice}</div>}
          {view === "dashboard" && (
            <section className="doctor-dashboard-layout">
              {requestActions}
              <div className="doctor-dashboard-main">
                {dashboardMetrics}
                {notificationsPanel}
                {activityPanels}
              </div>
            </section>
          )}
          {view === "cases" && (
            <section className="doctor-portal-panel doctor-table-panel">
              <header>
                <div>
                  <span>Case records</span>
                  <h2>My cases</h2>
                </div>
                <p>{doctorCases.length} total</p>
              </header>
              <div className="doctor-table-wrap">
                <table className="doctor-case-table">
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Patient</th>
                      <th>Services</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caseTablePagination.pageItems.map((labCase) => (
                      <tr
                        className={`doctor-invoice-row doctor-case-row ${labCase.onHold ? "doctor-on-hold" : ""}`}
                        key={labCase.id}
                        onClick={() => setSelectedCaseId(labCase.id)}
                      >
                        <td>
                          <strong>{labCase.caseNumber}</strong>
                          <small>
                            Received {formatDate(labCase.receivedDate)}
                          </small>
                        </td>
                        <td>
                          <strong title={labCase.patient}>{labCase.patient}</strong>
                          <small>{labCase.patientRef || "No reference"}</small>
                        </td>
                        <td>
                          <ServiceSummary labCase={labCase} className="doctor-case-service-summary" />
                          <small>{labCase.impressionType}</small>
                        </td>
                        <td>
                          <strong>{formatDate(labCase.dueDate)}</strong>
                          <small>{labCase.dueTime}</small>
                        </td>
                        <td>
                          <span
                            className={`doctor-case-status ${doctorStatusTone(labCase)}`}
                          >
                            {formatStatus(labCase)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!doctorCases.length && (
                  <p className="doctor-empty">
                    There are no cases to show yet.
                  </p>
                )}
              </div>
              <TablePagination {...caseTablePagination} />
            </section>
          )}
          {view === "delivery" && (
            <DoctorDeliveryView data={data} doctor={doctor} />
          )}
          {view === "invoices" && (
            <section className="doctor-portal-panel doctor-table-panel">
              <header>
                <div>
                  <span>Billing</span>
                  <h2>My invoices</h2>
                </div>
                <div className="doctor-invoice-header-actions">
                  <p>{formatMoney(openBalance, data.currency)} outstanding</p>
                  <button
                    className="portal-secondary-button doctor-price-list-button"
                    type="button"
                    onClick={() => setPriceListOpen(true)}
                  >
                    <FileText size={15} />
                    My price list
                  </button>
                  <button
                    className="doctor-primary-button"
                    type="button"
                    disabled={!selectedInvoices.some((item) => !item.invoiceAcceptedAt)}
                    onClick={() =>
                      acceptInvoices(selectedInvoices.map((item) => item.id))
                    }
                  >
                    <Check size={15} />
                    Accept selected
                    {selectedInvoices.length > 0 && <b>{selectedInvoices.length}</b>}
                  </button>
                  <button
                    className="portal-secondary-button"
                    type="button"
                    disabled={!selectedInvoices.length}
                    onClick={() =>
                      printDoctorInvoices(data, doctor, selectedInvoices)
                    }
                  >
                    <Printer size={15} />
                    Print selected
                    {selectedInvoices.length > 0 && (
                      <b>{selectedInvoices.length}</b>
                    )}
                  </button>
                </div>
              </header>
              <div className="doctor-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="doctor-invoice-select">
                        <input
                          type="checkbox"
                          aria-label="Select all invoices"
                          checked={allInvoicesSelected}
                          onChange={(event) =>
                            setSelectedInvoiceIds(
                              event.target.checked
                                ? doctorCases.map((labCase) => labCase.id)
                                : [],
                            )
                          }
                        />
                      </th>
                      <th>Invoice</th>
                      <th>Patient</th>
                      <th>Issued</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Acceptance</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceTablePagination.pageItems.map((labCase) => (
                      <tr
                        className={`doctor-invoice-row ${selectedInvoiceIds.includes(labCase.id) ? "selected" : ""}`}
                        key={labCase.id}
                        onClick={() => setSelectedInvoiceId(labCase.id)}
                      >
                        <td
                          className="doctor-invoice-select"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            aria-label={`Select invoice INV-${labCase.caseNumber}`}
                            checked={selectedInvoiceIds.includes(labCase.id)}
                            onChange={(event) =>
                              setSelectedInvoiceIds((current) =>
                                event.target.checked
                                  ? [...current, labCase.id]
                                  : current.filter((id) => id !== labCase.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <strong>INV-{labCase.caseNumber}</strong>
                          <small>Case {labCase.caseNumber}</small>
                        </td>
                        <td>{labCase.patient}</td>
                        <td>{formatDate(labCase.receivedDate)}</td>
                        <td>
                          <strong>
                            {formatMoney(labCase.price, data.currency)}
                          </strong>
                          <small>
                            {formatMoney(
                              Math.max(0, labCase.price - labCase.paid),
                              data.currency,
                            )}{" "}
                            due
                          </small>
                        </td>
                        <td>
                          <span
                            className={`doctor-invoice-status ${invoiceStatus(labCase).toLowerCase()}`}
                          >
                            {invoiceStatus(labCase)}
                          </span>
                        </td>
                        <td>
                          {labCase.invoiceAcceptedAt ? (
                            <span className="doctor-invoice-accepted compact">
                              <Check size={13} /> Accepted
                            </span>
                          ) : (
                            <button
                              className="doctor-invoice-accept-button"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                acceptInvoices([labCase.id]);
                              }}
                            >
                              <Check size={14} /> Accept
                            </button>
                          )}
                        </td>
                        <td>
                          <ChevronRight size={17} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!doctorCases.length && (
                  <p className="doctor-empty">
                    There are no invoices to show yet.
                  </p>
                )}
              </div>
              <TablePagination {...invoiceTablePagination} />
            </section>
          )}
        </div>
      </main>
      {selectedInvoice && (
        <InvoiceDrawer
          data={data}
          doctor={doctor}
          labCase={selectedInvoice}
          onClose={() => setSelectedInvoiceId(null)}
          onAccept={acceptInvoices}
        />
      )}
      {priceListOpen && (
        <DoctorPriceListDrawer
          data={data}
          doctor={doctor}
          approvedAt={priceListApprovedAt}
          onClose={() => setPriceListOpen(false)}
      onApprove={() => {
        const approvedAt = new Date().toISOString();
        onUpdate((current) => ({
          ...current,
          doctors: current.doctors.map((item) =>
            item.id === doctor.id
              ? { ...item, priceListApprovedAt: approvedAt }
              : item,
          ),
        }));
        setNotice("Price list approved for one-time use.");
      }}
        />
      )}
      {selectedCase && (
        <CaseConversationDrawer
          labCase={selectedCase}
          onClose={() => setSelectedCaseId(null)}
          onSend={sendMessage}
        />
      )}
      {requestKind && (
        <PortalRequestModal
          kind={requestKind}
          doctor={doctor}
          data={data}
          onClose={() => setRequestKind(null)}
          onRequest={handleRequest}
        />
      )}
    </div>
  );
}
