"use client";

/* eslint-disable @next/next/no-img-element -- Runtime QR codes and uploaded previews use data URLs. */

import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowUpDown,
  ArrowDownRight,
  ArrowUpRight,
  BadgeDollarSign,
  Banknote,
  BarChart3,
  Boxes,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Copy,
  DatabaseBackup,
  Download,
  FileDown,
  Gauge,
  History,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  LogOut,
  Menu,
  MessageSquareText,
  Paperclip,
  Moon,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  GripVertical,
  Hourglass,
  ScanLine,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  Sticker,
  Sun,
  Trash2,
  Upload,
  UserPen,
  UserMinus,
  UserRoundCog,
  UsersRound,
  WalletCards,
  QrCode,
  PackageCheck,
  Truck,
  X,
} from "lucide-react";
import {
  CASE_STATUSES,
  PERMISSIONS,
  caseDueAt,
  caseServiceLines,
  caseTags,
  caseTotalUnits,
  createDemoData,
  isCaseOverdue,
  migrateOraData,
  toISODate,
  uid,
  workflowForImpression,
  type CaseServiceLine,
  type CaseStatus,
  type CaseTag,
  type DeliveryStatus,
  type DeliveryTask,
  type Doctor,
  type ImpressionType,
  type LabCase,
  type Material,
  type OraData,
  type PermissionKey,
  type PracticeType,
  type RoleDefinition,
  type StaffMember,
} from "./mock-data";
import Avatar from "../Components/Avatar";
import DentalReferenceChart, {
  dentalChartPrintMarkup,
} from "../Components/DentalReferenceChart";
import Modal from "../Components/Modal";
import QrScannerModal from "../Components/QrScannerModal";
import RoundedQrCode from "../Components/RoundedQrCode";
import PaymentDepositFields, { type PaymentCurrency } from "../Components/PaymentDepositFields";
import PaymentExchangeRateFields, { paymentAmountInUsd } from "../Components/PaymentExchangeRateFields";
import { queueLedgerEntry } from "../Components/accountingLedger";
import AccountingWorkspacePage from "./AccountingWorkspacePage";
import DoctorPortalPage from "./DoctorPortalPage";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type View =
  | "dashboard"
  | "cases"
  | "schedule"
  | "delivery"
  | "doctors"
  | "accounting"
  | "inventory"
  | "team"
  | "log"
  | "settings";
type ModalName =
  | "new-case"
  | "new-expense"
  | "new-material"
  | "adjust-stock"
  | "price-list"
  | "doctor-account"
  | "doctor-portal-account"
  | "new-doctor"
  | "new-staff"
  | "edit-staff"
  | "staff-account"
  | "edit-role"
  | "new-role"
  | "clinics"
  | "new-clinic"
  | "new-delivery"
  | "qr-scanner"
  | "case-qr"
  | null;
type DataUpdater = (current: OraData) => OraData;
type AuthNext =
  "login" | "change_password" | "mfa_setup" | "mfa_verify" | "ready";
type AuthUser = {
  username: string;
  staffId: string;
  name?: string;
  isOwner?: boolean;
  mfaRequired?: boolean;
  mfaEnabled?: boolean;
};
type LoginResult =
  { kind: "staff"; staffId: string } | { kind: "doctor"; doctorId: string };

const NAV_ITEMS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "cases", label: "Cases", icon: Archive },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "doctors", label: "Doctors & Clinics", icon: Stethoscope },
  { id: "accounting", label: "Accounting", icon: WalletCards },
  { id: "inventory", label: "Inventory", icon: Boxes },
  { id: "team", label: "Team", icon: UsersRound },
  { id: "log", label: "Activity log", icon: History },
  { id: "settings", label: "Settings", icon: Settings },
];

function toothConnectionKey(first: string, second: string) {
  return [first, second].sort().join(":");
}

function qrTargetFromUrl(value: string) {
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin) return null;
  const caseId = url.searchParams.get("case");
  return caseId
    ? {
        caseId,
        destination:
          url.searchParams.get("qr") === "sticker" ? "delivery" : "case",
      }
    : null;
}

function caseQrTargetFromCurrentUrl() {
  if (typeof window === "undefined") return null;
  return qrTargetFromUrl(window.location.href);
}

const VIEW_COPY: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: "Lab overview", subtitle: "Today at Ora" },
  cases: { title: "Cases", subtitle: "Production workflow and case records" },
  schedule: {
    title: "Lab schedule",
    subtitle: "Internal workload and due dates",
  },
  delivery: {
    title: "Delivery",
    subtitle: "Clinic pickup and finished-case delivery",
  },
  doctors: {
    title: "Doctors & Clinics",
    subtitle: "Client directory and shared service pricing",
  },
  accounting: {
    title: "Accounting",
    subtitle: "Income, expenses and statements",
  },
  inventory: {
    title: "Inventory",
    subtitle: "Material stock and case consumption",
  },
  team: {
    title: "Team",
    subtitle: "Staff access and responsibilities",
  },
  log: {
    title: "Activity log",
    subtitle: "Complete changes across the Ora workspace",
  },
  settings: {
    title: "Settings",
    subtitle: "Appearance, catalogs and workspace backup",
  },
};

type DisplayCaseStatus =
  | CaseStatus
  | "Awaiting Approval"
  | "On hold"
  | "Out for Delivery"
  | "Delivered";

const STATUS_TONE: Record<DisplayCaseStatus, string> = {
  Received: "slate",
  Approved: "blue",
  Casting: "amber",
  Design: "violet",
  Printing: "blue",
  Production: "green",
  Finishing: "orange",
  "Build Up": "blue",
  Glazing: "amber",
  "Quality Review": "purple",
  Closed: "gray",
  "Awaiting Approval": "violet",
  "On hold": "amber",
  "Out for Delivery": "blue",
  Delivered: "green",
};

const DISPLAY_CASE_STATUSES: DisplayCaseStatus[] = [
  "Awaiting Approval",
  "On hold",
  ...CASE_STATUSES,
  "Out for Delivery",
  "Delivered",
];

function money(value: number, currency: OraData["currency"] = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "SYP" ? 0 : 2,
  }).format(value);
}

function formatDate(value: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(
    "en-GB",
    options ?? { day: "2-digit", month: "short", year: "numeric" },
  ).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getWeekStart(value = new Date()) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function dateDiff(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function doctorPriceList(data: OraData, doctor?: Doctor) {
  if (!doctor) return {} as Record<string, number>;
  if (doctor.practiceType === "clinic")
    return data.clinicProfiles[doctor.clinic]?.priceList ?? doctor.priceList;
  return doctor.priceList;
}

function caseServiceSummary(labCase: LabCase) {
  return caseServiceLines(labCase)
    .map((line) => `${line.service} (${line.units})`)
    .join(", ");
}

function formatDue(labCase: LabCase) {
  return `${formatDate(labCase.dueDate)} at ${labCase.dueTime || "17:00"}`;
}

function registeredDoctorAddress(data: OraData, doctor?: Doctor) {
  if (!doctor) return "";
  return (
    doctor.address?.trim() ||
    data.clinicProfiles[doctor.clinic]?.address?.trim() ||
    ""
  );
}

function deliveryLocation(data: OraData, labCase: LabCase) {
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  const savedLocation = labCase.deliveryLocation?.trim() ?? "";
  const savedLocationIsAddress =
    Boolean(savedLocation) &&
    savedLocation !== doctor?.clinic &&
    savedLocation.toLowerCase() !== "independent practice" &&
    savedLocation.toLowerCase() !== "location not recorded";
  return (
    (savedLocationIsAddress ? savedLocation : "") ||
    registeredDoctorAddress(data, doctor) ||
    "Location not recorded"
  );
}

function deliveryQueue(
  labCase: LabCase,
  includePendingScanApproval = false,
): "pickup" | "oral-scan" | "delivery" | null {
  if (labCase.archived) return null;
  if (
    labCase.intakeSource === "doctor" &&
    labCase.impressionType === "Physical Impression" &&
    ["awaiting_pickup", "out_for_pickup", "picked_up"].includes(
      labCase.deliveryStatus ?? "awaiting_pickup",
    )
  )
    return "pickup";
  if (
    labCase.intakeSource === "doctor" &&
    labCase.impressionType === "Oral Scan" &&
    [
      "awaiting_scan",
      "out_for_scan",
      ...(includePendingScanApproval ? ["awaiting_scan_approval"] : []),
    ].includes(labCase.deliveryStatus ?? "awaiting_scan_approval")
  )
    return "oral-scan";
  if (labCase.status === "Closed" && labCase.deliveryStatus !== "delivered")
    return "delivery";
  return null;
}

function staffRoles(data: OraData, member: StaffMember) {
  return member.roleIds
    .map((id) => data.roles.find((role) => role.id === id))
    .filter((role): role is RoleDefinition => Boolean(role));
}

function hasPermission(
  data: OraData,
  member: StaffMember,
  permission: PermissionKey,
) {
  return staffRoles(data, member).some((role) =>
    role.permissions.includes(permission),
  );
}

function isDeliveryStaff(data: OraData, member: StaffMember) {
  const roles = staffRoles(data, member);
  const isAdminOnly =
    roles.some((role) => role.id === "role-admin") &&
    !roles.some((role) => role.id === "role-delivery");
  return (
    member.active !== false &&
    !isAdminOnly &&
    hasPermission(data, member, "delivery_manage")
  );
}

function memberSpecialties(data: OraData, member: StaffMember) {
  return [
    ...new Set(staffRoles(data, member).flatMap((role) => role.specialties)),
  ];
}

function canHandleStage(data: OraData, member: StaffMember, stage: CaseStatus) {
  return (
    member.active !== false &&
    hasPermission(data, member, "case_workflow") &&
    memberSpecialties(data, member).includes(stage)
  );
}

function roleCanView(view: View, data: OraData, member: StaffMember) {
  const permissionByView: Record<View, PermissionKey> = {
    dashboard: "view_dashboard",
    cases: "view_cases",
    schedule: "view_schedule",
    delivery: "view_delivery",
    doctors: "view_doctors",
    accounting: "view_accounting",
    inventory: "view_inventory",
    team: "view_team",
    log: "audit_view",
    settings: "view_settings",
  };
  return hasPermission(data, member, permissionByView[view]);
}

function paymentState(labCase: LabCase) {
  if (labCase.paid <= 0) return "Unpaid" as const;
  if (labCase.paid + 0.001 >= labCase.price) return "Paid" as const;
  return "Partially paid" as const;
}

function invoiceNumber(labCase: LabCase) {
  return `INV-${labCase.caseNumber.replace(/^ORA-/i, "")}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

function printDocument(title: string, body: string) {
  const popup = window.open("", "_blank", "width=900,height=720");
  if (!popup) return false;
  popup.document
    .write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>
    *{box-sizing:border-box}body{margin:0;padding:38px;color:#17211f;font-family:Arial,sans-serif;font-size:12px}h1,h2,h3,p{margin:0}.print-head{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:22px;border-bottom:2px solid #155f57}.print-brand{font-size:28px;font-weight:800;color:#155f57}.print-brand small{display:block;margin-top:3px;color:#66716f;font-size:10px;letter-spacing:1px;text-transform:uppercase}.print-title{text-align:right}.print-title h1{font-size:22px}.print-title p{margin-top:5px;color:#66716f}.print-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:22px 0}.print-meta div{padding:10px;border:1px solid #dfe5e3}.print-meta small{display:block;margin-bottom:4px;color:#66716f;text-transform:uppercase;font-size:9px}.print-meta strong{font-size:12px}table{width:100%;border-collapse:collapse;margin-top:18px}th{padding:9px;background:#eef3f1;border-bottom:1px solid #bccbc7;text-align:left;font-size:9px;text-transform:uppercase}td{padding:10px 9px;border-bottom:1px solid #dfe5e3}.transaction-invoice td{background:#f1f3f2}.transaction-payment td{background:#f8f9f8}.type-pill{display:inline-block;padding:3px 7px;border-radius:10px;font-size:9px;font-weight:700}.transaction-invoice .type-pill{color:#4f5957;background:#dfe2e1}.transaction-payment .type-pill{color:#66706e;background:#e9ebea}.statement-guide{display:flex;gap:18px;margin:12px 0 4px;color:#66716f;font-size:10px}.num{text-align:right}.print-totals{width:320px;margin:18px 0 0 auto}.print-totals div{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #dfe5e3}.print-totals .grand{font-size:15px;font-weight:800;border-top:2px solid #17211f;border-bottom:0}.status{display:inline-block;padding:4px 8px;border-radius:12px;background:#e4f1ee;color:#155f57;font-size:9px;font-weight:700}.status.unpaid{background:#f7e8e6;color:#a5443d}.status.partial{background:#f8efd8;color:#9a6417}.print-note{margin-top:28px;padding-top:14px;border-top:1px solid #dfe5e3;color:#66716f;font-size:10px}@media print{body{padding:0}@page{margin:18mm}}
  </style></head><body>${body}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),120));<\/script></body></html>`);
  popup.document.close();
  return true;
}

async function roundedQrDataUrl(value: string) {
  const { default: QRCodeStyling } = await import("qr-code-styling");
  const qrCode = new QRCodeStyling({
    width: 140,
    height: 140,
    type: "canvas",
    data: value,
    margin: 4,
    qrOptions: { errorCorrectionLevel: "M" },
    dotsOptions: { color: "#14695f", type: "rounded" },
    cornersSquareOptions: { color: "#0d5149", type: "extra-rounded" },
    cornersDotOptions: { color: "#0d5149", type: "dot" },
    backgroundOptions: { color: "rgba(255,255,255,0)" },
  });
  const image = await qrCode.getRawData("png");
  if (!image) throw new Error("Ora could not generate the case QR code.");
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(
        reader.error ?? new Error("Ora could not prepare the case QR code."),
      );
    reader.readAsDataURL(
      image instanceof Blob
        ? image
        : new Blob([Uint8Array.from(image).buffer], { type: "image/png" }),
    );
  });
}

async function printJobOrderDocument(
  data: OraData,
  labCase: LabCase,
  qrUrl: string,
) {
  const popup = window.open("", "_blank", "width=760,height=920");
  if (!popup) return false;
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  const services = caseServiceLines(labCase)
    .map(
      (line) =>
        `<article class="job-service"><div><small>SERVICE</small><strong>${escapeHtml(line.service)}</strong></div><div><small>TEETH / UNITS</small><strong>${line.units}</strong></div><div><small>SHADE</small><span class="shade-chip">${escapeHtml(line.shade)}</span></div></article>`,
    )
    .join("");
  const notes = labCase.notes.length
    ? `<section class="job-notes"><small>NOTES</small>${labCase.notes.map((note) => `<p>${escapeHtml(note.text)}</p>`).join("")}</section>`
    : "";
  const productionAppointment = `${formatDate(labCase.dueDate)} · ${escapeHtml(labCase.dueTime || "17:00")}`;
  const dentalChartMarkup = await dentalChartPrintMarkup(
    labCase.teeth ?? [],
    labCase.toothConnections ?? [],
  );
  popup.document
    .write(`<!doctype html><html><head><title>Job order ${escapeHtml(labCase.caseNumber)}</title><style>
    *{box-sizing:border-box} @page{size:A5 portrait;margin:9mm} body{margin:0;color:#17211f;font-family:Arial,sans-serif;font-size:10pt;background:#fff}.job-order{width:100%;min-height:192mm;border:1px solid #d6e1de;border-top:5px solid #14695f;padding:8mm}.job-head{display:flex;justify-content:space-between;gap:10mm;padding-bottom:5mm;border-bottom:1px solid #d6e1de}.job-brand{color:#14695f;font-size:21pt;font-weight:800;line-height:1}.job-brand small{display:block;margin-top:3px;color:#6a7774;font-size:7pt;letter-spacing:1.2px;text-transform:uppercase}.job-title{text-align:right}.job-title small{display:block;color:#6a7774;font-size:7pt;letter-spacing:1px;text-transform:uppercase}.job-title strong{display:block;margin-top:4px;font-size:14pt}.job-meta{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin:5mm 0}.job-meta>div{min-height:15mm;padding:3.5mm;border:1px solid #dce6e3;background:#f8fbfa}.job-meta small,.job-section-title,.job-service small,.job-notes>small{display:block;margin-bottom:1.5mm;color:#66716f;font-size:6.5pt;font-weight:700;letter-spacing:.7px}.job-meta strong{font-size:10.5pt}.job-layout{display:grid;grid-template-columns:75mm 1fr;gap:5mm;align-items:start}.job-panel{padding:4mm;border:1px solid #dce6e3}.job-section-title{margin-bottom:3mm}.job-order-teeth{position:relative;width:min(100%,56mm);aspect-ratio:342/671;margin:0 auto;background:#fff}.job-order-teeth svg,.job-order-teeth img{display:block;width:100%;height:100%;object-fit:contain}.job-order-teeth-fallback{display:grid;gap:2mm;text-align:center}.job-services{display:grid;gap:2.5mm}.job-service{display:grid;grid-template-columns:1.35fr .75fr 1fr;gap:2mm;padding:3mm;border:1px solid #dce6e3;background:#f8fbfa}.job-service strong{font-size:9pt}.shade-chip{display:inline-block;padding:1mm 2mm;border:1px solid #c7d4d0;border-radius:7mm;background:#fff;color:#17211f;font-size:8pt;font-weight:700}.appointment-row{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:5mm}.appointment-row>div{padding:3.5mm;border-left:3px solid #14695f;background:#eef6f4}.appointment-row strong{display:block;font-size:9.5pt}.job-notes{margin-top:5mm;padding:3.5mm;border:1px solid #eadfbd;background:#fffbef}.job-notes p{margin:0 0 2mm;line-height:1.4}.job-notes p:last-child{margin-bottom:0}.job-foot{display:flex;justify-content:space-between;gap:4mm;margin-top:5mm;padding-top:3mm;border-top:1px solid #d6e1de;color:#66716f;font-size:7pt}@media print{body{background:#fff}.job-order{min-height:0;border-color:#ccd9d5}.job-order-teeth svg{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><main class="job-order"><header class="job-head"><div class="job-brand">${escapeHtml(data.branding.title)}<small>${escapeHtml(data.branding.subtitle)}</small></div><div class="job-title"><small>Production job order</small><strong>#${escapeHtml(labCase.caseNumber)}</strong></div></header><section class="job-meta"><div><small>DOCTOR</small><strong>${escapeHtml(doctor?.name || "Not recorded")}</strong><br>${escapeHtml(doctor?.clinic || "")}</div><div><small>PATIENT</small><strong>${escapeHtml(labCase.patient)}</strong><br>${escapeHtml(labCase.patientRef)}</div></section><div class="job-layout"><section class="job-panel"><span class="job-section-title">SELECTED TEETH</span>${dentalChartMarkup}</section><section class="job-panel"><span class="job-section-title">SERVICES</span><div class="job-services">${services}</div></section></div><section class="appointment-row"><div><small>PRODUCTION APPOINTMENT</small><strong>${productionAppointment}</strong></div></section>${notes}<footer class="job-foot"><span>Scan the QR code to open this case in Ora.</span><span>Prepared ${escapeHtml(formatDate(toISODate(new Date())))}</span></footer></main><img id="job-qr" alt="Case QR code" style="position:fixed;right:11mm;bottom:11mm;width:26mm;height:26mm"></body></html>`);
  popup.document.close();
  const jobDocument = popup.document;
  const jobStyle = jobDocument.createElement("style");
  jobStyle.textContent =
    "@page{margin:5mm}.job-order{min-height:0;padding:3.8mm;break-inside:avoid}.job-head{padding-bottom:2.5mm}.job-brand{font-size:17pt}.job-meta{grid-template-columns:repeat(3,1fr);margin:2.5mm 0}.job-meta>div{min-height:10mm;padding:2.2mm}.job-layout{grid-template-columns:54mm 1fr;gap:2.5mm;break-inside:avoid}.job-panel{padding:2.2mm}.job-order-teeth{width:min(100%,45mm)}.job-services{gap:1.2mm}.job-service{padding:1.6mm;break-inside:avoid}.job-service strong{font-size:8pt}.job-title{display:flex;align-items:center;justify-content:flex-end;gap:2.5mm}.job-title-copy{text-align:right}.job-title #job-qr{display:block;width:16mm;height:16mm;object-fit:contain}.appointment-row{grid-template-columns:1fr;margin-top:2.5mm;break-inside:avoid}.appointment-row>div{padding:2.2mm}.job-notes{margin-top:2mm;padding:2mm;break-inside:avoid}.job-foot{display:none}";
  jobDocument.head.append(jobStyle);
  const jobTitle = jobDocument.querySelector(".job-title");
  const qrImage = jobDocument.getElementById(
    "job-qr",
  ) as HTMLImageElement | null;
  if (jobTitle && qrImage) {
    const titleCopy = jobDocument.createElement("div");
    titleCopy.className = "job-title-copy";
    while (jobTitle.firstChild) titleCopy.append(jobTitle.firstChild);
    jobTitle.append(titleCopy, qrImage);
    qrImage.removeAttribute("style");
  }
  jobDocument
    .querySelector(".job-meta")
    ?.insertAdjacentHTML(
      "beforeend",
      `<div><small>CASE CREATED</small><strong>${escapeHtml(formatDate(labCase.receivedDate))}</strong></div>`,
    );
  const notesElement = jobDocument.querySelector(".job-notes");
  const servicesPanel = jobDocument.querySelector(
    ".job-layout .job-panel:last-child",
  );
  if (notesElement && servicesPanel) servicesPanel.append(notesElement);
  jobDocument.querySelector(".job-foot")?.remove();
  let printed = false;
  const printWhenReady = () => {
    if (printed || popup.closed) return;
    printed = true;
    popup.focus();
    window.setTimeout(() => popup.print(), 120);
  };
  try {
    const qr = await roundedQrDataUrl(qrUrl);
    const image = jobDocument.getElementById(
      "job-qr",
    ) as HTMLImageElement | null;
    if (image) {
      image.onload = printWhenReady;
      image.onerror = printWhenReady;
      image.src = qr;
      window.setTimeout(printWhenReady, 1400);
    } else printWhenReady();
  } catch {
    printWhenReady();
  }
  return true;
}

async function printCaseStickerDocument(
  data: OraData,
  labCase: LabCase,
  qrUrl: string,
) {
  const popup = window.open("", "_blank", "width=620,height=460");
  if (!popup) return false;
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  const impression = labCase.impressionType === "Oral Scan" ? "OS" : "PI";
  popup.document.write(`<!doctype html><html><head><title>Sticker ${escapeHtml(labCase.caseNumber)}</title><style>
    *{box-sizing:border-box}@page{size:70mm 40mm;margin:0}html,body{width:70mm;height:40mm;margin:0;background:#fff;color:#17211f;font-family:Arial,sans-serif}.case-sticker{width:70mm;height:40mm;display:grid;grid-template-columns:26mm minmax(0,1fr);gap:2.5mm;padding:3mm}.sticker-qr{display:flex;min-height:0;flex-direction:column;align-items:center;justify-content:center;gap:1mm;padding-right:2.5mm;border-right:1px solid #d6e1de}.sticker-qr img{display:block;width:22mm;height:22mm;object-fit:contain}.sticker-qr strong{color:#66716f;font-size:5pt;font-weight:800;letter-spacing:.2px;text-align:center;text-transform:uppercase;white-space:nowrap}.sticker-copy{min-width:0;min-height:0;display:grid;grid-template-rows:auto auto 1fr;align-content:center}.sticker-brand{color:#14695f;font-size:6.8pt;font-weight:800;letter-spacing:.3px;text-transform:uppercase}.sticker-case{margin-top:1mm;font-size:16pt;font-weight:900;line-height:1}.sticker-details{display:grid;gap:1.25mm;margin-top:2mm;padding-top:1.7mm;border-top:1px solid #dce6e3}.sticker-details span{min-width:0}.sticker-details small,.sticker-details strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sticker-details small{color:#66716f;font-size:5.2pt;font-weight:800;text-transform:uppercase}.sticker-details strong{margin-top:.35mm;font-size:7pt;line-height:1.1}@media print{html,body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><main class="case-sticker"><section class="sticker-qr"><img id="sticker-qr" alt="Case QR code"><strong>${impression} · #${escapeHtml(labCase.caseNumber)}</strong></section><section class="sticker-copy"><div class="sticker-brand">${escapeHtml(data.branding.title)}</div><div class="sticker-case">#${escapeHtml(labCase.caseNumber)}</div><div class="sticker-details"><span><small>Doctor</small><strong>${escapeHtml(doctor?.name || "Not recorded")}</strong></span><span><small>Patient</small><strong>${escapeHtml(labCase.patient || "Not recorded")}</strong></span></div></section></main></body></html>`);
  popup.document.close();
  let printed = false;
  const printWhenReady = () => {
    if (printed || popup.closed) return;
    printed = true;
    popup.focus();
    window.setTimeout(() => popup.print(), 120);
  };
  try {
    const qr = await roundedQrDataUrl(qrUrl);
    const image = popup.document.getElementById(
      "sticker-qr",
    ) as HTMLImageElement | null;
    if (image) {
      image.onload = printWhenReady;
      image.onerror = printWhenReady;
      image.src = qr;
      window.setTimeout(printWhenReady, 1400);
    } else printWhenReady();
  } catch {
    printWhenReady();
  }
  return true;
}

function printInvoiceDocument(data: OraData, labCase: LabCase) {
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  const status = paymentState(labCase);
  const serviceRows = caseServiceLines(labCase)
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.service)}</td><td>${escapeHtml(line.shade)}</td><td class="num">${line.units}</td><td class="num">${escapeHtml(money(line.unitPrice, data.currency))}</td><td class="num">${escapeHtml(money(line.unitPrice * line.units, data.currency))}</td></tr>`,
    )
    .join("");
  return printDocument(
    `Invoice ${labCase.caseNumber}`,
    `
    <header class="print-head"><div class="print-brand">Ora<small>Dental Lab</small></div><div class="print-title"><h1>CASE INVOICE</h1><p>${escapeHtml(invoiceNumber(labCase))}</p></div></header>
    <section class="print-meta"><div><small>Doctor account</small><strong>${escapeHtml(doctor?.name)}</strong><br>${escapeHtml(doctor?.clinic)}</div><div><small>Patient</small><strong>${escapeHtml(labCase.patient)}</strong><br>${escapeHtml(labCase.patientRef)}</div><div><small>Invoice date</small><strong>${escapeHtml(formatDate(labCase.receivedDate))}</strong></div><div><small>Case reference</small><strong>${escapeHtml(labCase.caseNumber)}</strong></div><div><small>Payment status</small><span class="status ${status === "Unpaid" ? "unpaid" : status === "Partially paid" ? "partial" : ""}">${escapeHtml(status)}</span></div></section>
    <table><thead><tr><th>Service</th><th>Shade</th><th class="num">Teeth / units</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead><tbody>${serviceRows}</tbody></table>
    <section class="print-totals"><div><span>Invoice total</span><strong>${escapeHtml(money(labCase.price, data.currency))}</strong></div><div><span>Paid</span><strong>${escapeHtml(money(labCase.paid, data.currency))}</strong></div><div class="grand"><span>Balance due</span><strong>${escapeHtml(money(labCase.price - labCase.paid, data.currency))}</strong></div></section>
    <p class="print-note">Due ${escapeHtml(formatDue(labCase))}. A closed production case may retain an outstanding balance on the doctor account until payment is recorded.</p>
  `,
  );
}

function doctorStatementSnapshot(data: OraData, doctor: Doctor, start: string) {
  const doctorCases = data.cases.filter((item) => item.doctorId === doctor.id);
  const doctorPayments = data.payments.filter(
    (item) => item.doctorId === doctor.id,
  );
  const openingCharges = doctorCases
    .filter((item) => item.receivedDate < start)
    .reduce((sum, item) => sum + item.price, 0);
  const openingPayments = doctorPayments
    .filter((item) => item.date.slice(0, 10) < start)
    .reduce((sum, item) => sum + item.amount, 0);
  const openingBalance = openingCharges - openingPayments;
  const periodCases = doctorCases.filter((item) => item.receivedDate >= start);
  const periodPayments = doctorPayments.filter(
    (item) => item.date.slice(0, 10) >= start,
  );
  const charges = periodCases.reduce((sum, item) => sum + item.price, 0);
  const payments = periodPayments.reduce((sum, item) => sum + item.amount, 0);
  const entries = [
    ...periodCases.map((item) => ({
      date: item.receivedDate,
      type: "Invoice",
      reference: invoiceNumber(item),
      patient: item.patient,
      patientRef: item.patientRef,
      description: caseServiceSummary(item),
      debit: item.price,
      credit: 0,
    })),
    ...periodPayments.map((item) => {
      const labCase = data.cases.find((entry) => entry.id === item.caseId);
      const description =
        item.note === "Paid total adjusted" ||
        item.note === "Marked unpaid" ||
        item.note === "Marked paid in full"
          ? item.amount >= 0
            ? "Payment received"
            : "Payment correction"
          : item.note ||
            (item.amount >= 0 ? "Payment received" : "Payment correction");
      return {
        date: item.date.slice(0, 10),
        type: "Payment",
        reference: labCase ? invoiceNumber(labCase) : "Account",
        patient: labCase?.patient ?? "Account payment",
        patientRef: labCase?.patientRef ?? "",
        description,
        debit: item.amount < 0 ? Math.abs(item.amount) : 0,
        credit: item.amount > 0 ? item.amount : 0,
      };
    }),
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || (a.type === "Invoice" ? -1 : 1),
  );
  let runningBalance = openingBalance;
  const rows = entries.map((entry) => {
    runningBalance += entry.debit - entry.credit;
    return { ...entry, balance: runningBalance };
  });
  const currentBalance = doctorCases.reduce(
    (sum, item) => sum + item.price - item.paid,
    0,
  );
  const overdue = doctorCases
    .filter((item) => isCaseOverdue(item) && item.paid < item.price)
    .reduce((sum, item) => sum + item.price - item.paid, 0);
  return {
    openingBalance,
    charges,
    payments,
    endingBalance: openingBalance + charges - payments,
    currentBalance,
    overdue,
    rows,
  };
}

function printDoctorStatement(
  data: OraData,
  doctor: Doctor,
  start: string,
  periodLabel: string,
) {
  const snapshot = doctorStatementSnapshot(data, doctor, start);
  const rows = snapshot.rows
    .map(
      (item) =>
        `<tr class="transaction-${item.type.toLowerCase()}"><td>${escapeHtml(formatDate(item.date, { day: "2-digit", month: "short", year: "numeric" }))}</td><td><span class="type-pill">${escapeHtml(item.type)}</span><br>${escapeHtml(item.reference)}</td><td>${escapeHtml(item.patient)}</td><td>${escapeHtml(item.description)}</td><td class="num">${item.debit ? escapeHtml(money(item.debit, data.currency)) : "—"}</td><td class="num">${item.credit ? escapeHtml(money(item.credit, data.currency)) : "—"}</td><td class="num">${escapeHtml(money(item.balance, data.currency))}</td></tr>`,
    )
    .join("");
  return printDocument(
    `${doctor.name} account statement`,
    `
    <header class="print-head"><div class="print-brand">Ora<small>Dental Lab</small></div><div class="print-title"><h1>ACCOUNT STATEMENT</h1><p>${escapeHtml(periodLabel)}</p></div></header>
    <section class="print-meta"><div><small>Doctor account</small><strong>${escapeHtml(doctor.name)}</strong><br>${escapeHtml(doctor.clinic)}</div><div><small>Statement generated</small><strong>${escapeHtml(formatDate(toISODate(new Date())))}</strong></div><div><small>Current outstanding</small><strong>${escapeHtml(money(snapshot.currentBalance, data.currency))}</strong></div><div><small>Overdue amount</small><strong>${escapeHtml(money(snapshot.overdue, data.currency))}</strong></div></section>
    <div class="statement-guide"><span>Light gray: invoices</span><span>Soft gray: payments</span></div>
    <table><thead><tr><th>Date</th><th>Transaction</th><th>Patient</th><th>Description</th><th class="num">Charge</th><th class="num">Payment</th><th class="num">Balance</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No transactions in this period.</td></tr>'}</tbody></table>
    <section class="print-totals"><div><span>Opening balance</span><strong>${escapeHtml(money(snapshot.openingBalance, data.currency))}</strong></div><div><span>New charges</span><strong>${escapeHtml(money(snapshot.charges, data.currency))}</strong></div><div><span>Payments</span><strong>${escapeHtml(money(snapshot.payments, data.currency))}</strong></div><div class="grand"><span>Ending balance</span><strong>${escapeHtml(money(snapshot.endingBalance, data.currency))}</strong></div></section>
    <p class="print-note">Outstanding balances include unpaid and partially paid cases, including cases whose production workflow has been closed.</p>
  `,
  );
}

function printAccountingStatement(
  data: OraData,
  start: string,
  periodLabel: string,
) {
  const cases = data.cases.filter((item) => item.receivedDate >= start);
  const payments = data.payments.filter(
    (item) => item.date.slice(0, 10) >= start,
  );
  const expenses = data.expenses.filter((item) => item.date >= start);
  const charges = cases.reduce((sum, item) => sum + item.price, 0);
  const collected = payments.reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const rows = cases
    .map(
      (item) =>
        `<tr><td>${escapeHtml(formatDate(item.receivedDate))}</td><td>${escapeHtml(invoiceNumber(item))}</td><td>${escapeHtml(data.doctors.find((doctor) => doctor.id === item.doctorId)?.name)}</td><td>${escapeHtml(item.patient)}</td><td>${escapeHtml(caseServiceSummary(item))}</td><td class="num">${escapeHtml(money(item.price, data.currency))}</td><td class="num">${escapeHtml(money(item.paid, data.currency))}</td></tr>`,
    )
    .join("");
  return printDocument(
    `Ora accounting statement - ${periodLabel}`,
    `
    <header class="print-head"><div class="print-brand">Ora<small>Dental Lab</small></div><div class="print-title"><h1>ACCOUNTING STATEMENT</h1><p>${escapeHtml(periodLabel)}</p></div></header>
    <section class="print-meta"><div><small>Case charges</small><strong>${escapeHtml(money(charges, data.currency))}</strong></div><div><small>Payments received</small><strong>${escapeHtml(money(collected, data.currency))}</strong></div><div><small>Expenses</small><strong>${escapeHtml(money(expenseTotal, data.currency))}</strong></div><div><small>Net cash</small><strong>${escapeHtml(money(collected - expenseTotal, data.currency))}</strong></div></section>
    <table><thead><tr><th>Date</th><th>Invoice</th><th>Doctor</th><th>Patient</th><th>Description</th><th class="num">Total</th><th class="num">Paid</th></tr></thead><tbody>${rows || '<tr><td colspan="7">No case invoices in this period.</td></tr>'}</tbody></table>
    <section class="print-totals"><div><span>Invoices</span><strong>${cases.length}</strong></div><div><span>Expense entries</span><strong>${expenses.length}</strong></div><div class="grand"><span>Net cash</span><strong>${escapeHtml(money(collected - expenseTotal, data.currency))}</strong></div></section>
  `,
  );
}

async function exportAccountingStatementPdf(
  data: OraData,
  start: string,
  periodLabel: string,
) {
  const { jsPDF } = await import("jspdf");
  const cases = data.cases.filter((item) => item.receivedDate >= start);
  const payments = data.payments.filter(
    (item) => item.date.slice(0, 10) >= start,
  );
  const expenses = data.expenses.filter((item) => item.date >= start);
  const charges = cases.reduce((sum, item) => sum + item.price, 0);
  const collected = payments.reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;
  const drawHeading = () => {
    doc.setTextColor(20, 105, 95);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(21);
    doc.text(data.branding.title, 16, y);
    doc.setTextColor(85, 98, 95);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(data.branding.subtitle.toUpperCase(), 16, y + 5);
    doc.setTextColor(23, 33, 31);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("ACCOUNTING STATEMENT", pageWidth - 16, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(102, 113, 111);
    doc.text(periodLabel, pageWidth - 16, y + 5, { align: "right" });
    y += 14;
  };
  const metric = (label: string, value: string, x: number) => {
    doc.setDrawColor(215, 226, 222);
    doc.setFillColor(248, 251, 250);
    doc.roundedRect(x, y, 60, 20, 1.5, 1.5, "FD");
    doc.setFontSize(7);
    doc.setTextColor(102, 113, 111);
    doc.text(label.toUpperCase(), x + 4, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(23, 33, 31);
    doc.text(value, x + 4, y + 14);
    doc.setFont("helvetica", "normal");
  };
  const ensureSpace = (required: number) => {
    if (y + required < 190) return;
    doc.addPage();
    y = 16;
    drawHeading();
  };
  drawHeading();
  metric("Case charges", money(charges, data.currency), 16);
  metric("Payments received", money(collected, data.currency), 80);
  metric("Expenses", money(expenseTotal, data.currency), 144);
  metric("Net cash", money(collected - expenseTotal, data.currency), 208);
  y += 29;
  doc.setDrawColor(190, 203, 199);
  doc.line(16, y, pageWidth - 16, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(23, 33, 31);
  doc.text("CASE INVOICES", 16, y);
  y += 6;
  const columns = [16, 41, 73, 127, 182, 221, 251];
  const header = () => {
    doc.setFillColor(238, 244, 242);
    doc.rect(16, y - 4, pageWidth - 32, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(72, 85, 82);
    [
      "Date",
      "Invoice",
      "Doctor",
      "Patient",
      "Services",
      "Total",
      "Paid",
    ].forEach((item, index) => doc.text(item.toUpperCase(), columns[index], y));
    y += 6;
  };
  header();
  doc.setFont("helvetica", "normal");
  cases
    .sort((a, b) => a.receivedDate.localeCompare(b.receivedDate))
    .forEach((item) => {
      ensureSpace(7);
      if (y === 30) header();
      const doctor = data.doctors.find((entry) => entry.id === item.doctorId);
      const row = [
        formatDate(item.receivedDate, {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        }),
        invoiceNumber(item),
        doctor?.name ?? "",
        item.patient,
        caseServiceSummary(item),
        money(item.price, data.currency),
        money(item.paid, data.currency),
      ];
      doc.setFontSize(7.5);
      doc.setTextColor(36, 46, 44);
      row.forEach((value, index) =>
        doc.text(
          doc.splitTextToSize(value, index === 4 ? 34 : 27)[0] ?? "",
          columns[index],
          y,
        ),
      );
      doc.setDrawColor(228, 234, 232);
      doc.line(16, y + 2.5, pageWidth - 16, y + 2.5);
      y += 6;
    });
  if (!cases.length) {
    doc.setFontSize(8);
    doc.setTextColor(102, 113, 111);
    doc.text("No case invoices in this period.", 16, y + 2);
    y += 8;
  }
  ensureSpace(22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(23, 33, 31);
  doc.text("EXPENSE SUMMARY", 16, y + 8);
  y += 14;
  const categoryTotals = Object.entries(
    expenses.reduce<Record<string, number>>(
      (totals, expense) => ({
        ...totals,
        [expense.category]: (totals[expense.category] ?? 0) + expense.amount,
      }),
      {},
    ),
  );
  categoryTotals.forEach(([category, amount]) => {
    ensureSpace(7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(category, 16, y);
    doc.setFont("helvetica", "bold");
    doc.text(money(amount, data.currency), 102, y, { align: "right" });
    doc.setDrawColor(228, 234, 232);
    doc.line(16, y + 2.5, 102, y + 2.5);
    y += 6;
  });
  if (!categoryTotals.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(102, 113, 111);
    doc.text("No expenses in this period.", 16, y);
  }
  doc.save(`ora-accounting-${start}.pdf`);
}

function printClinicStatement(
  data: OraData,
  clinic: string,
  start: string,
  periodLabel: string,
) {
  const doctorIds = data.doctors
    .filter((doctor) => doctor.active !== false && doctor.clinic === clinic)
    .map((doctor) => doctor.id);
  const cases = data.cases.filter(
    (item) => doctorIds.includes(item.doctorId) && item.receivedDate >= start,
  );
  const payments = data.payments.filter(
    (item) =>
      doctorIds.includes(item.doctorId) && item.date.slice(0, 10) >= start,
  );
  const currentBalance = data.cases
    .filter((item) => doctorIds.includes(item.doctorId))
    .reduce((sum, item) => sum + item.price - item.paid, 0);
  const rows = [
    ...cases.map((item) => ({
      date: item.receivedDate,
      type: "Invoice",
      doctor:
        data.doctors.find((entry) => entry.id === item.doctorId)?.name ?? "",
      ref: invoiceNumber(item),
      patient: item.patient,
      amount: item.price,
    })),
    ...payments.map((item) => {
      const labCase = data.cases.find((entry) => entry.id === item.caseId);
      return {
        date: item.date.slice(0, 10),
        type: "Payment",
        doctor:
          data.doctors.find((entry) => entry.id === item.doctorId)?.name ?? "",
        ref: labCase ? invoiceNumber(labCase) : "Account",
        patient: labCase?.patient ?? "",
        amount: -item.amount,
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const bodyRows = rows
    .map(
      (item) =>
        `<tr class="transaction-${item.type.toLowerCase()}"><td>${escapeHtml(formatDate(item.date))}</td><td><span class="type-pill">${item.type}</span><br>${escapeHtml(item.ref)}</td><td>${escapeHtml(item.doctor)}</td><td>${escapeHtml(item.patient)}</td><td class="num">${escapeHtml(money(item.amount, data.currency))}</td></tr>`,
    )
    .join("");
  return printDocument(
    `${clinic} statement`,
    `<header class="print-head"><div class="print-brand">${escapeHtml(data.branding.title)}<small>${escapeHtml(data.branding.subtitle)}</small></div><div class="print-title"><h1>CLINIC STATEMENT</h1><p>${escapeHtml(periodLabel)}</p></div></header><section class="print-meta"><div><small>Clinic</small><strong>${escapeHtml(clinic)}</strong></div><div><small>Doctors</small><strong>${doctorIds.length}</strong></div><div><small>Current outstanding</small><strong>${escapeHtml(money(currentBalance, data.currency))}</strong></div><div><small>Generated</small><strong>${escapeHtml(formatDate(toISODate(new Date())))}</strong></div></section><table><thead><tr><th>Date</th><th>Transaction</th><th>Doctor</th><th>Patient</th><th class="num">Amount</th></tr></thead><tbody>${bodyRows || '<tr><td colspan="5">No transactions in this period.</td></tr>'}</tbody></table>`,
  );
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function displayCaseStatus(labCase: LabCase): DisplayCaseStatus {
  if (labCase.onHold) return "On hold";
  if (labCase.intakeApprovalPending) return "Awaiting Approval";
  if (
    labCase.status === "Closed" &&
    labCase.deliveryStatus === "out_for_delivery"
  )
    return "Out for Delivery";
  if (labCase.status === "Closed" && labCase.deliveryStatus === "delivered")
    return "Delivered";
  return labCase.status;
}

function StatusBadge({ status }: { status: DisplayCaseStatus }) {
  const outlined = status === "On hold" || status === "Awaiting Approval";
  return (
    <span
      className={`status-badge ${STATUS_TONE[status]} ${outlined ? "outlined" : ""}`}
    >
      <i />
      <span>{status}</span>
    </span>
  );
}

function PaymentBadge({ labCase }: { labCase: LabCase }) {
  const state = paymentState(labCase);
  return (
    <span
      className={`payment-badge ${state === "Paid" ? "paid" : state === "Partially paid" ? "partial" : "unpaid"}`}
    >
      {state}
    </span>
  );
}

function ImpressionBadge({ type }: { type: ImpressionType }) {
  const short = type === "Oral Scan" ? "OS" : "PI";
  return (
    <span className={`impression-badge ${short.toLowerCase()}`} title={type}>
      {short}
    </span>
  );
}

function CaseTags({ labCase }: { labCase: LabCase }) {
  return (
    <>
      {caseTags(labCase).map((tag) => (
        <small
          key={tag}
          className={tag === "Rush" ? "rush-label" : "remake-label"}
        >
          {tag}
        </small>
      ))}
    </>
  );
}

function CompactDatePicker({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const initial = value ? new Date(`${value}T12:00:00`) : new Date();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerId = useRef(`date:${name}`);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
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
      const top =
        rect.bottom + 6 + 340 > window.innerHeight
          ? Math.max(8, rect.top - 346)
          : rect.bottom + 6;
      setPosition({
        top,
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
              const outside = day.getMonth() !== month.getMonth();
              return (
                <button
                  className={`${iso === value ? "selected" : ""} ${outside ? "outside" : ""}`}
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
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12));
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
    <div className="field compact-picker-field">
      <span>{label}</span>
      <input type="hidden" name={name} value={value} />
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

function CompactTimePicker({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pickerId = useRef(`time:${name}`);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [hour, setHour] = useState(value.slice(0, 2) || "08");
  const [minute, setMinute] = useState(value.slice(3, 5) || "00");
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
      setHour(value.slice(0, 2) || "08");
      setMinute(value.slice(3, 5) || "00");
      const rect = triggerRef.current.getBoundingClientRect();
      const top =
        rect.bottom + 6 + 220 > window.innerHeight
          ? Math.max(8, rect.top - 226)
          : rect.bottom + 6;
      setPosition({
        top,
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
    <div className="field compact-picker-field">
      <span>{label}</span>
      <input type="hidden" name={name} value={value} />
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

export function AuthFlow({
  data,
  onLogin,
}: {
  data: OraData;
  onLogin: (result: LoginResult) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    window.setTimeout(() => {
      setBusy(false);
      const doctor = data.doctors.find(
        (item) =>
          item.active !== false &&
          item.portalAccount?.username.toLowerCase() ===
            username.toLowerCase() &&
          item.portalAccount.password === password,
      );
      if (doctor) {
        onLogin({ kind: "doctor", doctorId: doctor.id });
        return;
      }
      const staff = data.staff.find(
        (item) =>
          item.active !== false &&
          [item.name, item.id].some(
            (value) => value.toLowerCase() === username.toLowerCase(),
          ),
      );
      if (staff) {
        onLogin({ kind: "staff", staffId: staff.id });
        return;
      }
      setError("Those details do not match an active Ora account.");
    }, 180);
  }
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-lockup large">
          <span className="brand-mark">O</span>
          <div>
            <strong>Ora</strong>
            <small>Dental Lab</small>
          </div>
        </div>
        <div className="login-copy">
          <h1>Welcome to Ora</h1>
          <p>Sign in to the lab workspace or your doctor portal.</p>
        </div>
        <form className="auth-form" onSubmit={submitLogin}>
          <label className="field">
            <span>Username</span>
            <input
              autoFocus
              name="username"
              placeholder="Name"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              name="password"
              type="password"
              placeholder="Password"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button full" type="submit" disabled={busy}>
            <LockKeyhole size={17} />
            {busy ? "Opening..." : "Sign in"}
          </button>
        </form>
      </section>
      <aside className="login-aside">
        <div className="login-stat">
          <span>Dental laboratory workspace</span>
          <strong>Cases, costs and production in one place.</strong>
        </div>
        <div className="login-steps">
          <span className="done">1</span>
          <i />
          <span className="done">2</span>
          <i />
          <span>3</span>
        </div>
        <p>
          Received <ChevronRight size={15} /> Production{" "}
          <ChevronRight size={15} /> Quality Review
        </p>
      </aside>
    </main>
  );
}

const DEMO_DATA = createDemoData();

export default function Home() {
  const [data, setData] = useState<OraData | null>(() => DEMO_DATA);
  const [loadError] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<AuthNext | "checking">("ready");
  const [authUser, setAuthUser] = useState<AuthUser | null>({
    username: "hassan",
    staffId: "staff-admin",
    name: "Hassan",
    isOwner: true,
    mfaEnabled: false,
  });
  const [activeStaffId, setActiveStaffId] = useState<string | null>(
    "staff-admin",
  );
  const [portalDoctorId, setPortalDoctorId] = useState<string | null>(null);
  const [portalPreviewDoctorId, setPortalPreviewDoctorId] = useState<
    string | null
  >(null);
  const [view, setView] = useState<View>("dashboard");
  const [modal, setModal] = useState<ModalName>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [deliveryCaseId, setDeliveryCaseId] = useState<string | null>(null);
  const [qrCaseId, setQrCaseId] = useState<string | null>(null);
  const [invoiceCaseId, setInvoiceCaseId] = useState<string | null>(null);
  const [paymentCaseId, setPaymentCaseId] = useState<string | null>(null);
  const [statementDoctorId, setStatementDoctorId] = useState<string | null>(
    null,
  );
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(
    null,
  );
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [staffStatementId, setStaffStatementId] = useState<string | null>(null);
  const [highlightedCaseId, setHighlightedCaseId] = useState<string | null>(
    null,
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [caseStatus, setCaseStatusFilter] = useState<"All" | DisplayCaseStatus>(
    "All",
  );
  const [statementPeriod, setStatementPeriod] = useState<
    "day" | "week" | "month" | "year" | "all"
  >("month");
  const [toast, setToast] = useState<string | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<OraData | null>(DEMO_DATA);

  useEffect(() => {
    if (!data) return;
    document.documentElement.dataset.theme = data.theme;
    document.documentElement.style.colorScheme = data.theme;
  }, [data]);

  useEffect(() => {
    if (!highlightedCaseId) return;
    const timer = window.setTimeout(() => setHighlightedCaseId(null), 1400);
    return () => window.clearTimeout(timer);
  }, [highlightedCaseId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!data) return;
    const target = caseQrTargetFromCurrentUrl();
    if (!target || !data.cases.some((item) => item.id === target.caseId))
      return;
    const labCase = data.cases.find((item) => item.id === target.caseId)!;
    const member = activeStaffId
      ? data.staff.find((item) => item.id === activeStaffId)
      : undefined;
    const deliveryOnly = Boolean(
      member &&
      hasPermission(data, member, "view_delivery") &&
      !hasPermission(data, member, "view_cases"),
    );
    const timer = window.setTimeout(() => {
      const canOpenDelivery = Boolean(
        member && hasPermission(data, member, "view_delivery"),
      );
      if (target.destination === "delivery" && canOpenDelivery) {
        setView("delivery");
        setDeliveryCaseId(labCase.id);
      } else if (deliveryOnly) {
        setToast(
          target.destination === "delivery"
            ? "This sticker QR requires delivery access."
            : "This job order QR requires case access.",
        );
      } else if (!member || !hasPermission(data, member, "view_cases")) {
        setToast("Your account does not have access to this case.");
      } else {
        setView("cases");
        setSelectedCaseId(labCase.id);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeStaffId, data]);

  function login(result: LoginResult) {
    setAuthStep("ready");
    setPortalPreviewDoctorId(null);
    if (result.kind === "doctor") {
      const doctor = data?.doctors.find((item) => item.id === result.doctorId);
      setPortalDoctorId(result.doctorId);
      setActiveStaffId(null);
      setAuthUser(
        doctor
          ? {
              username: doctor.portalAccount?.username ?? doctor.name,
              staffId: "",
              name: doctor.name,
            }
          : null,
      );
      return;
    }
    const staff = data?.staff.find((item) => item.id === result.staffId);
    setPortalDoctorId(null);
    setActiveStaffId(result.staffId);
    setAuthUser(
      staff
        ? {
            username: staff.name.toLowerCase(),
            staffId: staff.id,
            name: staff.name,
            isOwner: staff.id === "staff-admin",
            mfaEnabled: false,
          }
        : null,
    );
  }

  if (authStep === "checking")
    return (
      <main className="app-loading">
        <div className="brand-mark">O</div>
        <p>{loadError ?? "Checking your secure Ora session..."}</p>
        {loadError && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        )}
      </main>
    );
  if (authStep !== "ready")
    return data ? (
      <AuthFlow data={data} onLogin={login} />
    ) : (
      <main className="app-loading">
        <div className="brand-mark">O</div>
        <p>Opening Ora...</p>
      </main>
    );
  if (!data)
    return (
      <main className="app-loading">
        <div className="brand-mark">O</div>
        <p>{loadError ?? "Opening shared Ora workspace..."}</p>
        {loadError && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        )}
      </main>
    );
  const portalDoctor = data.doctors.find(
    (item) =>
      item.id === (portalPreviewDoctorId ?? portalDoctorId) &&
      item.active !== false,
  );
  if (portalDoctor)
    return (
      <DoctorPortalPage
        data={data}
        doctor={portalDoctor}
        preview={Boolean(portalPreviewDoctorId)}
        onUpdate={update}
        onExit={() => {
          if (portalPreviewDoctorId) {
            setPortalPreviewDoctorId(null);
            return;
          }
          setPortalDoctorId(null);
          setAuthUser(null);
          setAuthStep("login");
        }}
      />
    );
  if (
    !activeStaffId ||
    !data.staff.some(
      (member) => member.id === activeStaffId && member.active !== false,
    )
  )
    return (
      <main className="app-loading">
        <p>
          Your staff profile is unavailable. Ask the Ora owner to review the
          account.
        </p>
      </main>
    );

  const ora = data;
  const activeStaff = ora.staff.find((member) => member.id === activeStaffId)!;
  const permittedView = roleCanView(view, ora, activeStaff)
    ? view
    : roleCanView("delivery", ora, activeStaff)
      ? "delivery"
      : "dashboard";
  const intakeAllowed = hasPermission(ora, activeStaff, "case_intake");
  const isAdmin = staffRoles(ora, activeStaff).some(
    (role) => role.id === "role-admin",
  );
  const canApproveOralScans =
    isAdmin ||
    staffRoles(ora, activeStaff).some((role) => role.id === "role-input");
  const isDeliveryDriver =
    !isAdmin && hasPermission(ora, activeStaff, "delivery_manage");
  const canManageDoctorHistory = staffRoles(ora, activeStaff).some(
    (role) => role.id === "role-admin" || role.id === "role-accountant",
  );
  const selectedCase = data.cases.find((item) => item.id === selectedCaseId);
  const deliveryCase = data.cases.find((item) => item.id === deliveryCaseId);
  const invoiceCase = data.cases.find((item) => item.id === invoiceCaseId);
  const paymentCase = data.cases.find((item) => item.id === paymentCaseId);
  const statementDoctor = data.doctors.find(
    (item) => item.id === statementDoctorId,
  );
  const selectedStaff = data.staff.find((item) => item.id === selectedStaffId);
  const selectedRole = data.roles.find((item) => item.id === selectedRoleId);
  const statementStaff = data.staff.find(
    (item) => item.id === staffStatementId,
  );
  const today = toISODate(new Date());
  const activeCases = data.cases.filter(
    (item) => !item.archived && item.status !== "Closed",
  );
  const dueToday = activeCases.filter((item) => item.dueDate === today);
  const overdue = activeCases.filter(
    (item) => isCaseOverdue(item) && item.status !== "Quality Review",
  );
  const ready = activeCases.filter((item) => item.status === "Quality Review");
  const lowStock = data.materials.filter((item) => item.stock <= item.lowStock);

  const filteredCases = data.cases.filter((item) => {
    const doctor = data.doctors.find((entry) => entry.id === item.doctorId);
    const text =
      `${item.caseNumber} ${item.patient} ${item.patientRef} ${doctor?.name ?? ""} ${caseServiceSummary(item)}`.toLowerCase();
    return (
      text.includes(search.toLowerCase()) &&
      (caseStatus === "All" || displayCaseStatus(item) === caseStatus)
    );
  });

  function update(updater: DataUpdater) {
    const current = dataRef.current;
    if (!current) return;
    const next = updater(current);
    dataRef.current = next;
    setData(next);
  }

  function addActivity(
    action: string,
    staffId = activeStaff.id,
    entityType?: OraData["activities"][number]["entityType"],
    entityId?: string,
  ) {
    update((current) => ({
      ...current,
      activities: [
        {
          id: uid("act"),
          date: new Date().toISOString(),
          staffId,
          action,
          entityType,
          entityId,
        },
        ...current.activities,
      ].slice(0, 500),
    }));
  }

  function goTo(nextView: View) {
    if (!roleCanView(nextView, ora, activeStaff)) {
      setToast(
        `${activeStaff.role} access does not include ${VIEW_COPY[nextView].title.toLowerCase()}.`,
      );
      return;
    }
    setView(nextView);
    setMobileNav(false);
  }

  function openCaseFromQr(value: string) {
    try {
      const target = qrTargetFromUrl(value);
      if (!target || !ora.cases.some((item) => item.id === target.caseId))
        throw new Error("Unknown case");
      const labCase = ora.cases.find((item) => item.id === target.caseId)!;
      const deliveryOnly =
        hasPermission(ora, activeStaff, "view_delivery") &&
        !hasPermission(ora, activeStaff, "view_cases");
      if (target.destination === "delivery") {
        if (!hasPermission(ora, activeStaff, "view_delivery"))
          throw new Error("Delivery access is required");
        setView("delivery");
        setDeliveryCaseId(labCase.id);
        setModal(null);
        return;
      }
      if (deliveryOnly || !hasPermission(ora, activeStaff, "view_cases"))
        throw new Error("Case access is required");
      setView("cases");
      setSelectedCaseId(labCase.id);
      setModal(null);
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?case=${encodeURIComponent(labCase.id)}&qr=job-order`,
      );
    } catch {
      setToast("This is not a valid Ora case QR code.");
    }
  }

  function caseQrUrl(
    caseId: string,
    kind: "job-order" | "sticker" = "job-order",
  ) {
    return `${window.location.origin}${window.location.pathname}?case=${encodeURIComponent(caseId)}&qr=${kind}`;
  }

  function logout() {
    setPortalDoctorId(null);
    setPortalPreviewDoctorId(null);
    setActiveStaffId(null);
    setAuthUser(null);
    setAuthStep("login");
  }

  function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasPermission(ora, activeStaff, "case_intake")) {
      setToast("Only Admin or Input Manager staff can create cases.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const doctorId = String(form.get("doctorId"));
    const doctor = ora.doctors.find((item) => item.id === doctorId);
    if (!doctor) return;
    let serviceLines: CaseServiceLine[] = [];
    try {
      const submitted = JSON.parse(
        String(form.get("serviceLines") || "[]"),
      ) as CaseServiceLine[];
      serviceLines = submitted
        .map((line) => ({
          ...line,
          id: line.id || uid("service"),
          service: String(line.service).trim(),
          units: Math.max(1, Number(line.units) || 1),
          shade: String(line.shade || "Not recorded").trim(),
          unitPrice: Math.max(0, Number(line.unitPrice) || 0),
        }))
        .filter((line) => line.service);
    } catch {}
    if (!serviceLines.length) {
      setToast("Add at least one service to the case.");
      return;
    }
    let teeth: string[] = [];
    let toothConnections: string[] = [];
    try {
      const submittedTeeth = JSON.parse(String(form.get("teeth") || "[]"));
      teeth = Array.isArray(submittedTeeth)
        ? [
            ...new Set(
              submittedTeeth
                .map((tooth) => String(tooth))
                .filter((tooth) => /^\d{2}$/.test(tooth)),
            ),
          ]
        : [];
      const submittedConnections = JSON.parse(
        String(form.get("toothConnections") || "[]"),
      );
      toothConnections = Array.isArray(submittedConnections)
        ? [
            ...new Set(
              submittedConnections
                .map((connection) => String(connection))
                .filter((connection) => {
                  const pair = connection.split(":");
                  return (
                    pair.length === 2 &&
                    pair.every((tooth) => teeth.includes(tooth))
                  );
                }),
            ),
          ]
        : [];
    } catch {}
    const units = serviceLines.reduce((sum, line) => sum + line.units, 0);
    const materialId = String(form.get("materialId") ?? "");
    const materialQty = Number(form.get("materialQty") ?? 0);
    let priorityTags: CaseTag[] = [];
    try {
      const submittedTags = JSON.parse(
        String(form.get("priorityTags") || "[]"),
      );
      priorityTags = Array.isArray(submittedTags)
        ? [
            ...new Set(
              submittedTags.filter(
                (tag): tag is CaseTag => tag === "Rush" || tag === "Remake",
              ),
            ),
          ]
        : [];
    } catch {}
    const assignedTo = activeStaff.id;
    const maxNumber = Math.max(
      ...ora.cases.map(
        (item) => Number(item.caseNumber.replace(/^ORA-/i, "")) || 1000,
      ),
    );
    const id = uid("case");
    const labCase: LabCase = {
      id,
      caseNumber: String(maxNumber + 1),
      doctorId,
      patient: String(form.get("patient")),
      patientRef: String(form.get("patientRef")),
      service: serviceLines[0].service,
      units,
      shade: serviceLines[0].shade,
      serviceLines,
      teeth,
      toothConnections,
      receivedDate: today,
      dueDate: String(form.get("dueDate")),
      dueTime: String(form.get("dueTime") || "17:00"),
      appointmentDate: String(
        form.get("appointmentDate") || form.get("dueDate"),
      ),
      appointmentTime: String(form.get("appointmentTime") || "17:00"),
      impressionType: String(form.get("impressionType")) as ImpressionType,
      status: "Received",
      priority: priorityTags.includes("Rush") ? "Rush" : "Normal",
      priorityTags,
      assignedTo,
      telegramRef: String(form.get("telegramRef")),
      price: serviceLines.reduce(
        (sum, line) => sum + line.unitPrice * line.units,
        0,
      ),
      paid: 0,
      notes: String(form.get("note") ?? "").trim()
        ? [
            {
              id: uid("note"),
              staffId: activeStaff.id,
              text: String(form.get("note")),
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
      materialUsage:
        materialId && materialQty > 0
          ? [
              {
                id: uid("usage"),
                materialId,
                quantity: materialQty,
                staffId: activeStaff.id,
                createdAt: new Date().toISOString(),
              },
            ]
          : [],
      history: [
        {
          id: uid("history"),
          date: new Date().toISOString(),
          staffId: activeStaff.id,
          action: "created",
          label: `Created case ${maxNumber + 1}`,
        },
        {
          id: uid("history"),
          date: new Date().toISOString(),
          staffId: activeStaff.id,
          action: "assigned" as const,
          label: `Automatically assigned the new case to ${activeStaff.name}`,
          toStaffId: assignedTo,
        },
      ],
    };
    update((current) => ({
      ...current,
      cases: [labCase, ...current.cases],
      materials: current.materials.map((item) =>
        item.id === materialId
          ? { ...item, stock: Math.max(0, item.stock - materialQty) }
          : item,
      ),
      inventoryLogs:
        materialId && materialQty > 0
          ? [
              {
                id: uid("log"),
                date: new Date().toISOString(),
                materialId,
                caseId: id,
                quantity: -materialQty,
                type: "usage",
                note: `${units} total-unit case intake`,
              },
              ...current.inventoryLogs,
            ]
          : current.inventoryLogs,
      activities: [
        {
          id: uid("act"),
          date: new Date().toISOString(),
          staffId: activeStaff.id,
          action: `Created case ${labCase.caseNumber}`,
          entityType: "case",
          entityId: labCase.id,
        },
        ...current.activities,
      ],
    }));
    setModal(null);
    setSearch("");
    setCaseStatusFilter("All");
    setHighlightedCaseId(labCase.id);
    setView("cases");
    setToast(
      `${labCase.caseNumber} added at ${money(labCase.price, ora.currency)}.`,
    );
  }

  function changeCaseStatus(
    labCase: LabCase,
    status: CaseStatus,
    confirmedSkip = false,
  ) {
    const workflow = workflowForImpression(
      labCase.impressionType,
      ora.workflowOrder,
    );
    const currentIndex = workflow.indexOf(labCase.status);
    const targetIndex = workflow.indexOf(status);
    const canInspect =
      hasPermission(ora, activeStaff, "case_qc") ||
      hasPermission(ora, activeStaff, "case_assign");
    if (labCase.archived) {
      setToast("Restore this case before changing its workflow stage.");
      return;
    }
    if (labCase.onHold) {
      setToast("This case is on hold. An Admin must resume it before workflow can continue.");
      return;
    }
    if (labCase.assignedTo !== activeStaff.id) {
      setToast(
        `Take the case for ${labCase.status} before changing its stage.`,
      );
      return;
    }
    if (targetIndex === currentIndex) return;
    if (targetIndex < 0 || currentIndex < 0) {
      setToast(
        `${status} is not part of this ${labCase.impressionType.toLowerCase()} workflow.`,
      );
      return;
    }
    if (targetIndex < currentIndex) {
      if (!canInspect) {
        setToast(
          "Only Quality Review staff or an Admin can return a case to an earlier stage.",
        );
        return;
      }
      const now = new Date().toISOString();
      const canContinue = canHandleStage(ora, activeStaff, status);
      const historyEntry = {
        id: uid("history"),
        date: now,
        staffId: activeStaff.id,
        action: "status" as const,
        label: `Returned the case from ${labCase.status} to ${status} for rework`,
        fromStatus: labCase.status,
        toStatus: status,
      };
      const releaseEntry = canContinue
        ? []
        : [
            {
              id: uid("history"),
              date: now,
              staffId: activeStaff.id,
              action: "assigned" as const,
              label: `Returned the case to ${status} and automatically handed it to that specialty`,
              fromStaffId: activeStaff.id,
            },
          ];
      update((current) => ({
        ...current,
        cases: current.cases.map((item) =>
          item.id === labCase.id
            ? {
                ...item,
                status,
                assignedTo: canContinue ? item.assignedTo : "",
                qc: undefined,
                deliveryStatus:
                  labCase.status === "Closed"
                    ? "picked_up"
                    : item.deliveryStatus,
                history: [...item.history, historyEntry, ...releaseEntry],
              }
            : item,
        ),
      }));
      addActivity(
        `Returned case ${labCase.caseNumber} from ${labCase.status} to ${status}`,
        activeStaff.id,
        "case",
        labCase.id,
      );
      setToast(`${labCase.caseNumber} returned to ${status}.`);
      return;
    }
    if (
      !hasPermission(ora, activeStaff, "case_workflow") ||
      (!canHandleStage(ora, activeStaff, labCase.status) &&
        !canHandleStage(ora, activeStaff, status))
    ) {
      setToast(
        `Your assigned roles do not include ${labCase.status} or ${status}.`,
      );
      return;
    }
    if (targetIndex > currentIndex + 1 && !confirmedSkip) {
      const skippedStages = workflow.slice(currentIndex + 1, targetIndex);
      setConfirmDialog({
        title: `Skip to ${status}?`,
        message: `This declares ${skippedStages.join(", ")} finished and moves the case directly to ${status}. Every skipped stage will be recorded in the handling log.`,
        confirmLabel: "Declare stages finished",
        destructive: false,
        onConfirm: () => {
          setConfirmDialog(null);
          changeCaseStatus(labCase, status, true);
        },
      });
      return;
    }
    const now = new Date().toISOString();
    const transitionEntries = workflow
      .slice(currentIndex, targetIndex)
      .map((stage, index) => ({
        id: uid("history"),
        date: now,
        staffId: activeStaff.id,
        action: "status" as const,
        label:
          index === 0
            ? `Completed ${stage} and moved the case forward`
            : `Declared ${stage} finished while skipping ahead`,
        fromStatus: stage,
        toStatus: workflow[workflow.indexOf(stage) + 1],
      }));
    const canContinue =
      labCase.assignedTo === activeStaff.id &&
      canHandleStage(ora, activeStaff, status);
    const shouldRelease = labCase.assignedTo === activeStaff.id && !canContinue;
    const releaseEntry = shouldRelease
      ? [
          {
            id: uid("history"),
            date: now,
            staffId: activeStaff.id,
            action: "assigned" as const,
            label: `Finished ${labCase.status} and automatically handed the case to the next specialist`,
            fromStaffId: activeStaff.id,
          },
        ]
      : [];
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              status,
              assignedTo: shouldRelease ? "" : item.assignedTo,
              deliveryStatus:
                status === "Closed" ? "ready" : item.deliveryStatus,
              history: [...item.history, ...transitionEntries, ...releaseEntry],
            }
          : item,
      ),
    }));
    addActivity(
      `Moved case ${labCase.caseNumber} from ${labCase.status} to ${status}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(
      shouldRelease
        ? `${labCase.caseNumber} moved to ${status} and is ready for its next specialist.`
        : `${labCase.caseNumber} moved to ${status}. You remain assigned because it matches your specialties.`,
    );
  }

  function takeCase(labCase: LabCase) {
    if (labCase.archived) {
      setToast("Restore this case before taking it.");
      return;
    }
    if (labCase.onHold) {
      setToast("This case is on hold and cannot be taken until it is resumed.");
      return;
    }
    if (!canHandleStage(ora, activeStaff, labCase.status)) {
      setToast(`Your roles do not include the ${labCase.status} specialty.`);
      return;
    }
    const previousStaffId = labCase.assignedTo;
    const historyEntry = {
      id: uid("history"),
      date: new Date().toISOString(),
      staffId: activeStaff.id,
      action: "taken" as const,
      label: `Took over ${labCase.status}`,
      fromStaffId: previousStaffId || undefined,
      toStaffId: activeStaff.id,
    };
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              assignedTo: activeStaff.id,
              history: [...item.history, historyEntry],
            }
          : item,
      ),
    }));
    addActivity(
      `Took case ${labCase.caseNumber} for ${labCase.status}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} is now assigned to ${activeStaff.name}.`);
  }

  function releaseCase(labCase: LabCase) {
    if (labCase.onHold) {
      setToast("This case is on hold and cannot be reassigned until it is resumed.");
      return;
    }
    const canRelease =
      labCase.assignedTo === activeStaff.id ||
      hasPermission(ora, activeStaff, "case_assign");
    if (!canRelease || !labCase.assignedTo) return;
    const releasedMember = ora.staff.find(
      (member) => member.id === labCase.assignedTo,
    );
    const historyEntry = {
      id: uid("history"),
      date: new Date().toISOString(),
      staffId: activeStaff.id,
      action: "assigned" as const,
      label: `${releasedMember?.name ?? "Current handler"} opted out and released ${labCase.status}`,
      fromStaffId: labCase.assignedTo,
    };
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              assignedTo: "",
              history: [...item.history, historyEntry],
            }
          : item,
      ),
    }));
    addActivity(
      `Released case ${labCase.caseNumber} for the next ${labCase.status} specialist`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} is unassigned and ready to be taken.`);
  }

  function archiveCase(labCase: LabCase) {
    if (!hasPermission(ora, activeStaff, "case_intake")) return;
    setConfirmDialog({
      title: `Archive case ${labCase.caseNumber}?`,
      message:
        "The case will leave active workflow, schedule, and dashboard views. Its invoice, notes, handling log, and material history remain available from Archived cases.",
      confirmLabel: "Archive case",
      destructive: false,
      onConfirm: () => {
        const historyEntry = {
          id: uid("history"),
          date: new Date().toISOString(),
          staffId: activeStaff.id,
          action: "assigned" as const,
          label: "Archived the case and removed it from active workflow",
          fromStaffId: labCase.assignedTo || undefined,
        };
        update((current) => ({
          ...current,
          cases: current.cases.map((item) =>
            item.id === labCase.id
              ? {
                  ...item,
                  archived: true,
                  assignedTo: "",
                  history: [...item.history, historyEntry],
                }
              : item,
          ),
        }));
        addActivity(
          `Archived case ${labCase.caseNumber}`,
          activeStaff.id,
          "case",
          labCase.id,
        );
        setConfirmDialog(null);
        setToast(`${labCase.caseNumber} moved to Archived cases.`);
      },
    });
  }

  function restoreCase(labCase: LabCase) {
    if (!hasPermission(ora, activeStaff, "case_intake")) return;
    const historyEntry = {
      id: uid("history"),
      date: new Date().toISOString(),
      staffId: activeStaff.id,
      action: "assigned" as const,
      label: "Restored the case to active workflow",
    };
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              archived: false,
              history: [...item.history, historyEntry],
            }
          : item,
      ),
    }));
    addActivity(
      `Restored case ${labCase.caseNumber}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} restored to active cases.`);
  }

  function setCaseHold(labCase: LabCase, note: string) {
    if (!isAdmin || labCase.archived || labCase.onHold) return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              onHold: true,
              holdNote: note,
              holdAt: now,
              holdBy: activeStaff.id,
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "edited" as const,
                  label: `Placed the case on hold: ${note}`,
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Placed case ${labCase.caseNumber} on hold`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} is now on hold.`);
  }

  function resumeCaseHold(labCase: LabCase) {
    if (!isAdmin || !labCase.onHold) return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              onHold: false,
              holdNote: "",
              holdAt: undefined,
              holdBy: undefined,
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "edited" as const,
                  label: "Resumed the case from hold",
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Resumed case ${labCase.caseNumber} from hold`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} has been resumed.`);
  }

  function assignCase(labCase: LabCase, staffId: string) {
    if (!hasPermission(ora, activeStaff, "case_assign")) {
      setToast("Your roles do not allow case assignment.");
      return;
    }
    const nextMember = ora.staff.find((member) => member.id === staffId);
    if (!nextMember) return;
    if (labCase.archived || labCase.onHold || !canHandleStage(ora, nextMember, labCase.status)) {
      setToast(
        `${nextMember.name} does not have the ${labCase.status} specialty.`,
      );
      return;
    }
    const previousStaffId = labCase.assignedTo;
    const historyEntry = {
      id: uid("history"),
      date: new Date().toISOString(),
      staffId: activeStaff.id,
      action: "assigned" as const,
      label: `Assigned ${labCase.status} to ${nextMember.name}`,
      fromStaffId: previousStaffId || undefined,
      toStaffId: staffId,
    };
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              assignedTo: staffId,
              history: [...item.history, historyEntry],
            }
          : item,
      ),
    }));
    addActivity(
      `Assigned case ${labCase.caseNumber} to ${nextMember.name}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${nextMember.name} is now handling case ${labCase.caseNumber}.`);
  }

  function addServiceType(name: string, defaultPrice: number) {
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (
      ora.serviceTypes.some(
        (item) => item.toLowerCase() === cleanName.toLowerCase(),
      )
    ) {
      setToast("That service type already exists.");
      return false;
    }
    update((current) => ({
      ...current,
      serviceTypes: [...current.serviceTypes, cleanName],
      doctors: current.doctors.map((doctor) => ({
        ...doctor,
        priceList: {
          ...doctor.priceList,
          [cleanName]: Math.max(0, defaultPrice),
        },
      })),
      clinicProfiles: Object.fromEntries(
        Object.entries(current.clinicProfiles).map(([clinic, profile]) => [
          clinic,
          {
            ...profile,
            priceList: {
              ...profile.priceList,
              [cleanName]: Math.max(0, defaultPrice),
            },
          },
        ]),
      ),
    }));
    addActivity(
      `Added service type: ${cleanName}`,
      activeStaff.id,
      "settings",
      cleanName,
    );
    setToast(`${cleanName} added to every doctor price list.`);
    return true;
  }

  function addMaterialCategory(name: string) {
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (
      ora.materialCategories.some(
        (item) => item.toLowerCase() === cleanName.toLowerCase(),
      )
    ) {
      setToast("That material type already exists.");
      return false;
    }
    update((current) => ({
      ...current,
      materialCategories: [...current.materialCategories, cleanName],
    }));
    addActivity(
      `Added material type: ${cleanName}`,
      activeStaff.id,
      "settings",
      cleanName,
    );
    setToast(`${cleanName} added to the material types.`);
    return true;
  }

  function addClinic(name: string) {
    const cleanName = name.trim();
    if (!cleanName) return false;
    if (
      ora.clinics.some((item) => item.toLowerCase() === cleanName.toLowerCase())
    ) {
      setToast("That clinic already exists.");
      return false;
    }
    update((current) => ({
      ...current,
      clinics: [...current.clinics, cleanName],
      clinicProfiles: {
        ...current.clinicProfiles,
        [cleanName]: {
          phone: "",
          address: "",
          notes: "",
          priceList: Object.fromEntries(
            current.serviceTypes.map((service) => [service, 0]),
          ),
        },
      },
    }));
    addActivity(
      `Added clinic: ${cleanName}`,
      activeStaff.id,
      "clinic",
      cleanName,
    );
    setToast(`${cleanName} added to the clinic list.`);
    return true;
  }

  function renameServiceType(oldName: string, newName: string) {
    const cleanName = newName.trim();
    if (!cleanName) return false;
    if (cleanName === oldName) return true;
    if (
      ora.serviceTypes.some(
        (item) =>
          item !== oldName && item.toLowerCase() === cleanName.toLowerCase(),
      )
    ) {
      setToast("That service type already exists.");
      return false;
    }
    update((current) => ({
      ...current,
      serviceTypes: current.serviceTypes.map((item) =>
        item === oldName ? cleanName : item,
      ),
      doctors: current.doctors.map((doctor) => {
        const nextPrices = {
          ...doctor.priceList,
          [cleanName]: doctor.priceList[oldName] ?? 0,
        };
        delete nextPrices[oldName];
        return { ...doctor, priceList: nextPrices };
      }),
      clinicProfiles: Object.fromEntries(
        Object.entries(current.clinicProfiles).map(([clinic, profile]) => {
          const prices = {
            ...profile.priceList,
            [cleanName]: profile.priceList[oldName] ?? 0,
          };
          delete prices[oldName];
          return [clinic, { ...profile, priceList: prices }];
        }),
      ),
    }));
    addActivity(
      `Renamed service type: ${oldName} to ${cleanName}`,
      activeStaff.id,
      "settings",
      oldName,
    );
    setToast(
      `${oldName} renamed. Existing cases keep their original service name.`,
    );
    return true;
  }

  function renameMaterialCategory(oldName: string, newName: string) {
    const cleanName = newName.trim();
    if (!cleanName) return false;
    if (cleanName === oldName) return true;
    if (
      ora.materialCategories.some(
        (item) =>
          item !== oldName && item.toLowerCase() === cleanName.toLowerCase(),
      )
    ) {
      setToast("That material type already exists.");
      return false;
    }
    update((current) => ({
      ...current,
      materialCategories: current.materialCategories.map((item) =>
        item === oldName ? cleanName : item,
      ),
      materials: current.materials.map((material) =>
        material.category === oldName
          ? { ...material, category: cleanName }
          : material,
      ),
    }));
    addActivity(
      `Renamed material type: ${oldName} to ${cleanName}`,
      activeStaff.id,
      "settings",
      oldName,
    );
    setToast(`${oldName} renamed to ${cleanName}.`);
    return true;
  }

  function removeServiceType(name: string) {
    const caseCount = ora.cases.filter((item) => item.service === name).length;
    const warning = caseCount
      ? `Delete "${name}" from future service choices? ${caseCount} existing ${caseCount === 1 ? "case" : "cases"} will keep this service name and price. This cannot be undone.`
      : `Delete "${name}" from the service catalog and every doctor price list? This cannot be undone.`;
    setConfirmDialog({
      title: `Delete ${name}?`,
      message: warning,
      confirmLabel: "Delete service",
      onConfirm: () => {
        update((current) => ({
          ...current,
          serviceTypes: current.serviceTypes.filter((item) => item !== name),
          doctors: current.doctors.map((doctor) => {
            const nextPrices = { ...doctor.priceList };
            delete nextPrices[name];
            return { ...doctor, priceList: nextPrices };
          }),
          clinicProfiles: Object.fromEntries(
            Object.entries(current.clinicProfiles).map(([clinic, profile]) => {
              const prices = { ...profile.priceList };
              delete prices[name];
              return [clinic, { ...profile, priceList: prices }];
            }),
          ),
        }));
        addActivity(
          `Deleted service type: ${name}`,
          activeStaff.id,
          "settings",
          name,
        );
        setToast(`${name} removed from the catalog.`);
        setConfirmDialog(null);
      },
    });
  }

  function removeMaterialCategory(name: string) {
    const materialCount = ora.materials.filter(
      (item) => item.category === name,
    ).length;
    const warning = materialCount
      ? `Delete "${name}" from future material choices? ${materialCount} existing inventory ${materialCount === 1 ? "item" : "items"} will keep this type. This cannot be undone.`
      : `Delete "${name}" from future material choices? This cannot be undone.`;
    setConfirmDialog({
      title: `Delete ${name}?`,
      message: warning,
      confirmLabel: "Delete material type",
      onConfirm: () => {
        update((current) => ({
          ...current,
          materialCategories: current.materialCategories.filter(
            (item) => item !== name,
          ),
        }));
        addActivity(
          `Deleted material type: ${name}`,
          activeStaff.id,
          "settings",
          name,
        );
        setToast(`${name} removed from the catalog.`);
        setConfirmDialog(null);
      },
    });
  }

  function addCaseNote(event: FormEvent<HTMLFormElement>, caseId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = String(form.get("note")).trim();
    if (!text) return;
    const historyEntry = {
      id: uid("history"),
      date: new Date().toISOString(),
      staffId: activeStaff.id,
      action: "note" as const,
      label: "Added an internal note",
    };
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === caseId
          ? {
              ...item,
              notes: [
                ...item.notes,
                {
                  id: uid("note"),
                  staffId: activeStaff.id,
                  text,
                  createdAt: new Date().toISOString(),
                },
              ],
              history: [...item.history, historyEntry],
            }
          : item,
      ),
    }));
    event.currentTarget.reset();
    addActivity(
      `Added a note to case ${ora.cases.find((item) => item.id === caseId)?.caseNumber}`,
      activeStaff.id,
      "case",
      caseId,
    );
  }

  function addDoctorMessage(event: FormEvent<HTMLFormElement>, caseId: string) {
    event.preventDefault();
    if (!intakeAllowed) return;
    const text = String(
      new FormData(event.currentTarget).get("message") ?? "",
    ).trim();
    if (!text) return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === caseId
          ? {
              ...item,
              doctorMessages: [
                ...(item.doctorMessages ?? []),
                {
                  id: uid("message"),
                  author: "lab",
                  authorName: activeStaff.name,
                  text,
                  createdAt: now,
                  attachments: [],
                },
              ],
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "note",
                  label: "Replied to the doctor through the portal",
                },
              ],
            }
          : item,
      ),
    }));
    event.currentTarget.reset();
    addActivity(
      `Replied to the doctor on case ${ora.cases.find((item) => item.id === caseId)?.caseNumber}`,
      activeStaff.id,
      "case",
      caseId,
    );
  }

  function approveDoctorCase(labCase: LabCase) {
    if (!intakeAllowed || !labCase.intakeApprovalPending) return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              intakeApprovalPending: false,
              status: "Approved",
              doctorMessages: [
                ...(item.doctorMessages ?? []),
                {
                  id: uid("message"),
                  author: "lab" as const,
                  authorName: activeStaff.name,
                  text: "Your case has been approved and is now in production.",
                  createdAt: now,
                  attachments: [],
                },
              ],
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "status" as const,
                  label:
                    "Approved doctor-submitted case and started the Approved stage",
                  fromStatus: "Received",
                  toStatus: "Approved",
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Approved doctor-submitted case ${labCase.caseNumber}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} is now in the lab workflow.`);
  }

  function approveDoctorDeliveryRequest(task: DeliveryTask) {
    if (!canApproveOralScans || !task.approvalPending) return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      deliveryTasks: current.deliveryTasks.map((item) =>
        item.id === task.id
          ? { ...item, approvalPending: false, approvedAt: now }
          : item,
      ),
    }));
    addActivity(
      `Approved doctor ${task.type === "pickup" ? "pickup" : "oral scan"} request for ${task.doctorLabel}`,
      activeStaff.id,
      "delivery",
      task.id,
    );
    setToast(
      `${task.type === "pickup" ? "Pickup" : "Oral scan"} request approved for delivery.`,
    );
  }

  function approveCase(event: FormEvent<HTMLFormElement>, labCase: LabCase) {
    event.preventDefault();
    if (
      labCase.assignedTo !== activeStaff.id ||
      !hasPermission(ora, activeStaff, "case_qc") ||
      !canHandleStage(ora, activeStaff, "Quality Review")
    ) {
      setToast(
        "Take the case as its Quality Review specialist before approving it.",
      );
      return;
    }
    const note = String(new FormData(event.currentTarget).get("qcNote") ?? "");
    const now = new Date().toISOString();
    const historyEntry = {
      id: uid("history"),
      date: now,
      staffId: activeStaff.id,
      action: "quality" as const,
      label: "Approved Quality Review and closed the case",
      fromStatus: labCase.status,
      toStatus: "Closed" as const,
    };
    const releaseEntry = {
      id: uid("history"),
      date: now,
      staffId: activeStaff.id,
      action: "assigned" as const,
      label: "Finished final review and closed the case",
      fromStaffId: activeStaff.id,
    };
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              status: "Closed",
              assignedTo: "",
              deliveryStatus: "ready",
              qc: { approvedBy: activeStaff.id, approvedAt: now, note },
              history: [...item.history, historyEntry, releaseEntry],
            }
          : item,
      ),
    }));
    addActivity(
      `Approved Quality Review on case ${labCase.caseNumber}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} passed Quality Review and is closed.`);
  }

  function setOutForPickup(labCase: LabCase) {
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && labCase.deliveryAssigneeId !== activeStaff.id) ||
      deliveryQueue(labCase) !== "pickup" ||
      labCase.deliveryStatus === "out_for_pickup"
    )
      return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              deliveryStatus: "out_for_pickup",
              deliveryAssigneeId: activeStaff.id,
              deliveryAssignedAt: item.deliveryAssignedAt ?? now,
              history: [
                ...item.history,
                ...(item.deliveryAssignedAt
                  ? []
                  : [
                      {
                        id: uid("history"),
                        date: now,
                        staffId: activeStaff.id,
                        action: "delivery" as const,
                        label: `Assigned to ${activeStaff.name} for pickup`,
                      },
                    ]),
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "delivery",
                  label: "Marked out for pickup",
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Case ${labCase.caseNumber} is out for pickup`,
      activeStaff.id,
      "delivery",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} is now out for pickup.`);
  }

  function collectDelivery(labCase: LabCase) {
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && labCase.deliveryAssigneeId !== activeStaff.id) ||
      deliveryQueue(labCase) !== "pickup" ||
      labCase.deliveryStatus !== "out_for_pickup"
    )
      return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              deliveryStatus: "picked_up",
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "delivery",
                  label: "Picked up physical impression from the clinic",
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Picked up physical impression for case ${labCase.caseNumber}`,
      activeStaff.id,
      "delivery",
      labCase.id,
    );
    setDeliveryCaseId(null);
    setToast(
      `${labCase.caseNumber} was picked up. Confirm again when the box reaches the lab.`,
    );
  }

  function receivePickupAtLab(labCase: LabCase) {
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && labCase.deliveryAssigneeId !== activeStaff.id) ||
      deliveryQueue(labCase) !== "pickup" ||
      labCase.deliveryStatus !== "picked_up"
    )
      return;
    setConfirmDialog({
      title: `Confirm ${labCase.caseNumber} arrived at the lab?`,
      message:
        "This confirms the physical impression box was handed to the lab and completes the pickup trip.",
      confirmLabel: "Arrived at lab",
      destructive: false,
      onConfirm: () => {
        const now = new Date().toISOString();
        update((current) => ({
          ...current,
          cases: current.cases.map((item) =>
            item.id === labCase.id
              ? {
                  ...item,
                  deliveryStatus: "received_at_lab",
                  history: [
                    ...item.history,
                    {
                      id: uid("history"),
                      date: now,
                      staffId: activeStaff.id,
                      action: "delivery",
                      label: "Received physical impression at the lab",
                    },
                  ],
                }
              : item,
          ),
        }));
        addActivity(
          `Brought physical impression for case ${labCase.caseNumber} to the lab`,
          activeStaff.id,
          "delivery",
          labCase.id,
        );
        setDeliveryCaseId(null);
        setConfirmDialog(null);
        setToast(`${labCase.caseNumber} arrived at the lab.`);
      },
    });
  }

  function setOutForDelivery(labCase: LabCase) {
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && labCase.deliveryAssigneeId !== activeStaff.id) ||
      deliveryQueue(labCase) !== "delivery" ||
      labCase.deliveryStatus === "delivered"
    )
      return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              deliveryStatus: "out_for_delivery",
              deliveryAssigneeId: activeStaff.id,
              deliveryAssignedAt: item.deliveryAssignedAt ?? now,
              history: [
                ...item.history,
                ...(item.deliveryAssignedAt
                  ? []
                  : [
                      {
                        id: uid("history"),
                        date: now,
                        staffId: activeStaff.id,
                        action: "delivery" as const,
                        label: `Assigned to ${activeStaff.name} for delivery`,
                      },
                    ]),
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "delivery",
                  label: "Marked out for delivery",
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Case ${labCase.caseNumber} is out for delivery`,
      activeStaff.id,
      "delivery",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} is now out for delivery.`);
  }

  function confirmDelivery(labCase: LabCase) {
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && labCase.deliveryAssigneeId !== activeStaff.id) ||
      deliveryQueue(labCase) !== "delivery" ||
      labCase.deliveryStatus !== "out_for_delivery"
    )
      return;
    setConfirmDialog({
      title: `Mark ${labCase.caseNumber} delivered?`,
      message:
        "This confirms the finished case was handed to the clinic. It will leave the active delivery list.",
      confirmLabel: "Mark delivered",
      destructive: false,
      onConfirm: () => {
        const now = new Date().toISOString();
        update((current) => ({
          ...current,
          cases: current.cases.map((item) =>
            item.id === labCase.id
              ? {
                  ...item,
                  deliveryStatus: "delivered",
                  history: [
                    ...item.history,
                    {
                      id: uid("history"),
                      date: now,
                      staffId: activeStaff.id,
                      action: "delivery",
                      label: "Marked delivered to the clinic",
                    },
                  ],
                }
              : item,
          ),
        }));
        addActivity(
          `Delivered case ${labCase.caseNumber}`,
          activeStaff.id,
          "delivery",
          labCase.id,
        );
        setDeliveryCaseId(null);
        setConfirmDialog(null);
        setToast(`${labCase.caseNumber} marked delivered.`);
      },
    });
  }

  function setOutForScan(labCase: LabCase) {
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && labCase.deliveryAssigneeId !== activeStaff.id) ||
      deliveryQueue(labCase) !== "oral-scan" ||
      labCase.deliveryStatus === "out_for_scan"
    )
      return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              deliveryStatus: "out_for_scan",
              deliveryAssigneeId: activeStaff.id,
              deliveryAssignedAt: item.deliveryAssignedAt ?? now,
              history: [
                ...item.history,
                ...(item.deliveryAssignedAt
                  ? []
                  : [
                      {
                        id: uid("history"),
                        date: now,
                        staffId: activeStaff.id,
                        action: "delivery" as const,
                        label: `Assigned to ${activeStaff.name} for oral scan`,
                      },
                    ]),
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "delivery",
                  label: "Marked out for oral scan",
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Case ${labCase.caseNumber} is out for oral scan`,
      activeStaff.id,
      "delivery",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} is now out for oral scan.`);
  }

  function completeOralScan(labCase: LabCase) {
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && labCase.deliveryAssigneeId !== activeStaff.id) ||
      deliveryQueue(labCase) !== "oral-scan" ||
      labCase.deliveryStatus !== "out_for_scan"
    )
      return;
    setConfirmDialog({
      title: `Mark ${labCase.caseNumber} scanned?`,
      message:
        "This confirms the driver completed the oral scan at the clinic. The case will leave the delivery board.",
      confirmLabel: "Mark scan completed",
      destructive: false,
      onConfirm: () => {
        const now = new Date().toISOString();
        update((current) => ({
          ...current,
          cases: current.cases.map((item) =>
            item.id === labCase.id
              ? {
                  ...item,
                  deliveryStatus: "scanned",
                  history: [
                    ...item.history,
                    {
                      id: uid("history"),
                      date: now,
                      staffId: activeStaff.id,
                      action: "delivery",
                      label: "Completed oral scan at the clinic",
                    },
                  ],
                }
              : item,
          ),
        }));
        addActivity(
          `Completed oral scan for case ${labCase.caseNumber}`,
          activeStaff.id,
          "delivery",
          labCase.id,
        );
        setDeliveryCaseId(null);
        setConfirmDialog(null);
        setToast(`${labCase.caseNumber} oral scan completed.`);
      },
    });
  }

  function approveOralScan(labCase: LabCase) {
    if (
      !canApproveOralScans ||
      labCase.deliveryStatus !== "awaiting_scan_approval"
    )
      return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              deliveryStatus: "awaiting_scan",
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "delivery",
                  label: "Approved oral scan request for dispatch",
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Approved oral scan request for case ${labCase.caseNumber}`,
      activeStaff.id,
      "delivery",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} is now visible to the delivery team.`);
  }

  function assignDeliveryDriver(labCase: LabCase, driverId: string) {
    if (!isAdmin) return;
    const driver = ora.staff.find(
      (item) =>
        item.id === driverId &&
        isDeliveryStaff(ora, item),
    );
    if (!driver) {
      setToast("Choose an active delivery driver.");
      return;
    }
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              deliveryAssigneeId: driver.id,
              deliveryAssignedAt: item.deliveryAssignedAt ?? now,
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "delivery",
                  label: `Assigned delivery task to ${driver.name}`,
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Assigned ${driver.name} to delivery case ${labCase.caseNumber}`,
      activeStaff.id,
      "delivery",
      labCase.id,
    );
    setToast(`${driver.name} assigned to ${labCase.caseNumber}.`);
  }

  function assignDeliveryTaskDriver(task: DeliveryTask, driverId: string) {
    if (!isAdmin) return;
    const driver = ora.staff.find(
      (item) =>
        item.id === driverId &&
        isDeliveryStaff(ora, item),
    );
    if (!driver) {
      setToast("Choose an active delivery driver.");
      return;
    }
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      deliveryTasks: current.deliveryTasks.map((item) =>
        item.id === task.id
          ? { ...item, assignedTo: driver.id, assignedAt: now }
          : item,
      ),
    }));
    addActivity(
      `Assigned ${driver.name} to ${task.type === "oral-scan" ? "oral scan" : task.type} request for ${task.doctorLabel}`,
      activeStaff.id,
      "delivery",
      task.id,
    );
    setToast(`${driver.name} assigned to ${task.doctorLabel}.`);
  }

  function addDeliveryTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!intakeAllowed) return;
    const form = new FormData(event.currentTarget);
    const doctorId = String(form.get("doctorId"));
    const doctor = ora.doctors.find((item) => item.id === doctorId);
    const assignedTo = String(form.get("assignedTo"));
    const driver = ora.staff.find(
      (item) =>
        item.id === assignedTo &&
        item.active !== false &&
        hasPermission(ora, item, "delivery_manage"),
    );
    if (!driver) {
      setToast("Choose an active delivery driver.");
      return;
    }
    const now = new Date().toISOString();
    const linkedCaseId = String(form.get("caseId") ?? "");
    if (String(form.get("type")) === "delivery" && linkedCaseId) {
      const labCase = ora.cases.find(
        (item) =>
          item.id === linkedCaseId &&
          item.status === "Closed" &&
          !item.archived &&
          item.deliveryStatus !== "delivered",
      );
      if (!labCase) {
        setToast("Choose a closed case that is still awaiting delivery.");
        return;
      }
      update((current) => ({
        ...current,
        cases: current.cases.map((item) =>
          item.id === labCase.id
            ? {
                ...item,
                deliveryStatus: "ready",
                deliveryLocation:
                  String(form.get("address")).trim() || item.deliveryLocation,
                deliveryAssigneeId: driver.id,
                deliveryAssignedAt: now,
                history: [
                  ...item.history,
                  {
                    id: uid("history"),
                    date: now,
                    staffId: activeStaff.id,
                    action: "delivery",
                    label: `Added to delivery board and assigned to ${driver.name}`,
                  },
                ],
              }
            : item,
        ),
      }));
      addActivity(
        `Added closed case ${labCase.caseNumber} to delivery for ${driver.name}`,
        activeStaff.id,
        "delivery",
        labCase.id,
      );
      setModal(null);
      setToast(
        `${labCase.caseNumber} added to Deliver and assigned to ${driver.name}.`,
      );
      return;
    }
    const task: DeliveryTask = {
      id: uid("delivery-task"),
      type:
        String(form.get("type")) === "pickup"
          ? "pickup"
          : String(form.get("type")) === "oral-scan"
            ? "oral-scan"
            : "delivery",
      address: String(form.get("address")).trim(),
      doctorId: doctor?.id,
      doctorLabel:
        doctor?.name ??
        (String(form.get("otherDoctor")).trim() || "Other contact"),
      contactDetails: String(form.get("contactDetails")).trim(),
      scheduledDate: String(form.get("scheduledDate")),
      scheduledTime: String(form.get("scheduledTime")),
      assignedTo: driver.id,
      assignedAt: now,
      status: "scheduled",
      createdAt: now,
    };
    if (
      !task.address ||
      !task.contactDetails ||
      !task.scheduledDate ||
      !task.scheduledTime
    ) {
      setToast("Add the address, contact details, date, and time before creating this delivery task.");
      return;
    }
    update((current) => ({
      ...current,
      deliveryTasks: [task, ...current.deliveryTasks],
    }));
    addActivity(
      `Added ${task.type === "oral-scan" ? "oral scan" : task.type} task for ${task.doctorLabel}`,
      activeStaff.id,
      "delivery",
      task.id,
    );
    setModal(null);
    setToast("Delivery task added and assigned.");
  }

  function startDeliveryTask(task: DeliveryTask) {
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && task.assignedTo !== activeStaff.id) ||
      task.status !== "scheduled"
    )
      return;
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      deliveryTasks: current.deliveryTasks.map((item) =>
        item.id === task.id ? { ...item, status: "out", outAt: now } : item,
      ),
    }));
    addActivity(
      `${task.type === "pickup" ? "Out for pickup" : task.type === "oral-scan" ? "Out for oral scan" : "Out for delivery"}: ${task.doctorLabel}`,
      activeStaff.id,
      "delivery",
      task.id,
    );
    setToast(
      `${task.type === "pickup" ? "Pickup" : task.type === "oral-scan" ? "Oral scan" : "Delivery"} task is now out.`,
    );
  }

  function completeDeliveryTask(task: DeliveryTask) {
    const pickupReturningToLab =
      task.type === "pickup" && task.status === "collected";
    if (
      !hasPermission(ora, activeStaff, "delivery_manage") ||
      (!isAdmin && task.assignedTo !== activeStaff.id) ||
      (task.status !== "out" && !pickupReturningToLab)
    )
      return;
    setConfirmDialog({
      title: pickupReturningToLab
        ? "Confirm this box arrived at the lab?"
        : `Mark this ${task.type === "oral-scan" ? "oral scan" : task.type} complete?`,
      message:
        pickupReturningToLab
          ? "This confirms the collected box was handed to the lab and completes the pickup trip."
          : task.type === "pickup"
            ? "This confirms the box was collected from the clinic. It will remain active until it reaches the lab."
          : task.type === "oral-scan"
            ? "This confirms the oral scan was completed at the clinic."
            : "This confirms the delivery was completed.",
      confirmLabel:
        pickupReturningToLab
          ? "Arrived at lab"
          : task.type === "pickup"
            ? "Mark picked up"
          : task.type === "oral-scan"
            ? "Mark scan completed"
            : "Mark delivered",
      destructive: false,
      onConfirm: () => {
        const now = new Date().toISOString();
        update((current) => ({
          ...current,
          deliveryTasks: current.deliveryTasks.map((item) =>
            item.id === task.id
              ? task.type === "pickup" && task.status === "out"
                ? { ...item, status: "collected", collectedAt: now }
                : { ...item, status: "completed", completedAt: now }
              : item,
          ),
        }));
        addActivity(
          `${pickupReturningToLab ? "Pickup arrived at lab" : task.type === "pickup" ? "Picked up" : task.type === "oral-scan" ? "Completed oral scan" : "Delivered"}: ${task.doctorLabel}`,
          activeStaff.id,
          "delivery",
          task.id,
        );
        setConfirmDialog(null);
        setToast(
          task.type === "pickup" && task.status === "out"
            ? "Pickup collected. Confirm again when the box reaches the lab."
            : "Delivery task completed.",
        );
      },
    });
  }

  function recordUsage(event: FormEvent<HTMLFormElement>, labCase: LabCase) {
    event.preventDefault();
    if (
      labCase.archived ||
      !hasPermission(ora, activeStaff, "material_usage")
    ) {
      setToast("Your roles do not allow material usage updates.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const materialId = String(form.get("materialId"));
    const quantity = Number(form.get("quantity"));
    if (!materialId || quantity <= 0) return;
    const usageId = uid("usage");
    const createdAt = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              materialUsage: [
                ...item.materialUsage,
                {
                  id: usageId,
                  materialId,
                  quantity,
                  staffId: activeStaff.id,
                  createdAt,
                },
              ],
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: createdAt,
                  staffId: activeStaff.id,
                  action: "material",
                  label: `Recorded ${quantity} ${current.materials.find((material) => material.id === materialId)?.unit ?? "units"} of ${current.materials.find((material) => material.id === materialId)?.name ?? "material"}`,
                },
              ],
            }
          : item,
      ),
      materials: current.materials.map((item) =>
        item.id === materialId
          ? { ...item, stock: Math.max(0, item.stock - quantity) }
          : item,
      ),
      inventoryLogs: [
        {
          id: uid("log"),
          date: new Date().toISOString(),
          materialId,
          caseId: labCase.id,
          quantity: -quantity,
          type: "usage",
          note: `Recorded on ${labCase.caseNumber}`,
        },
        ...current.inventoryLogs,
      ],
    }));
    event.currentTarget.reset();
    addActivity(
      `Recorded material usage on case ${labCase.caseNumber}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast("Material usage deducted from inventory.");
  }

  function reviseMaterialUsage(
    labCase: LabCase,
    usageId: string,
    nextQuantity: number | null,
  ) {
    const usage = labCase.materialUsage.find((item) => item.id === usageId);
    if (!usage) return;
    const canEdit =
      usage.staffId === activeStaff.id ||
      hasPermission(ora, activeStaff, "case_edit");
    if (!canEdit) {
      setToast(
        "Only the person who recorded this usage, an Input Manager, or an Admin can correct it.",
      );
      return;
    }
    if (
      nextQuantity !== null &&
      (!Number.isFinite(nextQuantity) || nextQuantity <= 0)
    )
      return;
    const replacement = nextQuantity ?? 0;
    const stockChange = usage.quantity - replacement;
    const label =
      nextQuantity === null
        ? "Removed a material usage entry"
        : `Corrected material usage from ${usage.quantity} to ${nextQuantity}`;
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              materialUsage:
                nextQuantity === null
                  ? item.materialUsage.filter((entry) => entry.id !== usageId)
                  : item.materialUsage.map((entry) =>
                      entry.id === usageId
                        ? { ...entry, quantity: nextQuantity }
                        : entry,
                    ),
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: new Date().toISOString(),
                  staffId: activeStaff.id,
                  action: "material",
                  label,
                },
              ],
            }
          : item,
      ),
      materials: current.materials.map((item) =>
        item.id === usage.materialId
          ? { ...item, stock: Math.max(0, item.stock + stockChange) }
          : item,
      ),
      inventoryLogs: [
        {
          id: uid("log"),
          date: new Date().toISOString(),
          materialId: usage.materialId,
          caseId: labCase.id,
          quantity: stockChange,
          type: "adjustment",
          note: `${label} on ${labCase.caseNumber}`,
        },
        ...current.inventoryLogs,
      ],
    }));
    addActivity(
      `${label} on case ${labCase.caseNumber}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(
      nextQuantity === null
        ? "Usage removed and inventory restored."
        : "Usage corrected and inventory reconciled.",
    );
  }

  function removeMaterialUsage(labCase: LabCase, usageId: string) {
    setConfirmDialog({
      title: "Remove this material entry?",
      message:
        "The deducted quantity will be returned to inventory and the correction will remain visible in the case and inventory logs.",
      confirmLabel: "Remove usage",
      onConfirm: () => {
        reviseMaterialUsage(labCase, usageId, null);
        setConfirmDialog(null);
      },
    });
  }

  function editCase(event: FormEvent<HTMLFormElement>, labCase: LabCase) {
    event.preventDefault();
    if (!hasPermission(ora, activeStaff, "case_edit")) return;
    const form = new FormData(event.currentTarget);
    const doctorId = String(form.get("doctorId"));
    const doctor = ora.doctors.find((item) => item.id === doctorId);
    if (!doctor) return;
    let lines: CaseServiceLine[] = [];
    try {
      lines = JSON.parse(String(form.get("serviceLines") || "[]"));
    } catch {}
    lines = lines
      .map((line) => ({
        ...line,
        units: Math.max(1, Number(line.units) || 1),
        unitPrice: Math.max(0, Number(line.unitPrice) || 0),
        shade: String(line.shade || "Not recorded"),
      }))
      .filter((line) => line.service);
    if (!lines.length) return;
    const nextPrice = lines.reduce(
      (sum, line) => sum + line.units * line.unitPrice,
      0,
    );
    const impressionType = String(form.get("impressionType")) as ImpressionType;
    if (
      !workflowForImpression(impressionType, ora.workflowOrder).includes(
        labCase.status,
      )
    ) {
      setToast(
        `This case cannot switch to ${impressionType} while it is at ${labCase.status}. Move it to a shared stage first.`,
      );
      return;
    }
    if (nextPrice + 0.001 < labCase.paid) {
      setToast(
        "The edited case value cannot be lower than the amount already paid.",
      );
      return;
    }
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              doctorId,
              patient: String(form.get("patient")),
              patientRef: String(form.get("patientRef")),
              serviceLines: lines,
              service: lines[0].service,
              shade: lines[0].shade,
              units: lines.reduce((sum, line) => sum + line.units, 0),
              price: nextPrice,
              dueDate: String(form.get("dueDate")),
              dueTime: String(form.get("dueTime") || "17:00"),
              appointmentDate: String(
                form.get("appointmentDate") ||
                  item.appointmentDate ||
                  form.get("dueDate"),
              ),
              appointmentTime: String(
                form.get("appointmentTime") ||
                  item.appointmentTime ||
                  form.get("dueTime") ||
                  "17:00",
              ),
              priority: String(form.get("priority")) as LabCase["priority"],
              telegramRef: String(form.get("telegramRef")),
              impressionType,
              doctorMessages: item.intakeApprovalPending
                ? [
                    ...(item.doctorMessages ?? []),
                    {
                      id: uid("message"),
                      author: "lab" as const,
                      authorName: activeStaff.name,
                      text: "Ora updated your case details. Please review the appointment information.",
                      createdAt: now,
                      attachments: [],
                    },
                  ]
                : item.doctorMessages,
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date: now,
                  staffId: activeStaff.id,
                  action: "edited",
                  label: "Edited case details",
                },
              ],
            }
          : item,
      ),
    }));
    addActivity(
      `Edited case ${labCase.caseNumber}`,
      activeStaff.id,
      "case",
      labCase.id,
    );
    setToast(`${labCase.caseNumber} details updated.`);
  }

  function recordPayment(event: FormEvent<HTMLFormElement>, labCase: LabCase) {
    event.preventDefault();
    if (!hasPermission(ora, activeStaff, "payment_manage")) {
      setToast("Your role cannot update case payments.");
      return false;
    }
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("usdAmount") ?? form.get("amount"));
    if (!Number.isFinite(amount) || Math.abs(amount) < 0.001) {
      setToast("Enter a positive payment or a negative correction.");
      return false;
    }
    if (amount > labCase.price - labCase.paid) {
      setToast(
        `The payment cannot exceed the ${money(labCase.price - labCase.paid, ora.currency)} remaining balance.`,
      );
      return false;
    }
    if (amount < -labCase.paid) {
      setToast(
        `The correction cannot exceed the ${money(labCase.paid, ora.currency)} already paid.`,
      );
      return false;
    }
    const enteredDate = String(form.get("date") || toISODate(new Date()));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(enteredDate)
      ? `${enteredDate}T12:00:00`
      : new Date().toISOString();
    const method = String(form.get("method") || "Cash");
    const reference =
      String(form.get("reference") || "").trim() ||
      `PAY-${ora.payments.length + 281}`;
    const account = String(
      form.get("account") ||
        (method === "Cash" ? "Undeposited Funds" : "In Bank Account"),
    );
    const currency = form.get("currency") === "SYP" ? "SYP" : "USD";
    const sourceAmount = Number(form.get("amount"));
    const exchangeRate = currency === "SYP" ? Number(form.get("exchangeRate")) : undefined;
    const note =
      String(form.get("note") || "").trim() ||
      (amount > 0 ? "Payment received" : "Payment correction");
    const paymentId = uid("pay");
    update((current) => ({
      ...current,
      cases: current.cases.map((item) =>
        item.id === labCase.id
          ? {
              ...item,
              paid: item.paid + amount,
              history: [
                ...item.history,
                {
                  id: uid("history"),
                  date,
                  staffId: activeStaff.id,
                  action: "payment",
                  label: `${amount > 0 ? "Recorded" : "Corrected"} payment by ${money(Math.abs(amount), ora.currency)}`,
                },
              ],
            }
          : item,
      ),
      payments: [
        {
          id: paymentId,
          caseId: labCase.id,
          doctorId: labCase.doctorId,
          date,
          amount,
          staffId: activeStaff.id,
          note,
          method,
          reference,
          account,
          currency,
          sourceAmount: currency === "SYP" ? sourceAmount : undefined,
          exchangeRate,
        },
        ...current.payments,
      ],
    }));
    queueLedgerEntry({
      id: `ledger-${paymentId}`,
      account,
      date: date.slice(0, 10),
      reference,
      type: amount > 0 ? "Customer payment" : "Payment correction",
      amount: Math.abs(amount),
      direction: amount > 0 ? "in" : "out",
      category: "Accounts Receivable",
      contact: ora.doctors.find((item) => item.id === labCase.doctorId)?.name ?? "Doctor payment",
      method,
      memo: note,
      currency,
      sourceAmount: currency === "SYP" ? Math.abs(sourceAmount) : undefined,
      exchangeRate,
    });
    event.currentTarget.reset();
    addActivity(
      `${amount > 0 ? "Recorded" : "Corrected"} ${money(Math.abs(amount), ora.currency)} payment on case ${labCase.caseNumber}`,
      activeStaff.id,
      "payment",
      labCase.id,
    );
    setToast(amount > 0 ? "Payment recorded." : "Payment correction recorded.");
    return true;
  }

  function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const description = String(form.get("description"));
    update((current) => ({
      ...current,
      expenses: [
        {
          id: uid("exp"),
          date: String(form.get("date")),
          category: String(form.get("category")),
          description,
          amount: Number(form.get("amount")),
        },
        ...current.expenses,
      ],
    }));
    addActivity(`Recorded expense: ${description}`, activeStaff.id, "payment");
    setModal(null);
    setToast("Expense added to the accounts.");
  }

  function addDoctor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasPermission(ora, activeStaff, "case_intake")) return;
    const form = new FormData(event.currentTarget);
    const skipPricing = String(form.get("skipPricing")) === "true";
    const practiceType = String(form.get("practiceType")) as PracticeType;
    const clinic =
      practiceType === "individual"
        ? "Independent practice"
        : String(form.get("clinic"));
    const priceList =
      practiceType === "clinic"
        ? (ora.clinicProfiles[clinic]?.priceList ??
          Object.fromEntries(
            ora.serviceTypes.map((service) => [service, 0]),
          ))
        : Object.fromEntries(
            ora.serviceTypes.map((service) => [
              service,
              skipPricing ? 0 : Number(form.get(`price-${service}`)) || 0,
            ]),
          );
    const doctor: Doctor = {
      id: uid("doc"),
      name: String(form.get("name")).trim(),
      clinic,
      practiceType,
      phone: String(form.get("phone")).trim(),
      address: String(form.get("address")).trim(),
      priceList,
    };
    update((current) => ({
      ...current,
      doctors: [...current.doctors, doctor],
    }));
    addActivity(
      `Added doctor ${doctor.name}`,
      activeStaff.id,
      "doctor",
      doctor.id,
    );
    setModal(null);
    setToast(`${doctor.name} added.`);
  }

  function savePriceList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDoctorId || !hasPermission(ora, activeStaff, "case_intake"))
      return;
    const form = new FormData(event.currentTarget);
    const practiceType = String(form.get("practiceType")) as PracticeType;
    const clinic =
      practiceType === "individual"
        ? "Independent practice"
        : String(form.get("clinic"));
    update((current) => ({
      ...current,
      doctors: current.doctors.map((doctor) =>
        doctor.id === selectedDoctorId
          ? {
              ...doctor,
              name: String(form.get("name")).trim(),
              phone: String(form.get("phone")).trim(),
              address: String(form.get("address")).trim(),
              practiceType,
              clinic,
              priceList:
                practiceType === "individual"
                  ? (Object.fromEntries(
                      current.serviceTypes.map((service) => [
                        service,
                        Number(form.get(service)),
                      ]),
                    ) as Doctor["priceList"])
                  : (current.clinicProfiles[clinic]?.priceList ??
                    doctor.priceList),
            }
          : doctor,
      ),
    }));
    addActivity(
      `Updated doctor ${String(form.get("name")).trim()} and price list`,
      activeStaff.id,
      "doctor",
      selectedDoctorId,
    );
    setModal(null);
    setToast(
      "Doctor details and price list updated. Existing case prices were kept unchanged.",
    );
  }

  function removeDoctor(doctor: Doctor) {
    if (!hasPermission(ora, activeStaff, "case_intake")) return;
    const cases = ora.cases.filter((item) => item.doctorId === doctor.id);
    const outstanding = cases.reduce(
      (sum, item) => sum + item.price - item.paid,
      0,
    );
    setConfirmDialog({
      title: `Remove ${doctor.name}?`,
      message: `${doctor.name} will disappear from the active doctor directory and future case forms. ${cases.length} historical case${cases.length === 1 ? "" : "s"} and ${money(outstanding, ora.currency)} outstanding will remain intact for accounting and audit history.`,
      confirmLabel: "Remove doctor",
      onConfirm: () => {
        update((current) => ({
          ...current,
          doctors: current.doctors.map((item) =>
            item.id === doctor.id ? { ...item, active: false } : item,
          ),
        }));
        addActivity(
          `Removed doctor ${doctor.name} from the active directory`,
          activeStaff.id,
          "doctor",
          doctor.id,
        );
        setConfirmDialog(null);
        setToast(`${doctor.name} removed from active doctors.`);
      },
    });
  }

  function saveDoctorPortalAccount(
    doctorId: string,
    username: string,
    password: string,
  ) {
    if (!isAdmin) return false;
    const cleanUsername = username.trim();
    if (cleanUsername.length < 3) {
      setToast("The portal username must be at least 3 characters.");
      return false;
    }
    if (password.length < 6) {
      setToast("The portal password must be at least 6 characters.");
      return false;
    }
    const duplicate = ora.doctors.some(
      (doctor) =>
        doctor.id !== doctorId &&
        doctor.portalAccount?.username.toLowerCase() ===
          cleanUsername.toLowerCase(),
    );
    if (
      duplicate ||
      ora.staff.some(
        (member) => member.name.toLowerCase() === cleanUsername.toLowerCase(),
      )
    ) {
      setToast("That username is already in use.");
      return false;
    }
    const doctor = ora.doctors.find((item) => item.id === doctorId);
    if (!doctor) return false;
    update((current) => ({
      ...current,
      doctors: current.doctors.map((item) =>
        item.id === doctorId
          ? {
              ...item,
              portalAccount: {
                username: cleanUsername,
                password,
                createdAt:
                  item.portalAccount?.createdAt ?? new Date().toISOString(),
              },
            }
          : item,
      ),
    }));
    addActivity(
      `${doctor.portalAccount ? "Updated" : "Created"} doctor portal account for ${doctor.name}`,
      activeStaff.id,
      "doctor",
      doctorId,
    );
    setToast(
      `Portal login saved for ${doctor.name}. Share the username and password manually.`,
    );
    return true;
  }

  function removeDoctorPortalAccount(doctorId: string) {
    if (!isAdmin) return;
    const doctor = ora.doctors.find((item) => item.id === doctorId);
    if (!doctor?.portalAccount) return;
    setConfirmDialog({
      title: `Remove ${doctor.name}'s portal access?`,
      message:
        "Their login will stop working immediately. Their cases, invoices and conversations will not be removed.",
      confirmLabel: "Remove portal access",
      destructive: true,
      onConfirm: () => {
        update((current) => ({
          ...current,
          doctors: current.doctors.map((item) => {
            if (item.id !== doctorId) return item;
            const { portalAccount, ...withoutPortal } = item;
            return portalAccount ? withoutPortal : item;
          }),
        }));
        addActivity(
          `Removed doctor portal account for ${doctor.name}`,
          activeStaff.id,
          "doctor",
          doctorId,
        );
        setConfirmDialog(null);
        setToast(`Portal access removed for ${doctor.name}.`);
      },
    });
  }

  function removeDoctorPayment(paymentId: string) {
    if (!canManageDoctorHistory) return;
    const payment = ora.payments.find((item) => item.id === paymentId);
    if (!payment) return;
    const labCase = ora.cases.find((item) => item.id === payment.caseId);
    setConfirmDialog({
      title: "Delete this payment?",
      message: `${money(payment.amount, ora.currency)} will be removed from ${labCase ? `case ${labCase.caseNumber}` : "the doctor account"}. The case paid balance and statement will be recalculated from the remaining payment records.`,
      confirmLabel: "Delete payment",
      onConfirm: () => {
        const now = new Date().toISOString();
        update((current) => {
          const payments = current.payments.filter(
            (item) => item.id !== paymentId,
          );
          return {
            ...current,
            payments,
            cases: current.cases.map((item) => {
              if (item.id !== payment.caseId) return item;
              const paid = payments
                .filter((entry) => entry.caseId === item.id)
                .reduce((sum, entry) => sum + entry.amount, 0);
              return {
                ...item,
                paid: Math.max(0, Math.min(item.price, paid)),
                history: [
                  ...item.history,
                  {
                    id: uid("history"),
                    date: now,
                    staffId: activeStaff.id,
                    action: "payment",
                    label: `Deleted payment record of ${money(payment.amount, current.currency)}`,
                  },
                ],
              };
            }),
            activities: [
              {
                id: uid("act"),
                date: now,
                staffId: activeStaff.id,
                action: `Deleted ${money(payment.amount, current.currency)} payment${labCase ? ` from case ${labCase.caseNumber}` : ""}`,
                entityType: "payment",
                entityId: payment.caseId,
              },
              ...current.activities,
            ],
          };
        });
        setConfirmDialog(null);
        setToast("Payment deleted and the account balance was recalculated.");
      },
    });
  }

  function removeDoctorCase(caseId: string) {
    if (!canManageDoctorHistory) return;
    const labCase = ora.cases.find((item) => item.id === caseId);
    if (!labCase) return;
    const linkedPayments = ora.payments.filter(
      (item) => item.caseId === caseId,
    );
    setConfirmDialog({
      title: `Delete case ${labCase.caseNumber}?`,
      message: `This permanently removes the case, its ${linkedPayments.length} payment record${linkedPayments.length === 1 ? "" : "s"}, invoice, notes, and workflow history. Recorded material quantities will be returned to inventory.`,
      confirmLabel: "Delete case",
      onConfirm: () => {
        const now = new Date().toISOString();
        const returnedMaterials = labCase.materialUsage.reduce<
          Record<string, number>
        >(
          (totals, usage) => ({
            ...totals,
            [usage.materialId]:
              (totals[usage.materialId] ?? 0) + usage.quantity,
          }),
          {},
        );
        update((current) => ({
          ...current,
          cases: current.cases.filter((item) => item.id !== caseId),
          payments: current.payments.filter((item) => item.caseId !== caseId),
          materials: current.materials.map((material) => ({
            ...material,
            stock: material.stock + (returnedMaterials[material.id] ?? 0),
          })),
          inventoryLogs: current.inventoryLogs.filter(
            (log) => log.caseId !== caseId,
          ),
          activities: [
            {
              id: uid("act"),
              date: now,
              staffId: activeStaff.id,
              action: `Permanently deleted case ${labCase.caseNumber} and its linked account records`,
              entityType: "case",
              entityId: caseId,
            },
            ...current.activities,
          ],
        }));
        setSelectedCaseId((current) => (current === caseId ? null : current));
        setConfirmDialog(null);
        setToast(
          `Case ${labCase.caseNumber} and its account entries were deleted.`,
        );
      },
    });
  }

  function addMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasPermission(ora, activeStaff, "catalog_manage")) return;
    const form = new FormData(event.currentTarget);
    const selectedCategory = String(form.get("category"));
    const category =
      selectedCategory === "__other"
        ? String(form.get("customCategory")).trim()
        : selectedCategory;
    const material: Material = {
      id: uid("mat"),
      name: String(form.get("name")),
      category,
      stock: Number(form.get("stock")),
      unit: String(form.get("unit")),
      lowStock: Number(form.get("lowStock")),
      batch: String(form.get("batch")),
      supplier: String(form.get("supplier")),
      expiry: String(form.get("expiry")),
      cost: Number(form.get("cost")),
    };
    update((current) => ({
      ...current,
      materials: [...current.materials, material],
    }));
    addActivity(
      `Added inventory material ${material.name}`,
      activeStaff.id,
      "inventory",
      material.id,
    );
    setModal(null);
    setToast(`${material.name} added to inventory.`);
  }

  function adjustStock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selectedMaterialId ||
      !hasPermission(ora, activeStaff, "catalog_manage")
    )
      return;
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get("quantity"));
    const note = String(form.get("note"));
    update((current) => ({
      ...current,
      materials: current.materials.map((item) =>
        item.id === selectedMaterialId
          ? { ...item, stock: Math.max(0, item.stock + quantity) }
          : item,
      ),
      inventoryLogs: [
        {
          id: uid("log"),
          date: new Date().toISOString(),
          materialId: selectedMaterialId,
          quantity,
          type: quantity > 0 ? "restock" : "adjustment",
          note,
        },
        ...current.inventoryLogs,
      ],
    }));
    addActivity(
      `Adjusted stock for ${ora.materials.find((item) => item.id === selectedMaterialId)?.name ?? "material"}: ${quantity > 0 ? "+" : ""}${quantity}`,
      activeStaff.id,
      "inventory",
      selectedMaterialId,
    );
    setModal(null);
    setToast("Stock level updated.");
  }

  function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasPermission(ora, activeStaff, "team_manage")) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const roleIds = form.getAll("roleIds").map(String);
    const role =
      roleIds
        .map((id) => ora.roles.find((item) => item.id === id)?.name)
        .filter(Boolean)
        .join(" + ") || "Team member";
    const member: StaffMember = {
      id: uid("staff"),
      name,
      role,
      roleIds,
      initials: name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      phone: String(form.get("phone") ?? ""),
      color: String(form.get("color")),
      photo: String(form.get("photo") ?? ""),
      active: true,
    };
    update((current) => ({ ...current, staff: [...current.staff, member] }));
    addActivity(`Added team member ${name}`, activeStaff.id, "team", member.id);
    setModal(null);
    setToast(`${name} added to the team.`);
  }

  function saveStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStaffId) return;
    const editingSelf = selectedStaffId === activeStaff.id;
    if (!editingSelf && !hasPermission(ora, activeStaff, "team_manage")) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const roleIds = hasPermission(ora, activeStaff, "team_manage")
      ? form.getAll("roleIds").map(String)
      : (ora.staff.find((member) => member.id === selectedStaffId)?.roleIds ??
        []);
    const role =
      roleIds
        .map((id) => ora.roles.find((item) => item.id === id)?.name)
        .filter(Boolean)
        .join(" + ") || "Team member";
    update((current) => ({
      ...current,
      staff: current.staff.map((member) =>
        member.id === selectedStaffId
          ? {
              ...member,
              name,
              role,
              roleIds,
              initials: name
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              phone: String(form.get("phone") ?? ""),
              color: String(form.get("color")),
              photo: String(form.get("photo") ?? ""),
            }
          : member,
      ),
    }));
    addActivity(
      `Updated team member ${name}`,
      activeStaff.id,
      "team",
      selectedStaffId,
    );
    setModal(null);
    setToast(`${name}'s profile was updated.`);
  }

  function removeStaff(member: StaffMember) {
    if (!hasPermission(ora, activeStaff, "team_manage")) return;
    if (member.id === activeStaff.id) {
      setToast(
        "You cannot remove the account you are currently signed in with.",
      );
      return;
    }
    const assignedCases = ora.cases.filter(
      (item) => item.assignedTo === member.id && item.status !== "Closed",
    );
    setConfirmDialog({
      title: `Remove ${member.name}?`,
      message: `${member.name} will no longer be able to sign in or receive assignments. Their work history will remain attached to every case. ${assignedCases.length} active case${assignedCases.length === 1 ? " is" : "s are"} currently assigned to them and will be released for another specialist.`,
      confirmLabel: "Remove user",
      onConfirm: () => {
        const now = new Date().toISOString();
        update((current) => ({
          ...current,
          staff: current.staff.map((item) =>
            item.id === member.id ? { ...item, active: false } : item,
          ),
          cases: current.cases.map((item) =>
            item.assignedTo === member.id
              ? {
                  ...item,
                  assignedTo: "",
                  history: [
                    ...item.history,
                    {
                      id: uid("history"),
                      date: now,
                      staffId: activeStaff.id,
                      action: "assigned" as const,
                      label: `Removed ${member.name} from the team and released the case`,
                      fromStaffId: member.id,
                    },
                  ],
                }
              : item,
          ),
        }));
        addActivity(
          `Removed team member ${member.name}`,
          activeStaff.id,
          "team",
          member.id,
        );
        setConfirmDialog(null);
        setToast(`${member.name} was removed from the active team.`);
      },
    });
  }

  function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasPermission(ora, activeStaff, "role_manage")) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const roleId = selectedRoleId ?? uid("role");
    const role: RoleDefinition = {
      id: roleId,
      name,
      color: String(form.get("color")),
      permissions: form.getAll("permissions").map(String) as PermissionKey[],
      specialties: form.getAll("specialties").map(String) as CaseStatus[],
    };
    update((current) => {
      const roles = selectedRoleId
        ? current.roles.map((item) => (item.id === roleId ? role : item))
        : [...current.roles, role];
      const staff = current.staff.map((member) => ({
        ...member,
        role:
          member.roleIds
            .map((id) => roles.find((item) => item.id === id)?.name)
            .filter(Boolean)
            .join(" + ") || "Team member",
      }));
      return { ...current, roles, staff };
    });
    addActivity(
      `${selectedRoleId ? "Updated" : "Created"} role ${name}`,
      activeStaff.id,
      "role",
      roleId,
    );
    setModal(null);
    setSelectedRoleId(null);
    setToast(`${name} role saved.`);
  }

  function removeRole(role: RoleDefinition) {
    const memberCount = ora.staff.filter((member) =>
      member.roleIds.includes(role.id),
    ).length;
    setConfirmDialog({
      title: `Delete ${role.name}?`,
      message: `${memberCount} team ${memberCount === 1 ? "member uses" : "members use"} this role. Deleting it removes those permissions and specialties from them, but keeps their profiles and history.`,
      confirmLabel: "Delete role",
      onConfirm: () => {
        update((current) => ({
          ...current,
          roles: current.roles.filter((item) => item.id !== role.id),
          staff: current.staff.map((member) => {
            const roleIds = member.roleIds.filter((id) => id !== role.id);
            return {
              ...member,
              roleIds,
              role:
                roleIds
                  .map(
                    (id) => current.roles.find((item) => item.id === id)?.name,
                  )
                  .filter(Boolean)
                  .join(" + ") || "Team member",
            };
          }),
        }));
        addActivity(
          `Deleted role ${role.name}`,
          activeStaff.id,
          "role",
          role.id,
        );
        setConfirmDialog(null);
        setToast(`${role.name} was deleted.`);
      },
    });
  }

  function renameClinic(oldName: string, newName: string) {
    const cleanName = newName.trim();
    if (
      !cleanName ||
      ora.clinics.some(
        (clinic) =>
          clinic !== oldName &&
          clinic.toLowerCase() === cleanName.toLowerCase(),
      )
    )
      return false;
    update((current) => {
      const profiles = {
        ...current.clinicProfiles,
        [cleanName]: current.clinicProfiles[oldName],
      };
      delete profiles[oldName];
      return {
        ...current,
        clinics: current.clinics.map((clinic) =>
          clinic === oldName ? cleanName : clinic,
        ),
        clinicProfiles: profiles,
        doctors: current.doctors.map((doctor) =>
          doctor.clinic === oldName ? { ...doctor, clinic: cleanName } : doctor,
        ),
      };
    });
    addActivity(
      `Renamed clinic ${oldName} to ${cleanName}`,
      activeStaff.id,
      "clinic",
      oldName,
    );
    return true;
  }

  function saveClinicProfile(
    name: string,
    phone: string,
    address: string,
    notes: string,
    prices: Record<string, number>,
  ) {
    update((current) => ({
      ...current,
      clinicProfiles: {
        ...current.clinicProfiles,
        [name]: { phone, address, notes, priceList: prices },
      },
    }));
    if (selectedClinic) setSelectedClinic(name);
    addActivity(
      `Updated clinic details and price list for ${name}`,
      activeStaff.id,
      "clinic",
      name,
    );
    setToast(`${name} updated.`);
  }

  function removeClinic(name: string) {
    const doctorCount = ora.doctors.filter(
      (doctor) => doctor.active !== false && doctor.clinic === name,
    ).length;
    setConfirmDialog({
      title: `Delete ${name}?`,
      message: `${doctorCount} active ${doctorCount === 1 ? "doctor is" : "doctors are"} linked to this clinic. They will be moved to Independent practice, while their cases and account history stay intact.`,
      confirmLabel: "Delete clinic",
      onConfirm: () => {
        update((current) => {
          const profiles = { ...current.clinicProfiles };
          delete profiles[name];
          return {
            ...current,
            clinics: current.clinics.filter((clinic) => clinic !== name),
            clinicProfiles: profiles,
            doctors: current.doctors.map((doctor) =>
              doctor.clinic === name
                ? {
                    ...doctor,
                    clinic: "Independent practice",
                    practiceType: "individual",
                    priceList:
                      current.clinicProfiles[name]?.priceList ??
                      doctor.priceList,
                  }
                : doctor,
            ),
          };
        });
        addActivity(
          `Deleted clinic option ${name}`,
          activeStaff.id,
          "clinic",
          name,
        );
        if (selectedClinic === name) {
          setSelectedClinic(null);
          setModal(null);
        }
        setConfirmDialog(null);
        setToast(
          `${name} deleted. Linked doctors were moved to Independent practice.`,
        );
      },
    });
  }

  function periodStart() {
    const date = new Date();
    if (statementPeriod === "day") return toISODate(date);
    if (statementPeriod === "week") return toISODate(getWeekStart(date));
    if (statementPeriod === "month")
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    if (statementPeriod === "year") return `${date.getFullYear()}-01-01`;
    return "0000-01-01";
  }

  function exportBackup() {
    downloadFile(
      `ora-backup-${today}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    setToast("Workspace backup downloaded.");
  }

  function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = migrateOraData(
          JSON.parse(String(reader.result)) as Partial<OraData>,
        );
        if (
          !Array.isArray(imported.cases) ||
          !Array.isArray(imported.doctors) ||
          !Array.isArray(imported.materials)
        )
          throw new Error("Invalid Ora backup");
        update(() => imported);
        setToast("Backup restored successfully.");
      } catch {
        setToast("That file is not a valid Ora backup.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  const shellProps = {
    data,
    activeStaff,
    view: permittedView,
    goTo,
    logout,
    mobileNav,
    setMobileNav,
    desktopNavCollapsed,
    setDesktopNavCollapsed,
    search,
    setSearch,
    onOpenCase: setSelectedCaseId,
    onScanQr: () => setModal("qr-scanner"),
    onUpdate: update,
    onEditProfile: () => {
      setSelectedStaffId(activeStaff.id);
      setModal("edit-staff");
    },
  };

  return (
    <div className="app-shell">
      <Sidebar {...shellProps} />
      <main
        className={`main-area ${desktopNavCollapsed ? "sidebar-collapsed" : ""}`}
      >
        <AppHeader {...shellProps} />
        <div className="view-wrap">
          {permittedView === "dashboard" && (
            <Dashboard
              data={data}
              activeStaff={activeStaff}
              dueToday={dueToday}
              overdue={overdue}
              ready={ready}
              lowStock={lowStock}
              canCreate={intakeAllowed}
              canViewAccounting={hasPermission(
                data,
                activeStaff,
                "view_accounting",
              )}
              onOpenCase={setSelectedCaseId}
              onNewCase={() => setModal("new-case")}
              onView={goTo}
            />
          )}
          {permittedView === "cases" && (
            <div className="cases-view">
              <CasesView
                data={data}
                activeStaff={activeStaff}
                cases={filteredCases}
                highlightedCaseId={highlightedCaseId}
                search={search}
                setSearch={setSearch}
                status={caseStatus}
                setStatus={setCaseStatusFilter}
                canCreate={intakeAllowed}
                onOpen={setSelectedCaseId}
                onNew={() => setModal("new-case")}
              />
            </div>
          )}
          {permittedView === "schedule" && (
            <ScheduleView
              data={data}
              weekOffset={weekOffset}
              setWeekOffset={setWeekOffset}
              onOpen={setSelectedCaseId}
            />
          )}
          {permittedView === "delivery" && (
            <DeliveryView
              data={data}
              activeDriverId={isDeliveryDriver ? activeStaff.id : undefined}
              canAdd={intakeAllowed}
              canApproveOralScans={canApproveOralScans}
              canAssignDrivers={isAdmin}
              onAdd={() => setModal("new-delivery")}
              onOutForPickup={setOutForPickup}
              onCollect={collectDelivery}
              onReceivedAtLab={receivePickupAtLab}
              onApproveOralScan={approveOralScan}
              onApproveDoctorRequest={approveDoctorDeliveryRequest}
              onAssignDriver={assignDeliveryDriver}
              onAssignTaskDriver={assignDeliveryTaskDriver}
              onOutForScan={setOutForScan}
              onScanCompleted={completeOralScan}
              onOutForDelivery={setOutForDelivery}
              onDelivered={confirmDelivery}
              onStartTask={startDeliveryTask}
              onCompleteTask={completeDeliveryTask}
            />
          )}
          {permittedView === "doctors" && (
            <div className="doctors-view">
              <DoctorsView
                data={data}
                canManage={intakeAllowed}
                canManageAccount={canManageDoctorHistory}
                canManagePortal={isAdmin}
                canViewMoney={hasPermission(
                  data,
                  activeStaff,
                  "view_accounting",
                )}
                canViewStatements={hasPermission(
                  data,
                  activeStaff,
                  "view_doctor_statements",
                )}
                onStatement={setStatementDoctorId}
                onClinicStatement={(clinic) =>
                  printClinicStatement(
                    data,
                    clinic,
                    periodStart(),
                    statementPeriod === "all"
                      ? "All time"
                      : `This ${statementPeriod}`,
                  )
                }
                onAdd={() => setModal("new-doctor")}
                onCreateClinic={() => setModal("new-clinic")}
                onClinics={(clinic) => {
                  setSelectedClinic(clinic ?? null);
                  setModal("clinics");
                }}
                onEdit={(id) => {
                  setSelectedDoctorId(id);
                  setModal("price-list");
                }}
                onAccount={(id) => {
                  setSelectedDoctorId(id);
                  setModal("doctor-account");
                }}
                onPortalAccount={(id) => {
                  setSelectedDoctorId(id);
                  setModal("doctor-portal-account");
                }}
                onOpenPortal={setPortalPreviewDoctorId}
                onRemove={removeDoctor}
              />
            </div>
          )}
          {permittedView === "accounting" && (
            <AccountingWorkspace
              data={data}
              canManageExpenses={hasPermission(
                data,
                activeStaff,
                "expense_manage",
              )}
              period={statementPeriod}
              setPeriod={setStatementPeriod}
              start={periodStart()}
              onExpense={() => setModal("new-expense")}
              onExport={() => {
                void exportAccountingStatementPdf(
                  data,
                  periodStart(),
                  statementPeriod === "all"
                    ? "All time"
                    : `This ${statementPeriod}`,
                );
              }}
              onPrint={() =>
                printAccountingStatement(
                  data,
                  periodStart(),
                  statementPeriod === "all"
                    ? "All time"
                    : `This ${statementPeriod}`,
                )
              }
              onStatement={setStatementDoctorId}
              onOpenCase={setSelectedCaseId}
            />
          )}
          {permittedView === "inventory" && (
            <InventoryView
              data={data}
              canManage={hasPermission(data, activeStaff, "catalog_manage")}
              canViewCosts={hasPermission(data, activeStaff, "view_accounting")}
              onAdd={() => setModal("new-material")}
              onAdjust={(id) => {
                setSelectedMaterialId(id);
                setModal("adjust-stock");
              }}
            />
          )}
          {permittedView === "team" && (
            <TeamView
              data={data}
              activeStaff={activeStaff}
              onAdd={() => setModal("new-staff")}
              onEdit={(id) => {
                setSelectedStaffId(id);
                setModal("edit-staff");
              }}
              onAccount={(id) => {
                setSelectedStaffId(id);
                setModal("staff-account");
              }}
              onRemove={removeStaff}
              onStatement={setStaffStatementId}
            />
          )}
          {permittedView === "log" && (
            <LogView data={data} onOpenCase={setSelectedCaseId} />
          )}
          {permittedView === "settings" && (
            <SettingsViewV2
              data={data}
              activeStaff={activeStaff}
              authUser={authUser}
              onUpdate={update}
              onAddService={addServiceType}
              onAddCategory={addMaterialCategory}
              onRenameService={renameServiceType}
              onRenameCategory={renameMaterialCategory}
              onRemoveService={removeServiceType}
              onRemoveCategory={removeMaterialCategory}
              onAddRole={() => {
                setSelectedRoleId(null);
                setModal("new-role");
              }}
              onEditRole={(id) => {
                setSelectedRoleId(id);
                setModal("edit-role");
              }}
              onRemoveRole={removeRole}
              onExport={exportBackup}
              onImport={() => importRef.current?.click()}
            />
          )}
        </div>
      </main>

      <input
        ref={importRef}
        className="hidden-input"
        type="file"
        accept="application/json,.json"
        onChange={importBackup}
      />
      {selectedCase && (
        <CaseDrawerV2
          key={selectedCase.id}
          data={data}
          labCase={selectedCase}
          activeStaff={activeStaff}
          canArchive={intakeAllowed}
          canManageHold={isAdmin}
          onClose={() => setSelectedCaseId(null)}
          onQr={() => {
            setQrCaseId(selectedCase.id);
            setModal("case-qr");
          }}
          onPrintJob={() => {
            void printJobOrderDocument(
              data,
              selectedCase,
              caseQrUrl(selectedCase.id, "job-order"),
            );
          }}
          onPrintSticker={() => {
            void printCaseStickerDocument(
              data,
              selectedCase,
              caseQrUrl(selectedCase.id, "sticker"),
            );
          }}
          onStatus={changeCaseStatus}
          onTake={takeCase}
          onRelease={releaseCase}
          onArchive={archiveCase}
          onRestore={restoreCase}
          onSetHold={setCaseHold}
          onResumeHold={resumeCaseHold}
          onAssign={assignCase}
          onNote={addCaseNote}
          onDoctorMessage={addDoctorMessage}
          onApproveIntake={approveDoctorCase}
          onApprove={approveCase}
          onUsage={recordUsage}
          onPayment={recordPayment}
          onEdit={editCase}
          onReviseUsage={reviseMaterialUsage}
          onRemoveUsage={removeMaterialUsage}
        />
      )}
      {deliveryCase && (
        <DeliveryCaseModal
          data={data}
          labCase={deliveryCase}
          onClose={() => setDeliveryCaseId(null)}
          onOutForPickup={setOutForPickup}
          onCollect={collectDelivery}
          onReceivedAtLab={receivePickupAtLab}
          onOutForScan={setOutForScan}
          onScanCompleted={completeOralScan}
          onOutForDelivery={setOutForDelivery}
          onDelivered={confirmDelivery}
        />
      )}
      {selectedCase && hasPermission(data, activeStaff, "view_invoices") && (
        <CaseFinanceActions
          labCase={selectedCase}
          canEdit={hasPermission(data, activeStaff, "payment_manage")}
          onInvoice={() => setInvoiceCaseId(selectedCase.id)}
          onPayment={() => setPaymentCaseId(selectedCase.id)}
        />
      )}
      {invoiceCase && hasPermission(data, activeStaff, "view_invoices") && (
        <InvoiceModal
          data={data}
          labCase={invoiceCase}
          onClose={() => setInvoiceCaseId(null)}
        />
      )}
      {paymentCase && hasPermission(data, activeStaff, "view_payments") && (
        <PaymentEditorModal
          data={data}
          labCase={paymentCase}
          onClose={() => setPaymentCaseId(null)}
          onRecord={recordPayment}
        />
      )}
      {statementDoctor &&
        hasPermission(data, activeStaff, "view_doctor_statements") && (
          <DoctorStatementModal
            data={data}
            doctor={statementDoctor}
            start={periodStart()}
            period={statementPeriod}
            onClose={() => setStatementDoctorId(null)}
          />
        )}
      {statementStaff && (
        <StaffStatementModal
          data={data}
          member={statementStaff}
          onClose={() => setStaffStatementId(null)}
        />
      )}
      {modal === "new-case" && intakeAllowed && (
        <NewCaseModal
          data={data}
          onAddService={addServiceType}
          onClose={() => setModal(null)}
          onSubmit={createCase}
        />
      )}
      {modal === "new-delivery" && intakeAllowed && (
        <DeliveryTaskModal
          data={data}
          onClose={() => setModal(null)}
          onSubmit={addDeliveryTask}
        />
      )}
      {modal === "qr-scanner" && (
        <QrScannerModal
          onClose={() => setModal(null)}
          onScan={openCaseFromQr}
        />
      )}
      {modal === "case-qr" &&
        qrCaseId &&
        data.cases.some((item) => item.id === qrCaseId) && (
          <CaseQrModal
            labCase={data.cases.find((item) => item.id === qrCaseId)!}
            value={caseQrUrl(qrCaseId)}
            onClose={() => {
              setQrCaseId(null);
              setModal(null);
            }}
          />
        )}
      {modal === "new-expense" &&
        hasPermission(data, activeStaff, "expense_manage") && (
          <ExpenseModal
            today={today}
            onClose={() => setModal(null)}
            onSubmit={addExpense}
          />
        )}
      {modal === "new-doctor" && intakeAllowed && (
        <DoctorModal
          data={data}
          clinics={data.clinics}
          onAddClinic={addClinic}
          onClose={() => setModal(null)}
          onSubmit={addDoctor}
        />
      )}
      {modal === "new-clinic" && intakeAllowed && (
        <ClinicCreateModal
          data={data}
          onAdd={addClinic}
          onSave={saveClinicProfile}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "price-list" && selectedDoctorId && intakeAllowed && (
        <PriceModal
          doctor={data.doctors.find((item) => item.id === selectedDoctorId)!}
          clinics={data.clinics}
          serviceTypes={data.serviceTypes}
          currency={data.currency}
          onAddClinic={addClinic}
          onAddService={addServiceType}
          onClose={() => setModal(null)}
          onSubmit={savePriceList}
        />
      )}
      {modal === "doctor-account" &&
        selectedDoctorId &&
        canManageDoctorHistory && (
          <DoctorAccountModal
            data={data}
            doctor={data.doctors.find((item) => item.id === selectedDoctorId)!}
            onDeletePayment={removeDoctorPayment}
            onDeleteCase={removeDoctorCase}
            onClose={() => setModal(null)}
          />
        )}
      {modal === "doctor-portal-account" && selectedDoctorId && isAdmin && (
        <DoctorPortalAccountModal
          doctor={data.doctors.find((item) => item.id === selectedDoctorId)!}
          onClose={() => setModal(null)}
          onSave={saveDoctorPortalAccount}
          onRemove={removeDoctorPortalAccount}
        />
      )}
      {modal === "new-material" &&
        hasPermission(data, activeStaff, "catalog_manage") && (
          <MaterialModal
            categories={data.materialCategories}
            onAddCategory={addMaterialCategory}
            onClose={() => setModal(null)}
            onSubmit={addMaterial}
          />
        )}
      {modal === "adjust-stock" &&
        selectedMaterialId &&
        hasPermission(data, activeStaff, "catalog_manage") && (
          <AdjustStockModal
            material={data.materials.find(
              (item) => item.id === selectedMaterialId,
            )!}
            onClose={() => setModal(null)}
            onSubmit={adjustStock}
          />
        )}
      {modal === "new-staff" &&
        hasPermission(data, activeStaff, "team_manage") && (
          <StaffModal
            data={data}
            onClose={() => setModal(null)}
            onSubmit={addStaff}
          />
        )}
      {modal === "edit-staff" &&
        selectedStaff &&
        (selectedStaff.id === activeStaff.id ||
          hasPermission(data, activeStaff, "team_manage")) && (
          <StaffModal
            data={data}
            member={selectedStaff}
            canAssignRoles={hasPermission(data, activeStaff, "team_manage")}
            onClose={() => setModal(null)}
            onSubmit={saveStaff}
          />
        )}
      {modal === "staff-account" &&
        selectedStaff &&
        hasPermission(data, activeStaff, "team_manage") && (
          <StaffAccountModal
            member={selectedStaff}
            onClose={() => setModal(null)}
          />
        )}
      {(modal === "new-role" || modal === "edit-role") &&
        hasPermission(data, activeStaff, "role_manage") && (
          <RoleModal
            role={modal === "edit-role" ? selectedRole : undefined}
            onClose={() => setModal(null)}
            onSubmit={saveRole}
          />
        )}
      {modal === "clinics" &&
        hasPermission(data, activeStaff, "clinic_manage") && (
          <ClinicManagerModalV2
            key={selectedClinic ?? "all-clinics"}
            data={data}
            initialClinic={selectedClinic}
            onRename={renameClinic}
            onSave={saveClinicProfile}
            onRemove={removeClinic}
            onClose={() => {
              setSelectedClinic(null);
              setModal(null);
            }}
          />
        )}
      {confirmDialog && (
        <ConfirmationModal
          {...confirmDialog}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}

type ShellProps = {
  data: OraData;
  activeStaff: StaffMember;
  view: View;
  goTo: (view: View) => void;
  logout: () => void;
  mobileNav: boolean;
  setMobileNav: (value: boolean) => void;
  desktopNavCollapsed: boolean;
  setDesktopNavCollapsed: (value: boolean) => void;
  search: string;
  setSearch: (value: string) => void;
  onOpenCase: (id: string) => void;
  onScanQr: () => void;
  onEditProfile: () => void;
  onUpdate: (updater: DataUpdater) => void;
};

function Sidebar({
  data,
  activeStaff,
  view,
  goTo,
  logout,
  mobileNav,
  setMobileNav,
  desktopNavCollapsed,
  setDesktopNavCollapsed,
  onEditProfile,
}: ShellProps) {
  const openCases = data.cases.filter(
    (item) => !item.archived && item.status !== "Closed",
  ).length;
  const lowStock = data.materials.filter(
    (item) => item.stock <= item.lowStock,
  ).length;
  return (
    <aside
      className={`sidebar ${mobileNav ? "open" : ""} ${desktopNavCollapsed ? "collapsed" : ""}`}
    >
      <div className="sidebar-top">
        <div className="brand-lockup">
          {data.branding.logo ? (
            <span
              className="brand-mark custom-logo"
              style={{ backgroundImage: `url("${data.branding.logo}")` }}
            />
          ) : (
            <span className="brand-mark">
              {data.branding.title.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{data.branding.title}</strong>
            <small>{data.branding.subtitle}</small>
          </div>
        </div>
        <button
          className="icon-button mobile-only"
          type="button"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        >
          <X size={19} />
        </button>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setDesktopNavCollapsed(!desktopNavCollapsed)}
          aria-label={desktopNavCollapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!desktopNavCollapsed}
          title={desktopNavCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {desktopNavCollapsed ? (
            <PanelLeftOpen size={15} />
          ) : (
            <PanelLeftClose size={15} />
          )}
        </button>
      </div>
      <nav aria-label="Main navigation">
        <p className="nav-label">Workspace</p>
        {NAV_ITEMS.filter((item) =>
          roleCanView(item.id, data, activeStaff),
        ).map((item) => {
          const Icon = item.icon;
          const badge =
            item.id === "cases"
              ? openCases
              : item.id === "inventory" && lowStock
                ? lowStock
                : null;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => goTo(item.id)}
              aria-label={item.label}
              title={desktopNavCollapsed ? item.label : undefined}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {badge !== null && <b>{badge}</b>}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button
          className="profile-summary profile-button"
          type="button"
          onClick={onEditProfile}
          title="Edit my profile"
        >
          <Avatar member={activeStaff} />
          <span>
            <strong>{activeStaff.name}</strong>
            <small>{activeStaff.role}</small>
          </span>
        </button>
        <button
          className="icon-button"
          type="button"
          onClick={logout}
          aria-label="Lock workspace"
          title="Lock workspace"
        >
          <LogOut size={17} />
        </button>
      </div>
    </aside>
  );
}

function AppHeader({
  data,
  activeStaff,
  view,
  setMobileNav,
  search,
  setSearch,
  onOpenCase,
  onScanQr,
  onEditProfile,
  onUpdate,
}: ShellProps) {
  const deliveryOnly =
    hasPermission(data, activeStaff, "view_delivery") &&
    !hasPermission(data, activeStaff, "view_cases");
  const query = search.trim().toLowerCase();
  const results =
    query.length < 2 || deliveryOnly
      ? []
      : data.cases
          .filter((item) => {
            const doctor = data.doctors.find(
              (entry) => entry.id === item.doctorId,
            );
            return `${item.caseNumber} ${item.patient} ${item.patientRef} ${doctor?.name ?? ""} ${caseServiceSummary(item)}`
              .toLowerCase()
              .includes(query);
          })
          .slice(0, 6);
  return (
    <header
      className={`app-header ${deliveryOnly ? "delivery-only-header" : ""} ${view === "cases" ? "cases-header" : ""}`}
    >
      <button
        className="icon-button mobile-only"
        type="button"
        onClick={() => setMobileNav(true)}
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>
      <div className="page-title">
        <p>{VIEW_COPY[view].subtitle}</p>
        <h1>{VIEW_COPY[view].title}</h1>
      </div>
      <button
        className="icon-button qr-scan-button"
        type="button"
        onClick={onScanQr}
        aria-label="Scan case QR"
        title="Scan case QR"
      >
        <ScanLine size={18} />
      </button>
      {query.length >= 2 && (
        <button
          className="global-search-dismiss"
          type="button"
          aria-label="Close search results"
          onClick={() => setSearch("")}
        />
      )}
      <div className={`global-search-wrap ${query.length >= 2 ? "search-open" : ""}`}>
        <label className="global-search">
          <Search size={17} />
          <input
           
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cases, doctors, patient refs..."
            aria-label="Search"
          />
        </label>
        {query.length >= 2 && (
          <div className="global-search-results" role="dialog" aria-label="Search results">
            <header>
              <h2>Search results</h2>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSearch("")}
                aria-label="Close search results"
              >
                <X size={17} />
              </button>
            </header>
            {results.map((item) => {
              const doctor = data.doctors.find(
                (entry) => entry.id === item.doctorId,
              );
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    onOpenCase(item.id);
                    setSearch("");
                  }}
                >
                  <span>
                    <strong>
                      {item.caseNumber} · {item.patient || "Unnamed patient"}
                    </strong>
                    <small>
                      {doctor?.name} · {caseServiceSummary(item)}
                    </small>
                  </span>
                  <span>
                    <ImpressionBadge type={item.impressionType} />
                    <StatusBadge status={displayCaseStatus(item)} />
                  </span>
                </button>
              );
            })}
            {!results.length && <p>No matching cases.</p>}
          </div>
        )}
      </div>
      <button
        className="icon-button header-theme-toggle"
        type="button"
        onClick={() =>
          onUpdate((current) => ({
            ...current,
            theme: current.theme === "dark" ? "light" : "dark",
          }))
        }
        aria-label={`Switch to ${data.theme === "dark" ? "light" : "dark"} mode`}
        title={`Switch to ${data.theme === "dark" ? "light" : "dark"} mode`}
      >
        {data.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <button
        className="header-profile profile-button"
        type="button"
        onClick={onEditProfile}
        title="Edit my profile"
      >
        <Avatar member={activeStaff} small />
        <span>
          <strong>{activeStaff.name}</strong>
          <small>{activeStaff.role}</small>
        </span>
        <Pencil size={14} />
      </button>
    </header>
  );
}

export function Dashboard({
  data,
  activeStaff,
  dueToday,
  overdue,
  ready,
  lowStock,
  canCreate,
  canViewAccounting,
  onOpenCase,
  onNewCase,
  onView,
}: {
  data: OraData;
  activeStaff: StaffMember;
  dueToday: LabCase[];
  overdue: LabCase[];
  ready: LabCase[];
  lowStock: Material[];
  canCreate: boolean;
  canViewAccounting: boolean;
  onOpenCase: (id: string) => void;
  onNewCase: () => void;
  onView: (view: View) => void;
}) {
  const month = new Date().toISOString().slice(0, 7);
  const monthCases = data.cases.filter((item) =>
    item.receivedDate.startsWith(month),
  );
  const income = monthCases.reduce((sum, item) => sum + item.price, 0);
  const collected = monthCases.reduce((sum, item) => sum + item.paid, 0);
  const inProduction = data.cases.filter(
    (item) =>
      !item.archived && !["Quality Review", "Closed"].includes(item.status),
  );
  const stages = CASE_STATUSES.filter((item) => !["Closed"].includes(item));
  const workflowOnly =
    memberSpecialties(data, activeStaff).length > 0 &&
    !hasPermission(data, activeStaff, "team_manage");
  const visibleActivity = data.activities
    .filter(
      (item) =>
        !workflowOnly ||
        item.entityType === "case" ||
        item.entityType === "delivery",
    )
    .slice(0, 5);
  return (
    <div className="dashboard-view">
      <section className="action-strip">
        <div>
          <span className="eyebrow">
            <span className="live-dot" />
            Live lab status
          </span>
          <h2>{inProduction.length} cases moving through Ora</h2>
          <p>
            {overdue.length
              ? `${overdue.length} need attention today.`
              : "Everything is on schedule today."}
          </p>
        </div>
        {canCreate && (
          <button className="primary-button" type="button" onClick={onNewCase}>
            <Plus size={17} />
            New case
          </button>
        )}
      </section>
      <section className="metric-grid">
        <Metric
          icon={Clock3}
          label="Due today"
          value={dueToday.length}
          hint={`${overdue.length} overdue`}
          tone={overdue.length ? "danger" : "neutral"}
        />
        <Metric
          icon={Gauge}
          label="In production"
          value={inProduction.length}
          hint={`${data.cases.filter((item) => caseTags(item).includes("Rush") && item.status !== "Closed").length} rush cases`}
          tone="blue"
        />
        <Metric
          icon={ClipboardCheck}
          label="Ready for review"
          value={ready.length}
          hint="Awaiting final quality approval"
          tone="green"
        />
        {canViewAccounting ? (
          <Metric
            icon={CircleDollarSign}
            label="Month income"
            value={money(income, data.currency)}
            hint={`${money(collected, data.currency)} collected`}
            tone="amber"
          />
        ) : (
          <Metric
            icon={Boxes}
            label="Low stock"
            value={lowStock.length}
            hint="Materials at reorder level"
            tone="amber"
          />
        )}
      </section>
      <section className="dashboard-columns">
        <div className="panel production-panel">
          <div className="panel-heading">
            <div>
              <span>Production board</span>
              <h3>Cases by stage</h3>
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => onView("cases")}
            >
              View all <ChevronRight size={15} />
            </button>
          </div>
          <div className="stage-grid">
            {stages.map((stage) => {
              const items = data.cases.filter(
                (item) => !item.archived && item.status === stage,
              );
              return (
                <div className="stage-column" key={stage}>
                  <div className="stage-head">
                    <StatusBadge status={stage} />
                    <b>{items.length}</b>
                  </div>
                  {items.slice(0, 3).map((item) => {
                    const doctor = data.doctors.find(
                      (entry) => entry.id === item.doctorId,
                    );
                    return (
                      <button
                        type="button"
                        className={`mini-case ${isCaseOverdue(item) ? "overdue-case" : ""}`}
                        onClick={() => onOpenCase(item.id)}
                        key={item.id}
                      >
                        <span className="schedule-case-header">
                          <strong>{item.caseNumber}</strong>
                          <ImpressionBadge type={item.impressionType} />
                          <CaseTags labCase={item} />
                        </span>
                        <p>{doctor?.name}</p>
                        <small>
                          {caseTotalUnits(item)} units · Due{" "}
                          {formatDate(item.dueDate, {
                            day: "2-digit",
                            month: "short",
                          })}{" "}
                          {item.dueTime}
                        </small>
                      </button>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="empty-stage">No cases</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="dashboard-rail">
          <div className="panel attention-panel">
            <div className="panel-heading">
              <div>
                <span>Attention</span>
                <h3>Needs action</h3>
              </div>
              <AlertTriangle size={19} />
            </div>
            <div className="attention-list">
              {overdue.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenCase(item.id)}
                >
                  <span className="attention-icon">
                    <Clock3 size={16} />
                  </span>
                  <span>
                    <strong>{item.caseNumber} is overdue</strong>
                    <small>
                      {Math.abs(dateDiff(item.dueDate))} day(s) · {item.status}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
              {lowStock.slice(0, 2).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onView("inventory")}
                >
                  <span className="attention-icon stock">
                    <Boxes size={16} />
                  </span>
                  <span>
                    <strong>{item.name} is low</strong>
                    <small>
                      {item.stock} {item.unit} remaining
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!overdue.length && !lowStock.length && (
                <div className="empty-block">
                  <CheckCircle2 size={22} />
                  <p>No urgent items</p>
                </div>
              )}
            </div>
          </div>
          <div className="panel activity-panel">
            <div className="panel-heading">
              <div>
                <span>Activity</span>
                <h3>Latest updates</h3>
              </div>
              <Activity size={18} />
            </div>
            <div className="activity-list">
              {visibleActivity.map((item) => {
                const staff = data.staff.find(
                  (entry) => entry.id === item.staffId,
                );
                return (
                  <div key={item.id}>
                    <Avatar member={staff} small />
                    <span>
                      <p>{item.action}</p>
                      <small>
                        {staff?.name} · {formatDateTime(item.date)}
                      </small>
                    </span>
                  </div>
                );
              })}
              {!visibleActivity.length && (
                <div className="empty-block">
                  <p>No case or delivery updates yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: string | number;
  hint: string;
  tone: string;
}) {
  return (
    <div className={`metric ${tone}`}>
      <span className="metric-icon">
        <Icon size={19} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </div>
  );
}

export function CasesView({
  data,
  activeStaff,
  cases,
  highlightedCaseId,
  search,
  setSearch,
  status,
  setStatus,
  canCreate,
  onOpen,
  onNew,
}: {
  data: OraData;
  activeStaff: StaffMember;
  cases: LabCase[];
  highlightedCaseId: string | null;
  search: string;
  setSearch: (value: string) => void;
  status: "All" | DisplayCaseStatus;
  setStatus: (value: "All" | DisplayCaseStatus) => void;
  canCreate: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const t = (value: string) => value;
  const [sort, setSort] = useState<
    | "received-new"
    | "received-old"
    | "due-soon"
    | "due-late"
    | "priority"
    | "value"
  >("received-new");
  const [scope, setScope] = useState<"active" | "archived">("active");
  const [caseOwnership, setCaseOwnership] = useState<"all" | "mine">("all");
  const tableResetKey = `${search}-${status}-${scope}-${sort}-${caseOwnership}`;
  const [requestedTablePage, setRequestedTablePage] = useState({
    key: tableResetKey,
    page: 1,
  });
  const canViewValue = hasPermission(data, activeStaff, "view_case_value");
  const isTaskFocusedSort =
    sort === "due-soon" || sort === "due-late" || sort === "priority";
  const compareDueDates = (first: LabCase, second: LabCase) =>
    caseDueAt(first).getTime() - caseDueAt(second).getTime() ||
    first.caseNumber.localeCompare(second.caseNumber);
  const sortedCases = cases
    .filter((item) => (scope === "archived" ? item.archived : !item.archived))
    .filter((item) => !isTaskFocusedSort || item.status !== "Closed")
    .filter((item) => caseOwnership === "all" || item.assignedTo === activeStaff.id)
    .sort((a, b) => {
      if (sort === "received-old")
        return a.receivedDate.localeCompare(b.receivedDate);
      if (sort === "due-soon") return compareDueDates(a, b);
      if (sort === "due-late") return compareDueDates(b, a);
      if (sort === "priority") return compareDueDates(a, b);
      if (sort === "value") return b.price - a.price;
      return (
        b.receivedDate.localeCompare(a.receivedDate) ||
        b.caseNumber.localeCompare(a.caseNumber)
      );
    });
  const pageSize = 100;
  const pageCount = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  const requestedPage = requestedTablePage.key === tableResetKey
    ? requestedTablePage.page
    : 1;
  const currentPage = Math.min(requestedPage, pageCount);
  const paginatedCases = sortedCases.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const setTablePage = (nextPage: number | ((page: number) => number)) => {
    setRequestedTablePage((current) => {
      const page = current.key === tableResetKey ? current.page : 1;
      return {
        key: tableResetKey,
        page: typeof nextPage === "function" ? nextPage(page) : nextPage,
      };
    });
  };

  return (
    <section className="panel table-panel cases-view">
      <div className="table-toolbar">
        <label className="table-search">
          <Search size={16} />
          <input
           
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Search case number, doctor or patient ref")}
          />
        </label>
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value as "active" | "archived")}
          aria-label={t("Active cases")}
        >
          <option value="active">{t("Active cases")}</option>
          <option value="archived">{t("Archived cases")}</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as "All" | DisplayCaseStatus)}
          aria-label={t("Status")}
        >
          <option value="All">{t("All")}</option>
          {DISPLAY_CASE_STATUSES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <label className="sort-control">
          <ArrowUpDown size={15} />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as typeof sort)}
            aria-label={t("Cases")}
          >
            <option value="received-new">{t("Received: newest")}</option>
            <option value="received-old">{t("Received: oldest")}</option>
            <option value="due-soon">{t("Due: soonest")}</option>
            <option value="due-late">{t("Due: latest")}</option>
            <option value="priority">{t("Priority: rush first")}</option>
            {canViewValue && <option value="value">{t("Value: highest")}</option>}
          </select>
        </label>
        <div className="segmented case-ownership-toggle" aria-label="Case list scope">
          <button
            type="button"
            className={caseOwnership === "all" ? "active" : ""}
            onClick={() => setCaseOwnership("all")}
          >
            <UsersRound size={15} />
            {t("All cases")}
          </button>
          <button
            type="button"
            className={caseOwnership === "mine" ? "active" : ""}
            onClick={() => setCaseOwnership("mine")}
          >
            <UserRoundCog size={15} />
            {t("My cases")}
          </button>
        </div>
        {canCreate && (
          <button className="primary-button" type="button" onClick={onNew}>
            <Plus size={17} />
            {t("New case")}
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table className="case-table">
          <thead>
            <tr>
              <th>{t("Case")}</th>
              <th>{t("Doctor")}</th>
              <th>{t("Patient")}</th>
              <th>{t("Service")}</th>
              <th className="impression-column">{t("Impression")}</th>
              <th>{t("Due")}</th>
              <th className="status-column">{t("Status")}</th>
              <th>{t("Assigned")}</th>
              {canViewValue && <th className="number">{t("Value")}</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedCases.map((item) => {
              const doctor = data.doctors.find(
                (entry) => entry.id === item.doctorId,
              );
              const staff = data.staff.find(
                (entry) => entry.id === item.assignedTo,
              );
              const overdue = isCaseOverdue(item);
              return (
                <tr
                  className={`${highlightedCaseId === item.id ? "just-created" : ""} ${overdue ? "overdue-case" : ""} ${item.onHold ? "on-hold-case" : ""}`}
                  key={item.id}
                  onClick={() => onOpen(item.id)}
                >
                  <td className="status-column">
                    <strong>{item.caseNumber}</strong>
                    <small>
                      {item.archived
                        ? t("Archived")
                        : `${t("Received")} ${formatDate(item.receivedDate, { day: "2-digit", month: "short" })}`}
                    </small>
                  </td>
                  <td>
                    <span className="case-table-ellipsis" title={doctor?.name}>
                      {doctor?.name}
                    </span>
                  </td>
                  <td>
                    <strong className="case-table-ellipsis" title={item.patient}>{item.patient}</strong>
                  </td>
                  <td>
                    <span className="case-table-ellipsis" title={caseServiceLines(item).map((line) => line.service).join(", ")}>{caseServiceLines(item)[0].service}</span>
                    {caseServiceLines(item).length > 1 && (
                      <small>+{caseServiceLines(item).length - 1} {t("more")}</small>
                    )}
                    <small>{caseTotalUnits(item)} {t("total units")}</small>
                  </td>
                  <td className="impression-column">
                    <ImpressionBadge type={item.impressionType} />
                  </td>
                  <td className={overdue ? "late" : ""}>
                    {formatDate(item.dueDate, {
                      day: "2-digit",
                      month: "short",
                    })}
                    <small>
                      {item.dueTime}
                      {overdue ? ` · ${t("Overdue")}` : ""}
                    </small>
                  </td>
                  <td className="status-column">
                    <div className="case-status-line">
                      <StatusBadge status={displayCaseStatus(item)} />
                      <span className="case-priority-tags">
                        <CaseTags labCase={item} />
                      </span>
                    </div>
                    {item.archived && (
                      <small className="archive-label">Archived</small>
                    )}
                  </td>
                  <td>
                    <span className="assigned">
                      <Avatar member={staff} small />
                      <span className="case-table-ellipsis" title={staff?.name ?? t("Unassigned")}>{staff?.name ?? t("Unassigned")}</span>
                    </span>
                  </td>
                  {canViewValue && (
                    <td className="number">
                      <strong>{money(item.price, data.currency)}</strong>
                      <small>
                        {money(item.price - item.paid, data.currency)} due
                      </small>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!sortedCases.length && (
          <div className="empty-table">
            <Search size={25} />
            <h3>{caseOwnership === "mine" ? t("No cases assigned to you") : t("No matching cases")}</h3>
            <p>{caseOwnership === "mine" ? t("Switch to All cases to view the wider lab queue.") : t("Try another case number, doctor, or status.")}</p>
          </div>
        )}
      </div>
      {sortedCases.length > pageSize && (
        <footer className="case-table-pagination">
          <small>
            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedCases.length)} of {sortedCases.length} cases
          </small>
          <div>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => setTablePage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
            >
              {t("Previous")}
            </button>
            <span>{t("Page")} {currentPage} {t("of")} {pageCount}</span>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => setTablePage((page) => Math.min(pageCount, page + 1))}
              disabled={currentPage === pageCount}
            >
              {t("Next")}
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}

export function ScheduleView({
  data,
  weekOffset,
  setWeekOffset,
  onOpen,
}: {
  data: OraData;
  weekOffset: number;
  setWeekOffset: (value: number) => void;
  onOpen: (id: string) => void;
}) {
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() + weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  return (
    <div className="schedule-layout">
      <section className="panel schedule-panel">
        <div className="schedule-toolbar">
          <div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setWeekOffset(weekOffset - 1)}
              aria-label="Previous week"
            >
              <ChevronRight className="flip" size={18} />
            </button>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => setWeekOffset(0)}
            >
              Today
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => setWeekOffset(weekOffset + 1)}
              aria-label="Next week"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <h2>
            {formatDate(toISODate(start), { day: "2-digit", month: "short" })} –{" "}
            {formatDate(toISODate(days[6]), {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </h2>
        </div>
        <div className="week-grid">
          {days.map((day) => {
            const iso = toISODate(day);
            const items = data.cases
              .filter(
                (item) =>
                  !item.archived &&
                  item.dueDate === iso &&
                  item.status !== "Closed",
              )
              .sort((a, b) => a.dueTime.localeCompare(b.dueTime));
            const isToday = iso === toISODate(new Date());
            return (
              <div className={`day-column ${isToday ? "today" : ""}`} key={iso}>
                <header>
                  <span>
                    {day.toLocaleDateString("en-US", { weekday: "short" })}
                  </span>
                  <strong>{day.getDate()}</strong>
                  <small>{items.length} due</small>
                </header>
                <div>
                  {items.map((item) => {
                    const doctor = data.doctors.find(
                      (entry) => entry.id === item.doctorId,
                    );
                    const staff = data.staff.find(
                      (entry) => entry.id === item.assignedTo,
                    );
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={`schedule-case ${caseTags(item).includes("Rush") ? "rush" : ""} ${isCaseOverdue(item) ? "overdue-case" : ""} ${item.onHold ? "on-hold-case" : ""}`}
                        onClick={() => onOpen(item.id)}
                      >
                        <span className="schedule-case-header">
                          <strong>
                            {item.caseNumber} · {item.dueTime}
                          </strong>
                          <span className="schedule-case-status">
                            <StatusBadge status={displayCaseStatus(item)} />
                          </span>
                        </span>
                        <p className="schedule-case-doctor">
                          <span>{doctor?.name}</span>
                          <ImpressionBadge type={item.impressionType} />
                          <span className="schedule-priority-tags">
                            <CaseTags labCase={item} />
                          </span>
                        </p>
                        <small>
                          <Avatar member={staff} small />
                          {staff?.name ?? "Unassigned"} · {caseTotalUnits(item)}
                          u
                        </small>
                      </button>
                    );
                  })}
                  {!items.length && (
                    <span className="day-empty">Open capacity</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <aside className="panel workload-panel">
        <div className="panel-heading">
          <div>
            <span>This week</span>
            <h3>Team workload</h3>
          </div>
          <UsersRound size={18} />
        </div>
        {data.staff
          .filter(
            (member) =>
              member.active !== false &&
              memberSpecialties(data, member).length > 0,
          )
          .map((member) => {
            const count = data.cases.filter(
              (item) =>
                !item.archived &&
                item.assignedTo === member.id &&
                item.dueDate >= toISODate(start) &&
                item.dueDate <= toISODate(days[6]) &&
                item.status !== "Closed",
            ).length;
            return (
              <div className="workload-row" key={member.id}>
                <Avatar member={member} />
                <span>
                  <strong>{member.name}</strong>
                  <small>{member.role}</small>
                </span>
                <div>
                  <b>{count}</b>
                  <small>cases</small>
                </div>
              </div>
            );
          })}
        <div className="schedule-note">
          <MessageSquareText size={18} />
          <p>
            Scheduling is internal to Ora staff. Doctors and patients do not see
            this workspace.
          </p>
        </div>
      </aside>
    </div>
  );
}

export function LegacyDeliveryView({
  data,
  onOpen,
}: {
  data: OraData;
  onOpen: (id: string) => void;
}) {
  const incoming = data.cases
    .filter((item) => deliveryQueue(item) === "pickup")
    .sort((first, second) =>
      `${first.appointmentDate ?? first.dueDate}${first.appointmentTime ?? first.dueTime}`.localeCompare(
        `${second.appointmentDate ?? second.dueDate}${second.appointmentTime ?? second.dueTime}`,
      ),
    );
  const outgoing = data.cases
    .filter((item) => deliveryQueue(item) === "delivery")
    .sort((first, second) =>
      `${first.appointmentDate ?? first.dueDate}${first.appointmentTime ?? first.dueTime}`.localeCompare(
        `${second.appointmentDate ?? second.dueDate}${second.appointmentTime ?? second.dueTime}`,
      ),
    );
  const appointment = (labCase: LabCase) =>
    `${formatDate(labCase.appointmentDate ?? labCase.dueDate, { day: "2-digit", month: "short", year: "numeric" })} at ${labCase.appointmentTime ?? labCase.dueTime}`;
  const queueMarkup = (type: "in" | "out", cases: LabCase[]) => (
    <section className={`delivery-queue ${type}`}>
      <header>
        <span className="delivery-queue-icon">
          {type === "in" ? <PackageCheck size={20} /> : <Truck size={20} />}
        </span>
        <div>
          <small>
            {type === "in" ? "Clinic pickup" : "Finished case delivery"}
          </small>
          <h2>{type === "in" ? "In" : "Out"}</h2>
          <p>
            {type === "in"
              ? "Physical impressions submitted by a doctor portal will appear here for collection."
              : "Closed cases appear here until they are handed to the clinic."}
          </p>
        </div>
        <b>{cases.length}</b>
      </header>
      <div className="delivery-card-list">
        {cases.map((labCase) => {
          const doctor = data.doctors.find(
            (item) => item.id === labCase.doctorId,
          );
          const out = type === "out";
          return (
            <button
              className={`delivery-case-card ${out && labCase.deliveryStatus === "out_for_delivery" ? "en-route" : ""}`}
              type="button"
              key={labCase.id}
              onClick={() => onOpen(labCase.id)}
            >
              <span className="delivery-case-top">
                <strong>Case {labCase.caseNumber}</strong>
                <em>
                  {out
                    ? labCase.deliveryStatus === "out_for_delivery"
                      ? "Out for delivery"
                      : "Ready to deliver"
                    : "Awaiting pickup"}
                </em>
              </span>
              <span className="delivery-case-details">
                <span>
                  <Clock3 size={15} />
                  <i>
                    <small>Doctor&apos;s appointment</small>
                    <strong>{appointment(labCase)}</strong>
                  </i>
                </span>
                <span>
                  <Stethoscope size={15} />
                  <i>
                    <small>Clinic</small>
                    <strong>{doctor?.clinic ?? "Clinic not recorded"}</strong>
                  </i>
                </span>
                <span>
                  <UsersRound size={15} />
                  <i>
                    <small>Patient</small>
                    <strong>
                      {labCase.patient || "Not recorded"}
                    </strong>
                  </i>
                </span>
                <span>
                  <MapPin size={15} />
                  <i>
                    <small>Delivery location</small>
                    <strong>{deliveryLocation(data, labCase)}</strong>
                  </i>
                </span>
              </span>
              <span className="delivery-open">
                Open <ChevronRight size={16} />
              </span>
            </button>
          );
        })}
        {!cases.length && (
          <div className="delivery-empty">
            <CheckCircle2 size={24} />
            <strong>
              {type === "in" ? "No clinic pickups" : "No cases going out"}
            </strong>
            <p>
              {type === "in"
                ? "Doctor-submitted physical impressions will be listed here."
                : "Closed cases waiting for delivery will be listed here."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
  return (
    <div className="delivery-view">
      <section className="delivery-summary">
        <div>
          <span>Delivery board</span>
          <h2>Pickups and deliveries</h2>
          <p>Only active transport tasks are shown here.</p>
        </div>
        <div>
          <span>
            <PackageCheck size={17} />
            {incoming.length} in
          </span>
          <span>
            <Truck size={17} />
            {outgoing.length} out
          </span>
        </div>
      </section>
      <div className="delivery-queues">
        {queueMarkup("in", incoming)}
        {queueMarkup("out", outgoing)}
      </div>
    </div>
  );
}

export function DeliveryView({
  data,
  activeDriverId,
  canAdd,
  canApproveOralScans,
  canAssignDrivers,
  onAdd,
  onOutForPickup,
  onCollect,
  onReceivedAtLab,
  onApproveOralScan,
  onApproveDoctorRequest,
  onAssignDriver,
  onAssignTaskDriver,
  onOutForScan,
  onScanCompleted,
  onOutForDelivery,
  onDelivered,
  onStartTask,
  onCompleteTask,
}: {
  data: OraData;
  activeDriverId?: string;
  canAdd: boolean;
  canApproveOralScans: boolean;
  canAssignDrivers: boolean;
  onAdd: () => void;
  onOutForPickup: (labCase: LabCase) => void;
  onCollect: (labCase: LabCase) => void;
  onReceivedAtLab: (labCase: LabCase) => void;
  onApproveOralScan: (labCase: LabCase) => void;
  onApproveDoctorRequest: (task: DeliveryTask) => void;
  onAssignDriver: (labCase: LabCase, driverId: string) => void;
  onAssignTaskDriver: (task: DeliveryTask, driverId: string) => void;
  onOutForScan: (labCase: LabCase) => void;
  onScanCompleted: (labCase: LabCase) => void;
  onOutForDelivery: (labCase: LabCase) => void;
  onDelivered: (labCase: LabCase) => void;
  onStartTask: (task: DeliveryTask) => void;
  onCompleteTask: (task: DeliveryTask) => void;
}) {
  const [mode, setMode] = useState<"board" | "log">("board");
  const [mobileQueue, setMobileQueue] = useState<
    "pickup" | "delivery" | "oral-scan"
  >("pickup");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(
    null,
  );
  const pickupCases = data.cases.filter(
    (item) => deliveryQueue(item) === "pickup",
  );
  const oralScanCases = data.cases.filter(
    (item) => deliveryQueue(item, canApproveOralScans) === "oral-scan",
  );
  const deliveryCases = data.cases.filter(
    (item) => deliveryQueue(item) === "delivery",
  );
  const pickupTasks = data.deliveryTasks.filter(
    (item) =>
      item.status !== "completed" &&
      item.type === "pickup" &&
      (!item.approvalPending || canApproveOralScans),
  );
  const deliveryTasks = data.deliveryTasks.filter(
    (item) => item.status !== "completed" && item.type === "delivery",
  );
  const oralScanTasks = data.deliveryTasks.filter(
    (item) =>
      item.status !== "completed" &&
      item.type === "oral-scan" &&
      (!item.approvalPending || canApproveOralScans),
  );
  const loggedCases = data.cases.filter((item) =>
    item.history.some((entry) => entry.action === "delivery"),
  );
  const loggedTasks = data.deliveryTasks.filter(
    (item) => item.status === "completed",
  );
  const timestamp = (value?: string) =>
    value ? formatDateTime(value) : "Not recorded";
  const appointment = (labCase: LabCase) =>
    `${formatDate(labCase.appointmentDate ?? labCase.dueDate, { day: "2-digit", month: "short", year: "numeric" })} at ${labCase.appointmentTime ?? labCase.dueTime}`;
  const queueTitle = (labCase: LabCase) => {
    const queue = deliveryQueue(labCase, true);
    return queue === "oral-scan"
      ? "Oral Scan"
      : queue === "pickup"
        ? "Pick up"
        : "Deliver";
  };
  const caseStatus = (labCase: LabCase) => {
    const queue = deliveryQueue(labCase, true);
    return queue === "oral-scan"
      ? labCase.deliveryStatus === "awaiting_scan_approval"
        ? "Awaiting approval"
        : labCase.deliveryStatus === "out_for_scan"
          ? "Out for scan"
          : "Scan appointment"
      : queue === "pickup"
        ? labCase.deliveryStatus === "out_for_pickup"
          ? "Out for pickup"
          : labCase.deliveryStatus === "picked_up"
            ? "Returning to lab"
            : "Ready for pickup"
        : labCase.deliveryStatus === "out_for_delivery"
          ? "Out for delivery"
          : labCase.deliveryStatus === "delivered"
            ? "Delivered"
            : "Ready to deliver";
  };
  const taskLabel = (task: DeliveryTask) =>
    task.type === "pickup"
      ? "Pick Up"
      : task.type === "oral-scan"
        ? "Oral Scan"
        : "Deliver";
  const taskStatus = (task: DeliveryTask) =>
    task.approvalPending
      ? "Awaiting approval"
      : task.type === "pickup" && task.status === "collected"
        ? "Returning to lab"
      : task.status === "out"
        ? task.type === "pickup"
          ? "Out for pickup"
          : task.type === "oral-scan"
            ? "Out for scan"
            : "Out for delivery"
        : task.status === "completed"
          ? task.type === "pickup"
            ? "Arrived at lab"
            : task.type === "oral-scan"
              ? "Scan completed"
              : "Delivered"
          : "Scheduled";
  const deliveryStatusTone = (status: string) =>
    status.toLowerCase().replaceAll(" ", "-");
  const CaseRow = ({
    labCase,
    logged = false,
  }: {
    labCase: LabCase;
    logged?: boolean;
  }) => {
    const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
    const expanded = expandedId === `case-${labCase.id}`;
    const queue = deliveryQueue(labCase, canApproveOralScans);
    const status = caseStatus(labCase);
    const history = labCase.history.filter(
      (entry) => entry.action === "delivery",
    );
    const driver = data.staff.find(
      (item) => item.id === labCase.deliveryAssigneeId,
    );
    const drivers = data.staff.filter(
      (item) => isDeliveryStaff(data, item),
    );
    return (
      <article
        className={`delivery-row ${queue ?? "oral-scan"} ${expanded ? "expanded" : ""} ${logged ? "logged" : ""}`}
      >
        <button
          className="delivery-row-toggle"
          type="button"
          onClick={() => setExpandedId(expanded ? null : `case-${labCase.id}`)}
          aria-expanded={expanded}
        >
          {logged && (
            <span className={`delivery-log-type ${queue ?? "delivery"}`}>
              {queue === "pickup" ? (
                <PackageCheck size={15} />
              ) : queue === "oral-scan" ? (
                <ScanLine size={15} />
              ) : (
                <Truck size={15} />
              )}
            </span>
          )}
          <span>
            <strong>
              {labCase.caseNumber} - {doctor?.name ?? "Doctor not recorded"}
            </strong>
            <small>
              {logged ? "Case delivery record" : queueTitle(labCase)}
            </small>
          </span>
          <span className="delivery-row-driver">
            {driver?.name ?? "Not assigned"}
          </span>
          <em className={`delivery-status ${deliveryStatusTone(status)}`}>
            {status}
          </em>
          <ChevronRight size={17} />
        </button>
        <div className="delivery-expand-shell">
          <div className="delivery-expand-content">
            <div className="delivery-row-details">
              <span>
                <small>Doctor&apos;s appointment</small>
                <strong>{appointment(labCase)}</strong>
              </span>
              <span>
                <small>Clinic</small>
                <strong>{doctor?.clinic ?? "Clinic not recorded"}</strong>
              </span>
              <span>
                <small>Patient</small>
                <strong>{labCase.patient || "Not recorded"}</strong>
              </span>
              <span>
                <small>Delivery location</small>
                <strong>{deliveryLocation(data, labCase)}</strong>
              </span>
              <span>
                <small>Doctor contact</small>
                <strong>{doctor?.phone || "Not recorded"}</strong>
              </span>
              <span className="assigned-driver-card">
                <small>Assigned driver</small>
                {canAssignDrivers && (
                  <select
                    aria-label={`Assign driver for case ${labCase.caseNumber}`}
                    value={labCase.deliveryAssigneeId ?? ""}
                    onChange={(event) => {
                      const nextDriverId = event.target.value;
                      if (nextDriverId) onAssignDriver(labCase, nextDriverId);
                    }}
                  >
                    <option value="">Not assigned</option>
                    {drivers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            </div>
            {logged ? (
              <div className="delivery-timeline">
                <span>
                  <small>Driver assigned</small>
                  <strong>{timestamp(labCase.deliveryAssignedAt)}</strong>
                </span>
                <span>
                  <small>Out for pickup</small>
                  <strong>
                    {timestamp(
                      history.find(
                        (entry) => entry.label === "Marked out for pickup",
                      )?.date,
                    )}
                  </strong>
                </span>
                <span>
                  <small>Picked up</small>
                  <strong>
                    {timestamp(
                      history.find((entry) =>
                        entry.label.includes("Picked up physical"),
                      )?.date,
                    )}
                  </strong>
                </span>
                <span>
                  <small>Arrived at lab</small>
                  <strong>
                    {timestamp(
                      history.find(
                        (entry) =>
                          entry.label ===
                          "Received physical impression at the lab",
                      )?.date,
                    )}
                  </strong>
                </span>
                <span>
                  <small>Out for scan</small>
                  <strong>
                    {timestamp(
                      history.find(
                        (entry) => entry.label === "Marked out for oral scan",
                      )?.date,
                    )}
                  </strong>
                </span>
                <span>
                  <small>Scan completed</small>
                  <strong>
                    {timestamp(
                      history.find(
                        (entry) =>
                          entry.label === "Completed oral scan at the clinic",
                      )?.date,
                    )}
                  </strong>
                </span>
                <span>
                  <small>Out for delivery</small>
                  <strong>
                    {timestamp(
                      history.find(
                        (entry) => entry.label === "Marked out for delivery",
                      )?.date,
                    )}
                  </strong>
                </span>
                <span>
                  <small>Delivered</small>
                  <strong>
                    {timestamp(
                      history.find(
                        (entry) =>
                          entry.label === "Marked delivered to the clinic",
                      )?.date,
                    )}
                  </strong>
                </span>
              </div>
            ) : (
              <div className="delivery-row-actions">
                {queue === "oral-scan" &&
                  labCase.deliveryStatus === "awaiting_scan_approval" &&
                  canApproveOralScans && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onApproveOralScan(labCase)}
                    >
                      <CheckCircle2 size={15} />
                      Approve scan request
                    </button>
                  )}
                {queue === "pickup" &&
                  labCase.deliveryStatus !== "out_for_pickup" && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onOutForPickup(labCase)}
                    >
                      <Truck size={15} />
                      Out for pickup
                    </button>
                  )}
                {queue === "pickup" &&
                  labCase.deliveryStatus === "out_for_pickup" && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onCollect(labCase)}
                    >
                      <PackageCheck size={15} />
                      Picked up
                    </button>
                  )}
                {queue === "pickup" &&
                  labCase.deliveryStatus === "picked_up" && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onReceivedAtLab(labCase)}
                    >
                      <CheckCircle2 size={15} />
                      Arrived at lab
                    </button>
                  )}
                {queue === "oral-scan" &&
                  labCase.deliveryStatus === "awaiting_scan" && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onOutForScan(labCase)}
                    >
                      <ScanLine size={15} />
                      Out for scan
                    </button>
                  )}
                {queue === "oral-scan" &&
                  labCase.deliveryStatus === "out_for_scan" && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onScanCompleted(labCase)}
                    >
                      <CheckCircle2 size={15} />
                      Scan completed
                    </button>
                  )}
                {queue === "delivery" &&
                  labCase.deliveryStatus !== "out_for_delivery" && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onOutForDelivery(labCase)}
                    >
                      <Truck size={15} />
                      Out for delivery
                    </button>
                  )}
                {queue === "delivery" &&
                  labCase.deliveryStatus === "out_for_delivery" && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onDelivered(labCase)}
                    >
                      <CheckCircle2 size={15} />
                      Delivered
                    </button>
                  )}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };
  const TaskRow = ({
    task,
    logged = false,
  }: {
    task: DeliveryTask;
    logged?: boolean;
  }) => {
    const expanded = expandedId === `task-${task.id}`;
    const driver = data.staff.find((item) => item.id === task.assignedTo);
    const drivers = data.staff.filter(
      (item) => isDeliveryStaff(data, item),
    );
    const status = taskStatus(task);
    return (
      <article
        className={`delivery-row task-row ${expanded ? "expanded" : ""} ${logged ? "logged" : ""}`}
      >
        <button
          className="delivery-row-toggle"
          type="button"
          onClick={() => setExpandedId(expanded ? null : `task-${task.id}`)}
          aria-expanded={expanded}
        >
          {logged && (
            <span className={`delivery-log-type ${task.type}`}>
              {task.type === "pickup" ? (
                <PackageCheck size={15} />
              ) : task.type === "oral-scan" ? (
                <ScanLine size={15} />
              ) : (
                <Truck size={15} />
              )}
            </span>
          )}
          <span>
            <strong>
              {taskLabel(task)} - {task.doctorLabel}
            </strong>
            <small>
              {task.approvalPending
                ? "Doctor portal request"
                : "Manual trip task"}
            </small>
          </span>
          <span className="delivery-row-driver">
            {driver?.name ?? "Not assigned"}
          </span>
          <em className={`delivery-status ${deliveryStatusTone(status)}`}>
            {status}
          </em>
          <ChevronRight size={17} />
        </button>
        <div className="delivery-expand-shell">
          <div className="delivery-expand-content">
            <div className="delivery-row-details">
              <span>
                <small>Schedule</small>
                <strong>
                  {task.isAsap
                    ? "As soon as possible"
                    : `${formatDate(task.scheduledDate, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })} at ${task.scheduledTime}`}
                </strong>
              </span>
              <span>
                <small>Address</small>
                <strong>{task.address}</strong>
              </span>
              <span>
                <small>Contact details</small>
                <strong>{task.contactDetails}</strong>
              </span>
              <span className="assigned-driver-card">
                <small>Assigned driver</small>
                {canAssignDrivers && (
                  <select
                    aria-label={`Assign driver for ${taskLabel(task)} request`}
                    value={task.assignedTo ?? ""}
                    onChange={(event) => {
                      const nextDriverId = event.target.value;
                      if (nextDriverId) onAssignTaskDriver(task, nextDriverId);
                    }}
                  >
                    <option value="">Not assigned</option>
                    {drivers.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            </div>
            {logged ? (
              <div className="delivery-timeline">
                <span>
                  <small>Driver assigned</small>
                  <strong>{timestamp(task.assignedAt)}</strong>
                </span>
                <span>
                  <small>
                    {task.type === "pickup"
                      ? "Out for pickup"
                      : task.type === "oral-scan"
                        ? "Out for scan"
                        : "Out for delivery"}
                  </small>
                  <strong>{timestamp(task.outAt)}</strong>
                </span>
                {task.type === "pickup" && (
                  <span>
                    <small>Picked up</small>
                    <strong>{timestamp(task.collectedAt)}</strong>
                  </span>
                )}
                <span>
                  <small>
                    {task.type === "pickup"
                      ? "Arrived at lab"
                      : task.type === "oral-scan"
                        ? "Scan completed"
                        : "Delivered"}
                  </small>
                  <strong>{timestamp(task.completedAt)}</strong>
                </span>
              </div>
            ) : (
              <div className="delivery-row-actions">
                {task.approvalPending && canApproveOralScans && (
                  <button
                    className="primary-button compact"
                    type="button"
                    onClick={() => onApproveDoctorRequest(task)}
                  >
                    <CheckCircle2 size={15} />
                    Approve request
                  </button>
                )}
                {!task.approvalPending && task.status === "scheduled" && (
                  <button
                    className="primary-button compact"
                    type="button"
                    onClick={() => onStartTask(task)}
                  >
                    {task.type === "oral-scan" ? (
                      <ScanLine size={15} />
                    ) : (
                      <Truck size={15} />
                    )}
                    {task.type === "pickup"
                      ? "Out for pickup"
                      : task.type === "oral-scan"
                        ? "Out for scan"
                        : "Out for delivery"}
                  </button>
                )}
                {!task.approvalPending && task.status === "out" && (
                  <button
                    className="primary-button compact"
                    type="button"
                    onClick={() => onCompleteTask(task)}
                  >
                    <CheckCircle2 size={15} />
                    {task.type === "pickup"
                      ? "Picked up"
                      : task.type === "oral-scan"
                        ? "Scan completed"
                        : "Delivered"}
                  </button>
                )}
                {!task.approvalPending &&
                  task.type === "pickup" &&
                  task.status === "collected" && (
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={() => onCompleteTask(task)}
                    >
                      <CheckCircle2 size={15} />
                      Arrived at lab
                    </button>
                  )}
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };
  const renderQueue = ({
    title,
    type,
    cases,
    tasks = [],
  }: {
    title: "Pick Up" | "Oral Scan" | "Deliver";
    type: "pickup" | "oral-scan" | "delivery";
    cases: LabCase[];
    tasks?: DeliveryTask[];
  }) => (
    <section
      className={`delivery-queue ${type} ${mobileQueue === type ? "mobile-queue-active" : "mobile-queue-hidden"}`}
    >
      <header>
        <span className="delivery-queue-icon">
          {type === "pickup" ? (
            <PackageCheck size={21} />
          ) : type === "oral-scan" ? (
            <ScanLine size={21} />
          ) : (
            <Truck size={21} />
          )}
        </span>
        <h2>{title}</h2>
        <b>{cases.length + tasks.length}</b>
      </header>
      <div className="delivery-row-list">
        {cases.map((labCase) => (
          <CaseRow key={labCase.id} labCase={labCase} />
        ))}
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}
        {!cases.length && !tasks.length && (
          <div className="delivery-empty">
            <CheckCircle2 size={24} />
            <strong>
              No active{" "}
              {title === "Oral Scan" ? "oral scan" : title.toLowerCase()} tasks
            </strong>
          </div>
        )}
      </div>
    </section>
  );
  const renderDriverWorkload = () => {
    const drivers = data.staff.filter((member) =>
      isDeliveryStaff(data, member),
    );
    const caseTripType = (labCase: LabCase): DeliveryTask["type"] => {
      const currentQueue = deliveryQueue(labCase, true);
      if (currentQueue) return currentQueue;
      if (
        [
          "awaiting_pickup",
          "out_for_pickup",
          "picked_up",
          "received_at_lab",
        ].includes(
          labCase.deliveryStatus ?? "",
        )
      )
        return "pickup";
      if (
        [
          "awaiting_scan_approval",
          "awaiting_scan",
          "out_for_scan",
          "scanned",
        ].includes(labCase.deliveryStatus ?? "")
      )
        return "oral-scan";
      return "delivery";
    };
    const caseProgress = (labCase: LabCase) => {
      if (caseTripType(labCase) === "pickup")
        return labCase.deliveryStatus === "received_at_lab"
          ? 4
          : labCase.deliveryStatus === "picked_up"
            ? 3
            : labCase.deliveryStatus === "out_for_pickup"
              ? 2
              : 1;
      return ["scanned", "delivered"].includes(
        labCase.deliveryStatus ?? "",
      )
        ? 3
        : ["out_for_scan", "out_for_delivery"].includes(
              labCase.deliveryStatus ?? "",
            )
          ? 2
          : 1;
    };
    const caseProgressLabel = (labCase: LabCase) => {
      const type = caseTripType(labCase);
      const progress = caseProgress(labCase);
      if (progress === 1) return "Assigned";
      if (progress === 2)
        return type === "pickup"
          ? "Out for pickup"
          : type === "oral-scan"
            ? "Out for scan"
            : "Out for delivery";
      if (type === "pickup" && progress === 3) return "Returning to lab";
      return type === "pickup"
        ? "Arrived at lab"
        : type === "oral-scan"
          ? "Scan completed"
          : "Delivered";
    };
    return (
      <section className="driver-workload-panel">
        <header>
          <div>
            <span>Driver workload</span>
            <h2>Assigned tasks and progress</h2>
          </div>
          <UsersRound size={19} />
        </header>
        <div className="driver-workload-list">
          {drivers.map((driver) => {
            const caseRecords = data.cases
              .filter(
                (labCase) =>
                  labCase.deliveryAssigneeId === driver.id &&
                  (Boolean(deliveryQueue(labCase, true)) ||
                    labCase.history.some(
                      (entry) => entry.action === "delivery",
                    )),
              )
              .map((labCase) => {
                const doctor = data.doctors.find(
                  (item) => item.id === labCase.doctorId,
                );
                return {
                  id: `case-${labCase.id}`,
                  title: `Case ${labCase.caseNumber} - ${doctor?.name ?? "Doctor not recorded"}`,
                  subtitle: undefined,
                  type: caseTripType(labCase),
                  schedule: appointment(labCase),
                  progress: caseProgress(labCase),
                  status: caseProgressLabel(labCase),
                  steps:
                    caseTripType(labCase) === "pickup"
                      ? ["Assigned", "Out for pickup", "Picked up", "At lab"]
                      : caseTripType(labCase) === "oral-scan"
                        ? ["Assigned", "Out for scan", "Completed"]
                        : ["Assigned", "Out for delivery", "Completed"],
                };
              });
            const taskRecords = data.deliveryTasks
              .filter((task) => task.assignedTo === driver.id)
              .map((task) => ({
                id: `task-${task.id}`,
                title: task.doctorLabel,
                subtitle: undefined,
                type: task.type,
                schedule: task.isAsap
                  ? "As soon as possible"
                  : `${formatDate(task.scheduledDate, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })} at ${task.scheduledTime}`,
                progress:
                  task.type === "pickup"
                    ? task.status === "completed"
                      ? 4
                      : task.status === "collected"
                        ? 3
                        : task.status === "out"
                          ? 2
                          : 1
                    : task.status === "completed"
                      ? 3
                      : task.status === "out"
                        ? 2
                        : 1,
                status: taskStatus(task),
                steps:
                  task.type === "pickup"
                    ? ["Assigned", "Out for pickup", "Picked up", "At lab"]
                    : task.type === "oral-scan"
                      ? ["Assigned", "Out for scan", "Completed"]
                      : ["Assigned", "Out for delivery", "Completed"],
              }));
            const records = [...caseRecords, ...taskRecords].sort(
              (first, second) => {
                const priority = (record: {
                  progress: number;
                  steps: string[];
                }) =>
                  record.progress > 1 && record.progress < record.steps.length
                    ? 0
                    : record.progress === 1
                      ? 1
                      : 2;
                return priority(first) - priority(second);
              },
            );
            const active = records.filter(
              (record) => record.progress < record.steps.length,
            ).length;
            const inProgress = records.filter(
              (record) =>
                record.progress > 1 && record.progress < record.steps.length,
            ).length;
            const completed = records.filter(
              (record) => record.progress === record.steps.length,
            ).length;
            const expanded = expandedDriverId === driver.id;
            return (
              <article
                className={`driver-workload-row ${expanded ? "expanded" : ""}`}
                key={driver.id}
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDriverId(expanded ? null : driver.id)
                  }
                  aria-expanded={expanded}
                >
                  <Avatar member={driver} />
                  <span className="driver-workload-name">
                    <strong>{driver.name}</strong>
                    <small>{driver.phone || "No phone recorded"}</small>
                  </span>
                  <span className="driver-workload-metrics">
                    <i>
                      <strong>{active}</strong>
                      <small>Active</small>
                    </i>
                    <i className={inProgress ? "moving" : ""}>
                      <strong>{inProgress}</strong>
                      <small>In progress</small>
                    </i>
                    <i>
                      <strong>{completed}</strong>
                      <small>Completed</small>
                    </i>
                  </span>
                  <ChevronRight size={18} />
                </button>
                <div className="driver-workload-expand">
                  <div>
                    {records.map((record) => (
                      <div className="driver-progress-record" key={record.id}>
                        <span
                          className={`driver-progress-type ${record.type}`}
                        >
                          {record.type === "pickup" ? (
                            <PackageCheck size={16} />
                          ) : record.type === "oral-scan" ? (
                            <ScanLine size={16} />
                          ) : (
                            <Truck size={16} />
                          )}
                        </span>
                        <span className="driver-progress-copy">
                          <strong>{record.title}</strong>
                          {record.subtitle && <small>{record.subtitle}</small>}
                        </span>
                        <span className="driver-progress-schedule">
                          <small>Schedule</small>
                          <strong>{record.schedule}</strong>
                        </span>
                        <div
                          className={`driver-progress-track steps-${record.steps.length}`}
                          aria-label={`${record.status}: step ${record.progress} of ${record.steps.length}`}
                        >
                          {record.steps.map(
                            (step, index) => (
                              <span
                                className={
                                  index + 1 < record.progress
                                    ? "done"
                                    : index + 1 === record.progress
                                      ? "current"
                                      : ""
                                }
                                key={step}
                              >
                                <i>
                                  {index + 1 < record.progress ? (
                                    <Check size={10} />
                                  ) : (
                                    index + 1
                                  )}
                                </i>
                                <small>{step}</small>
                              </span>
                            ),
                          )}
                        </div>
                        <em
                          className={
                            record.progress === record.steps.length
                              ? "complete"
                              : record.progress > 1
                                ? "moving"
                                : ""
                          }
                        >
                          {record.status}
                        </em>
                      </div>
                    ))}
                    {!records.length && (
                      <div className="driver-workload-empty">
                        No tasks have been assigned to {driver.name} yet.
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {!drivers.length && (
            <div className="driver-workload-empty">
              No active delivery employees were found.
            </div>
          )}
        </div>
      </section>
    );
  };
  const DriverCaseCard = ({ labCase }: { labCase: LabCase }) => {
    const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
    const queue = deliveryQueue(labCase);
    if (!queue) return null;
    const status = caseStatus(labCase);
    const inProgress =
      labCase.deliveryStatus === "out_for_pickup" ||
      labCase.deliveryStatus === "picked_up" ||
      labCase.deliveryStatus === "out_for_scan" ||
      labCase.deliveryStatus === "out_for_delivery";
    return (
      <article
        className={`driver-assignment-card ${queue} ${inProgress ? "in-progress" : ""}`}
      >
        <header>
          <span className="driver-assignment-icon">
            {queue === "pickup" ? (
              <PackageCheck size={20} />
            ) : queue === "oral-scan" ? (
              <ScanLine size={20} />
            ) : (
              <Truck size={20} />
            )}
          </span>
          <div>
            <small>{queueTitle(labCase)}</small>
            <strong>Case {labCase.caseNumber}</strong>
            <p>{doctor?.name ?? "Doctor not recorded"}</p>
          </div>
          <em>{status}</em>
        </header>
        <div className="driver-assignment-details">
          <span>
            <Clock3 size={16} />
            <i>
              <small>Appointment</small>
              <strong>{appointment(labCase)}</strong>
            </i>
          </span>
          <span>
            <MapPin size={16} />
            <i>
              <small>Destination</small>
              <strong>{deliveryLocation(data, labCase)}</strong>
            </i>
          </span>
          <span>
            <Stethoscope size={16} />
            <i>
              <small>Contact</small>
              <strong>{doctor?.phone || "Not recorded"}</strong>
            </i>
          </span>
        </div>
        <footer>
          {queue === "pickup" && (
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                labCase.deliveryStatus === "picked_up"
                  ? onReceivedAtLab(labCase)
                  : labCase.deliveryStatus === "out_for_pickup"
                    ? onCollect(labCase)
                    : onOutForPickup(labCase)
              }
            >
              {labCase.deliveryStatus === "picked_up" ? (
                <CheckCircle2 size={17} />
              ) : labCase.deliveryStatus === "out_for_pickup" ? (
                <PackageCheck size={17} />
              ) : (
                <Truck size={17} />
              )}
              {labCase.deliveryStatus === "picked_up"
                ? "Arrived at lab"
                : labCase.deliveryStatus === "out_for_pickup"
                  ? "Picked up"
                  : "Out for pickup"}
            </button>
          )}
          {queue === "oral-scan" && (
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                labCase.deliveryStatus === "out_for_scan"
                  ? onScanCompleted(labCase)
                  : onOutForScan(labCase)
              }
            >
              {labCase.deliveryStatus === "out_for_scan" ? (
                <CheckCircle2 size={17} />
              ) : (
                <ScanLine size={17} />
              )}
              {labCase.deliveryStatus === "out_for_scan"
                ? "Scan completed"
                : "Out for scan"}
            </button>
          )}
          {queue === "delivery" && (
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                labCase.deliveryStatus === "out_for_delivery"
                  ? onDelivered(labCase)
                  : onOutForDelivery(labCase)
              }
            >
              {labCase.deliveryStatus === "out_for_delivery" ? (
                <CheckCircle2 size={17} />
              ) : (
                <Truck size={17} />
              )}
              {labCase.deliveryStatus === "out_for_delivery"
                ? "Delivered"
                : "Out for delivery"}
            </button>
          )}
        </footer>
      </article>
    );
  };
  const DriverTaskCard = ({ task }: { task: DeliveryTask }) => {
    const inProgress = task.status === "out" || task.status === "collected";
    return (
      <article
        className={`driver-assignment-card ${task.type} ${inProgress ? "in-progress" : ""}`}
      >
        <header>
          <span className="driver-assignment-icon">
            {task.type === "pickup" ? (
              <PackageCheck size={20} />
            ) : task.type === "oral-scan" ? (
              <ScanLine size={20} />
            ) : (
              <Truck size={20} />
            )}
          </span>
          <div>
            <small>{taskLabel(task)}</small>
            <strong>{task.doctorLabel}</strong>
            <p>Independent trip request</p>
          </div>
          <em>{taskStatus(task)}</em>
        </header>
        <div className="driver-assignment-details">
          <span>
            <Clock3 size={16} />
            <i>
              <small>Schedule</small>
              <strong>
                {task.isAsap
                  ? "As soon as possible"
                  : `${formatDate(task.scheduledDate, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })} at ${task.scheduledTime}`}
              </strong>
            </i>
          </span>
          <span>
            <MapPin size={16} />
            <i>
              <small>Destination</small>
              <strong>{task.address}</strong>
            </i>
          </span>
          <span>
            <Stethoscope size={16} />
            <i>
              <small>Contact</small>
              <strong>{task.contactDetails}</strong>
            </i>
          </span>
        </div>
        <footer>
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              task.status === "scheduled"
                ? onStartTask(task)
                : onCompleteTask(task)
            }
          >
            {task.status === "out" || task.status === "collected" ? (
              <CheckCircle2 size={17} />
            ) : task.type === "oral-scan" ? (
              <ScanLine size={17} />
            ) : (
              <Truck size={17} />
            )}
            {task.status === "collected"
              ? "Arrived at lab"
              : task.status === "out"
                ? task.type === "pickup"
                  ? "Picked up"
                  : task.type === "oral-scan"
                    ? "Scan completed"
                    : "Delivered"
              : task.type === "pickup"
                ? "Out for pickup"
                : task.type === "oral-scan"
                  ? "Out for scan"
                  : "Out for delivery"}
          </button>
        </footer>
      </article>
    );
  };
  if (activeDriverId) {
    const driver = data.staff.find((item) => item.id === activeDriverId);
    const assignedCases = [
      ...pickupCases,
      ...deliveryCases,
      ...oralScanCases,
    ].filter((labCase) => labCase.deliveryAssigneeId === activeDriverId);
    const assignedTasks = [
      ...pickupTasks,
      ...deliveryTasks,
      ...oralScanTasks,
    ].filter((task) => task.assignedTo === activeDriverId);
    const inProgressCount =
      assignedCases.filter((labCase) =>
        [
          "out_for_pickup",
          "picked_up",
          "out_for_scan",
          "out_for_delivery",
        ].includes(
          labCase.deliveryStatus ?? "",
        ),
      ).length +
      assignedTasks.filter(
        (task) => task.status === "out" || task.status === "collected",
      ).length;
    const totalAssignments = assignedCases.length + assignedTasks.length;
    return (
      <div className="delivery-view driver-delivery-view">
        <section className="driver-delivery-summary">
          <div>
            <span>My deliveries</span>
            <h2>{driver?.name ?? "Driver"}&apos;s assigned trips</h2>
            <p>Only the trips assigned to you are shown here.</p>
          </div>
          <div className="driver-delivery-counts">
            <span>
              <strong>{totalAssignments}</strong>
              <small>Assigned</small>
            </span>
            <span className={inProgressCount ? "active" : ""}>
              <strong>{inProgressCount}</strong>
              <small>In progress</small>
            </span>
          </div>
        </section>
        <section className="driver-assignment-list">
          {assignedCases
            .sort(
              (first, second) =>
                Number(
                  ![
                    "out_for_pickup",
                    "picked_up",
                    "out_for_scan",
                    "out_for_delivery",
                  ].includes(first.deliveryStatus ?? ""),
                ) -
                Number(
                  ![
                    "out_for_pickup",
                    "picked_up",
                    "out_for_scan",
                    "out_for_delivery",
                  ].includes(second.deliveryStatus ?? ""),
                ),
            )
            .map((labCase) => (
              <DriverCaseCard key={labCase.id} labCase={labCase} />
            ))}
          {assignedTasks
            .sort(
              (first, second) =>
                Number(
                  second.status === "out" || second.status === "collected",
                ) -
                Number(
                  first.status === "out" || first.status === "collected",
                ),
            )
            .map((task) => (
              <DriverTaskCard key={task.id} task={task} />
            ))}
          {!totalAssignments && (
            <div className="driver-delivery-empty">
              <CheckCircle2 size={30} />
              <strong>No active trips assigned</strong>
              <p>New work will appear here after a dispatcher assigns it.</p>
            </div>
          )}
        </section>
      </div>
    );
  }
  return (
    <div className="delivery-view">
      <section className="delivery-summary">
        <div>
          <span>Delivery board</span>
          <h2>
            {mode === "board"
              ? "Pickups, scans and deliveries"
              : "Delivery log"}
          </h2>
        </div>
        <div>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() =>
              setMode((current) => (current === "board" ? "log" : "board"))
            }
          >
            <History size={15} />
            {mode === "board" ? "Log" : "Active tasks"}
          </button>
          {canAdd && (
            <button
              className="primary-button compact"
              type="button"
              onClick={onAdd}
            >
              <Plus size={16} />
              Add delivery
            </button>
          )}
        </div>
      </section>
      {mode === "board" ? (
        <>
          <div className="delivery-mobile-switch" role="tablist" aria-label="Delivery task type">
            <button
              type="button"
              className={mobileQueue === "pickup" ? "active pickup" : "pickup"}
              onClick={() => setMobileQueue("pickup")}
              role="tab"
              aria-selected={mobileQueue === "pickup"}
            >
              <PackageCheck size={17} />
              <span>Pick Up</span>
              <b>{pickupCases.length + pickupTasks.length}</b>
            </button>
            <button
              type="button"
              className={mobileQueue === "delivery" ? "active delivery" : "delivery"}
              onClick={() => setMobileQueue("delivery")}
              role="tab"
              aria-selected={mobileQueue === "delivery"}
            >
              <Truck size={17} />
              <span>Deliver</span>
              <b>{deliveryCases.length + deliveryTasks.length}</b>
            </button>
            <button
              type="button"
              className={mobileQueue === "oral-scan" ? "active oral-scan" : "oral-scan"}
              onClick={() => setMobileQueue("oral-scan")}
              role="tab"
              aria-selected={mobileQueue === "oral-scan"}
            >
              <ScanLine size={17} />
              <span>Oral Scan</span>
              <b>{oralScanCases.length + oralScanTasks.length}</b>
            </button>
          </div>
          <div className="delivery-queues">
            {renderQueue({
              title: "Pick Up",
              type: "pickup",
              cases: pickupCases,
              tasks: pickupTasks,
            })}
            {renderQueue({
              title: "Deliver",
              type: "delivery",
              cases: deliveryCases,
              tasks: deliveryTasks,
            })}
            {renderQueue({
              title: "Oral Scan",
              type: "oral-scan",
              cases: oralScanCases,
              tasks: oralScanTasks,
            })}
          </div>
          {canAssignDrivers && renderDriverWorkload()}
        </>
      ) : (
        <section className="delivery-log panel">
          <div className="panel-heading">
            <div>
              <span>Completed records</span>
              <h3>Pickups, scans and deliveries</h3>
            </div>
            <History size={18} />
          </div>
          <div className="delivery-row-list">
            {[...loggedCases]
              .sort((first, second) =>
                second.receivedDate.localeCompare(first.receivedDate),
              )
              .map((labCase) => (
                <CaseRow key={labCase.id} labCase={labCase} logged />
              ))}
            {[...loggedTasks]
              .sort((first, second) =>
                (second.completedAt ?? "").localeCompare(
                  first.completedAt ?? "",
                ),
              )
              .map((task) => (
                <TaskRow key={task.id} task={task} logged />
              ))}
            {!loggedCases.length && !loggedTasks.length && (
              <div className="delivery-empty">
                <History size={24} />
                <strong>No completed delivery records</strong>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export function LegacyDeliveryCaseModal({
  data,
  labCase,
  onClose,
  onCollect,
  onOutForDelivery,
  onDelivered,
}: {
  data: OraData;
  labCase: LabCase;
  onClose: () => void;
  onCollect: (labCase: LabCase) => void;
  onOutForDelivery: (labCase: LabCase) => void;
  onDelivered: (labCase: LabCase) => void;
}) {
  const type = deliveryQueue(labCase);
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  const appointment = `${formatDate(labCase.appointmentDate ?? labCase.dueDate, { day: "2-digit", month: "short", year: "numeric" })} at ${labCase.appointmentTime ?? labCase.dueTime}`;
  const isOut = type === "delivery";
  const status: DeliveryStatus =
    labCase.deliveryStatus ?? (isOut ? "ready" : "awaiting_pickup");
  return (
    <Modal
      title={`Delivery · ${labCase.caseNumber}`}
      subtitle={isOut ? "Finished case delivery" : "Physical impression pickup"}
      onClose={onClose}
    >
      <section className="delivery-case-modal">
        <div className="delivery-modal-state">
          <span className={isOut ? "out" : "in"}>
            {isOut ? <Truck size={18} /> : <PackageCheck size={18} />}
          </span>
          <div>
            <small>{isOut ? "Outbound delivery" : "Inbound collection"}</small>
            <strong>
              {isOut
                ? status === "out_for_delivery"
                  ? "Out for delivery"
                  : "Ready to deliver"
                : "Awaiting clinic pickup"}
            </strong>
          </div>
        </div>
        <dl>
          <div>
            <dt>Doctor&apos;s appointment</dt>
            <dd>{appointment}</dd>
          </div>
          <div>
            <dt>Clinic</dt>
            <dd>{doctor?.clinic ?? "Clinic not recorded"}</dd>
          </div>
          <div>
            <dt>Patient</dt>
            <dd>{labCase.patient || "Not recorded"}</dd>
          </div>
          <div>
            <dt>Delivery location</dt>
            <dd>{deliveryLocation(data, labCase)}</dd>
          </div>
        </dl>
      </section>
      <div className="modal-actions delivery-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
        {!isOut && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onCollect(labCase)}
          >
            <PackageCheck size={16} />
            Collected from clinic
          </button>
        )}
        {isOut && (
          <>
            <button
              className={
                status === "out_for_delivery"
                  ? "secondary-button"
                  : "primary-button"
              }
              type="button"
              disabled={status === "out_for_delivery"}
              onClick={() => onOutForDelivery(labCase)}
            >
              <Truck size={16} />
              {status === "out_for_delivery"
                ? "Out for delivery"
                : "Mark out for delivery"}
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={status !== "out_for_delivery"}
              onClick={() => onDelivered(labCase)}
            >
              <CheckCircle2 size={16} />
              Delivered
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function DeliveryCaseModal({
  data,
  labCase,
  onClose,
  onOutForPickup,
  onCollect,
  onReceivedAtLab,
  onOutForScan,
  onScanCompleted,
  onOutForDelivery,
  onDelivered,
}: {
  data: OraData;
  labCase: LabCase;
  onClose: () => void;
  onOutForPickup: (labCase: LabCase) => void;
  onCollect: (labCase: LabCase) => void;
  onReceivedAtLab: (labCase: LabCase) => void;
  onOutForScan: (labCase: LabCase) => void;
  onScanCompleted: (labCase: LabCase) => void;
  onOutForDelivery: (labCase: LabCase) => void;
  onDelivered: (labCase: LabCase) => void;
}) {
  const queue =
    deliveryQueue(labCase) ??
    (labCase.intakeSource === "doctor" &&
    labCase.impressionType === "Physical Impression" &&
    labCase.deliveryStatus === "received_at_lab"
      ? "pickup"
      : labCase.intakeSource === "doctor" &&
          labCase.impressionType === "Oral Scan" &&
          labCase.deliveryStatus === "scanned"
        ? "oral-scan"
        : "delivery");
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  const isPickup = queue === "pickup";
  const isOralScan = queue === "oral-scan";
  const status =
    labCase.deliveryStatus ??
    (isPickup ? "awaiting_pickup" : isOralScan ? "awaiting_scan" : "ready");
  const appointment = `${formatDate(labCase.appointmentDate ?? labCase.dueDate, { day: "2-digit", month: "short", year: "numeric" })} at ${labCase.appointmentTime ?? labCase.dueTime}`;
  const label = isPickup ? "Pick up" : isOralScan ? "Oral Scan" : "Deliver";
  const state = isPickup
    ? status === "out_for_pickup"
      ? "Out for pickup"
      : status === "picked_up"
        ? "Returning to lab"
        : status === "received_at_lab"
          ? "Arrived at lab"
        : "Ready for pickup"
    : isOralScan
      ? status === "out_for_scan"
        ? "Out for scan"
        : status === "scanned"
          ? "Scan completed"
        : "Scan appointment"
      : status === "delivered"
        ? "Delivered"
        : status === "out_for_delivery"
          ? "Out for delivery"
          : "Ready to deliver";

  return (
    <Modal
      title={`Delivery - ${labCase.caseNumber}`}
      subtitle={
        isPickup
          ? "Physical impression pickup"
          : isOralScan
            ? "Clinic oral scan appointment"
            : "Finished case delivery"
      }
      onClose={onClose}
    >
      <section className="delivery-case-modal">
        <div className="delivery-modal-state">
          <span className={isPickup ? "in" : isOralScan ? "scan" : "out"}>
            {isPickup ? (
              <PackageCheck size={18} />
            ) : isOralScan ? (
              <ScanLine size={18} />
            ) : (
              <Truck size={18} />
            )}
          </span>
          <div>
            <small>{label}</small>
            <strong>{state}</strong>
          </div>
        </div>
        <dl>
          <div>
            <dt>Doctor&apos;s appointment</dt>
            <dd>{appointment}</dd>
          </div>
          <div>
            <dt>Clinic</dt>
            <dd>{doctor?.clinic ?? "Clinic not recorded"}</dd>
          </div>
          <div>
            <dt>Patient</dt>
            <dd>{labCase.patient || "Not recorded"}</dd>
          </div>
          <div>
            <dt>Delivery location</dt>
            <dd>{deliveryLocation(data, labCase)}</dd>
          </div>
          <div>
            <dt>Doctor contact</dt>
            <dd>{doctor?.phone || "Not recorded"}</dd>
          </div>
          <div>
            <dt>Assigned driver</dt>
            <dd>
              {data.staff.find((item) => item.id === labCase.deliveryAssigneeId)
                ?.name ?? "Not assigned"}
            </dd>
          </div>
        </dl>
      </section>
      <div className="modal-actions delivery-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
        {isPickup && status === "awaiting_pickup" && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onOutForPickup(labCase)}
          >
            <Truck size={16} />
            Out for pickup
          </button>
        )}
        {isPickup && status === "out_for_pickup" && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onCollect(labCase)}
          >
            <PackageCheck size={16} />
            Mark picked up
          </button>
        )}
        {isPickup && status === "picked_up" && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onReceivedAtLab(labCase)}
          >
            <CheckCircle2 size={16} />
            Arrived at lab
          </button>
        )}
        {isOralScan && status === "awaiting_scan" && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onOutForScan(labCase)}
          >
            <ScanLine size={16} />
            Out for scan
          </button>
        )}
        {isOralScan && status === "out_for_scan" && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onScanCompleted(labCase)}
          >
            <CheckCircle2 size={16} />
            Mark scan completed
          </button>
        )}
        {!isPickup && !isOralScan && status === "ready" && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onOutForDelivery(labCase)}
          >
            <Truck size={16} />
            Out for delivery
          </button>
        )}
        {!isPickup && !isOralScan && status === "out_for_delivery" && (
          <button
            className="primary-button"
            type="button"
            onClick={() => onDelivered(labCase)}
          >
            <CheckCircle2 size={16} />
            Delivered
          </button>
        )}
      </div>
    </Modal>
  );
}

function DeliveryTaskModal({
  data,
  onClose,
  onSubmit,
}: {
  data: OraData;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [doctorId, setDoctorId] = useState(
    data.doctors.find((item) => item.active !== false)?.id ?? "other",
  );
  const [taskType, setTaskType] = useState<"pickup" | "delivery" | "oral-scan">(
    "delivery",
  );
  const [caseId, setCaseId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [address, setAddress] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const addressInput = useRef<HTMLInputElement>(null);
  const selectedCase = data.cases.find(
    (item) =>
      item.id === caseId &&
      item.status === "Closed" &&
      !item.archived &&
      item.deliveryStatus !== "delivered",
  );
  const effectiveDoctorId = selectedCase?.doctorId ?? doctorId;
  const doctor = data.doctors.find((item) => item.id === effectiveDoctorId);
  const drivers = data.staff.filter(
    (item) => isDeliveryStaff(data, item),
  );
  const tripLabel =
    taskType === "oral-scan"
      ? "scan visit"
      : taskType === "pickup"
        ? "pickup"
        : "delivery";
  const deliveryCandidates = data.cases.filter(
    (item) =>
      item.status === "Closed" &&
      !item.archived &&
      item.deliveryStatus !== "delivered",
  );
  const selectedCaseLocation = selectedCase
    ? deliveryLocation(data, selectedCase)
    : "";
  const registeredAddress = doctor
    ? registeredDoctorAddress(data, doctor) ||
      (selectedCaseLocation === "Location not recorded"
        ? ""
        : selectedCaseLocation)
    : "";
  const defaultContact = selectedCase
    ? (doctor?.phone ?? "")
    : (doctor?.phone ?? "");
  useEffect(() => {
    startTransition(() => {
      setAddress(registeredAddress);
      setEditingAddress(!registeredAddress);
    });
  }, [effectiveDoctorId, registeredAddress, selectedCase?.id, taskType]);
  return (
    <Modal
      title="Add delivery task"
      subtitle="Create a pickup, delivery, or clinic oral scan visit. Deliver can be linked to a closed case."
      onClose={onClose}
    >
      <form
        className="modal-form delivery-task-form"
        onSubmit={(event) => {
          if (taskType !== "delivery" && (!scheduledDate || !scheduledTime)) {
            event.preventDefault();
            setSubmitError(`Choose the ${tripLabel} date and time before adding this task.`);
            return;
          }
          setSubmitError("");
          onSubmit(event);
        }}
      >
        <div className="form-grid">
          <label className="field">
            <span>Trip type</span>
            <select
              name="type"
              value={taskType}
              onChange={(event) => {
                const nextType = event.target.value as
                  "pickup" | "delivery" | "oral-scan";
                setTaskType(nextType);
                if (nextType !== "delivery") setCaseId("");
              }}
            >
              <option value="pickup">Pick up</option>
              <option value="delivery">Deliver</option>
              <option value="oral-scan">Oral Scan</option>
            </select>
          </label>
          {taskType === "delivery" && (
            <label className="field">
              <span>Choose a case</span>
              <select
                name="caseId"
                value={caseId}
                onChange={(event) => setCaseId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Select closed case
                </option>
                {deliveryCandidates.map((item) => {
                  const caseDoctor = data.doctors.find(
                    (entry) => entry.id === item.doctorId,
                  );
                  return (
                    <option key={item.id} value={item.id}>
                      {item.caseNumber} -{" "}
                      {caseDoctor?.name ?? "Doctor not recorded"} -{" "}
                      {item.patient}
                    </option>
                  );
                })}
              </select>
            </label>
          )}
          {taskType !== "delivery" && (
            <label className="field">
              <span>Doctor</span>
              <select
                name="doctorId"
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
              >
                {data.doctors
                  .filter((item) => item.active !== false)
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name}
                    </option>
                  ))}
                <option value="other">Other</option>
              </select>
            </label>
          )}
          {taskType === "delivery" && selectedCase && (
            <input
              type="hidden"
              name="doctorId"
              value={selectedCase.doctorId}
            />
          )}
          {taskType !== "delivery" && doctorId === "other" && (
            <label className="field span-2">
              <span>Other doctor / contact</span>
              <input name="otherDoctor" placeholder="Name" required />
            </label>
          )}
          <div className="field span-2 delivery-address-field">
            <span>
              {taskType === "oral-scan" ? "Clinic scan location" : "Address"}
            </span>
            <div className="delivery-address-control">
              <input
                ref={addressInput}
                name="address"
                value={address}
                readOnly={!editingAddress}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={
                  taskType === "oral-scan"
                    ? "Clinic address for the scan visit"
                    : "Pickup or delivery address"
                }
                required
              />
              {registeredAddress && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    if (editingAddress) {
                      setAddress(registeredAddress);
                      setEditingAddress(false);
                      return;
                    }
                    setEditingAddress(true);
                    window.setTimeout(() => addressInput.current?.focus(), 0);
                  }}
                >
                  {editingAddress ? "Use registered" : "Change address"}
                </button>
              )}
            </div>
            <small className="delivery-address-note">
              {editingAddress
                ? registeredAddress
                  ? "Enter a different address for this trip only."
                  : "No registered doctor or clinic address was found."
                : "Using the registered doctor or clinic address."}
            </small>
          </div>
          <label className="field span-2">
            <span>Contact details</span>
            <input
              key={`contact-${taskType}-${caseId}-${effectiveDoctorId}`}
              name="contactDetails"
              defaultValue={defaultContact}
              placeholder="Phone number or contact details"
              required
            />
          </label>
          {taskType !== "delivery" && (
            <>
              <CompactDatePicker
                name="scheduledDate"
                label={`${tripLabel[0].toUpperCase()}${tripLabel.slice(1)} date`}
                value={scheduledDate}
                onChange={setScheduledDate}
              />
              <CompactTimePicker
                name="scheduledTime"
                label={`${tripLabel[0].toUpperCase()}${tripLabel.slice(1)} time`}
                value={scheduledTime}
                onChange={setScheduledTime}
              />
            </>
          )}
          <label className="field span-2">
            <span>Assigned driver</span>
            <select
              name="assignedTo"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Choose a driver
              </option>
              {drivers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {submitError && <p className="form-error wizard-form-error" role="alert">{submitError}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            <Plus size={16} />
            Add {tripLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DoctorsView({
  data,
  canManage,
  canManageAccount,
  canManagePortal,
  canViewMoney,
  canViewStatements,
  onStatement,
  onClinicStatement,
  onAdd,
  onCreateClinic,
  onClinics,
  onEdit,
  onAccount,
  onPortalAccount,
  onOpenPortal,
  onRemove,
}: {
  data: OraData;
  canManage: boolean;
  canManageAccount: boolean;
  canManagePortal: boolean;
  canViewMoney: boolean;
  canViewStatements: boolean;
  onStatement: (id: string) => void;
  onClinicStatement: (clinic: string) => void;
  onAdd: () => void;
  onCreateClinic: () => void;
  onClinics: (clinic?: string) => void;
  onEdit: (id: string) => void;
  onAccount: (id: string) => void;
  onPortalAccount: (id: string) => void;
  onOpenPortal: (id: string) => void;
  onRemove: (doctor: Doctor) => void;
}) {
  const [mode, setMode] = useState<"doctors" | "clinics">("doctors");
  const [expandedDoctorId, setExpandedDoctorId] = useState<string | null>(null);
  const [expandedClinic, setExpandedClinic] = useState<string | null>(null);
  const [mobileDoctorActionId, setMobileDoctorActionId] = useState<string | null>(null);
  const [mobileClinicAction, setMobileClinicAction] = useState<string | null>(null);
  const activeDoctors = data.doctors.filter(
    (doctor) => doctor.active !== false,
  );

  function DoctorRow({
    doctor,
    compact = false,
  }: {
    doctor: Doctor;
    compact?: boolean;
  }) {
    const cases = data.cases.filter((item) => item.doctorId === doctor.id);
    const outstanding = cases.reduce(
      (sum, item) => sum + item.price - item.paid,
      0,
    );
    const overdue = cases
      .filter((item) => isCaseOverdue(item) && item.paid < item.price)
      .reduce((sum, item) => sum + item.price - item.paid, 0);
    const isOpen = expandedDoctorId === doctor.id;
    const showMobileActions =
      canViewStatements || canManageAccount || canManagePortal || canManage;
    return (
      <article
        className={`doctor-list-item ${compact ? "compact" : ""} ${isOpen ? "expanded" : ""}`}
      >
        <header>
          <button
            className="doctor-expand"
            type="button"
            onClick={() => setExpandedDoctorId(isOpen ? null : doctor.id)}
            aria-expanded={isOpen}
          >
            <span className="doctor-avatar">
              {doctor.name.split(" ").slice(-1)[0]?.[0] ?? "D"}
            </span>
            <span>
              <strong>{doctor.name}</strong>
              <small>{doctor.clinic}</small>
            </span>
            <ChevronRight className="doctor-inline-chevron" size={17} />
          </button>
          <div className="doctor-actions">
            {canViewStatements && (
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => onStatement(doctor.id)}
              >
                <ReceiptText size={15} />
                Statement
              </button>
            )}
            {canManageAccount && (
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => onAccount(doctor.id)}
              >
                <WalletCards size={15} />
                Account
              </button>
            )}
            {canManagePortal && (
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => onPortalAccount(doctor.id)}
              >
                <KeyRound size={15} />
                {doctor.portalAccount ? "Portal login" : "Create portal"}
              </button>
            )}
            {canManagePortal && doctor.portalAccount && (
              <button
                className="secondary-button compact doctor-dashboard-button"
                type="button"
                onClick={() => onOpenPortal(doctor.id)}
                aria-label={`Open ${doctor.name} dashboard`}
                title="Open doctor dashboard"
              >
                <LayoutDashboard size={15} />
                Dashboard
              </button>
            )}
            {canManage && (
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => onEdit(doctor.id)}
              >
                <Pencil size={15} />
                Edit
              </button>
            )}
            {canManage && (
              <button
                className="icon-button danger-icon"
                type="button"
                onClick={() => onRemove(doctor)}
                aria-label={`Remove ${doctor.name}`}
                title="Remove doctor"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
          {showMobileActions && (
            <>
              <button
                className="icon-button doctor-mobile-actions-trigger"
                type="button"
                onClick={() =>
                  setMobileDoctorActionId((current) =>
                    current === doctor.id ? null : doctor.id,
                  )
                }
                aria-label={`Actions for ${doctor.name}`}
                aria-expanded={mobileDoctorActionId === doctor.id}
              >
                <MoreHorizontal size={18} />
              </button>
              {mobileDoctorActionId === doctor.id && (
                <div
                  className="directory-mobile-action-menu open"
                  role="presentation"
                  onClick={() => setMobileDoctorActionId(null)}
                >
                  <section
                    className="directory-mobile-action-sheet"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Actions for ${doctor.name}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <header>
                      <span>Doctor actions</span>
                      <strong>{doctor.name}</strong>
                    </header>
                    <div>
                      {canViewStatements && (
                        <button type="button" onClick={() => { setMobileDoctorActionId(null); onStatement(doctor.id); }}>
                          <ReceiptText size={15} /> Statement
                        </button>
                      )}
                      {canManageAccount && (
                        <button type="button" onClick={() => { setMobileDoctorActionId(null); onAccount(doctor.id); }}>
                          <WalletCards size={15} /> Account
                        </button>
                      )}
                      {canManagePortal && (
                        <button type="button" onClick={() => { setMobileDoctorActionId(null); onPortalAccount(doctor.id); }}>
                          <KeyRound size={15} /> {doctor.portalAccount ? "Portal login" : "Create portal"}
                        </button>
                      )}
                      {canManagePortal && doctor.portalAccount && (
                        <button type="button" onClick={() => { setMobileDoctorActionId(null); onOpenPortal(doctor.id); }}>
                          <LayoutDashboard size={15} /> Dashboard
                        </button>
                      )}
                      {canManage && (
                        <button type="button" onClick={() => { setMobileDoctorActionId(null); onEdit(doctor.id); }}>
                          <Pencil size={15} /> Edit
                        </button>
                      )}
                      {canManage && (
                        <button className="danger" type="button" onClick={() => { setMobileDoctorActionId(null); onRemove(doctor); }}>
                          <Trash2 size={15} /> Remove doctor
                        </button>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          <button
            className="icon-button doctor-mobile-expand-trigger"
            type="button"
            onClick={() => setExpandedDoctorId(isOpen ? null : doctor.id)}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${doctor.name}`}
            aria-expanded={isOpen}
          >
            <ChevronRight size={17} />
          </button>
        </header>
        <div className="expand-shell">
          <div className="doctor-expanded">
            <div className="doctor-meta account-meta">
              <span>
                <small>Cases</small>
                <strong>{cases.length}</strong>
              </span>
              {canViewMoney && (
                <>
                  <span>
                    <small>Outstanding</small>
                    <strong>{money(outstanding, data.currency)}</strong>
                  </span>
                  <span>
                    <small>Overdue</small>
                    <strong className={overdue > 0 ? "overdue-value" : ""}>
                      {money(overdue, data.currency)}
                    </strong>
                  </span>
                </>
              )}
              <span>
                <small>Phone</small>
                <strong>{doctor.phone || "Not recorded"}</strong>
              </span>
            </div>
            {doctor.practiceType === "individual" ? (
              <div className="price-preview">
                {data.serviceTypes.map((service) => (
                  <span key={service}>
                    <small>{service}</small>
                    <strong>
                      {money(doctor.priceList[service] ?? 0, data.currency)}
                      <em>/unit</em>
                    </strong>
                  </span>
                ))}
              </div>
            ) : (
              <div className="info-callout">
                <BadgeDollarSign size={17} />
                <p>This doctor uses the shared {doctor.clinic} price list.</p>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  const clinics = [...data.clinics, "Independent practice"];
  return (
    <section className="panel doctor-directory">
      <div className="section-toolbar">
        <div>
          <h2>
            {mode === "doctors" ? "Doctor directory" : "Clinic directory"}
          </h2>
          <p>
            Open a row only when you need contact, balance, or pricing details.
          </p>
        </div>
        <div className="directory-actions">
          <div className="segmented">
            <button
              type="button"
              className={mode === "doctors" ? "active" : ""}
              onClick={() => setMode("doctors")}
            >
              Doctors
            </button>
            <button
              type="button"
              className={mode === "clinics" ? "active" : ""}
              onClick={() => setMode("clinics")}
            >
              Clinics
            </button>
          </div>
          {canManage && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => onClinics()}
            >
              <Pencil size={16} />
              Manage clinics
            </button>
          )}
          {canManage && (
            <button className="primary-button" type="button" onClick={() => mode === "clinics" ? onCreateClinic() : onAdd()}>
              <Plus size={17} />
              {mode === "clinics" ? "Add clinic" : "Add doctor"}
            </button>
          )}
        </div>
      </div>
      {mode === "doctors" ? (
        <div className="doctor-list">
          {activeDoctors.map((doctor) => (
            <DoctorRow doctor={doctor} key={doctor.id} />
          ))}
        </div>
      ) : (
        <div className="clinic-list">
          {clinics.map((clinic) => {
            const doctors = activeDoctors.filter(
              (doctor) => doctor.clinic === clinic,
            );
            const isOpen = expandedClinic === clinic;
            return (
              <article
                className={`clinic-list-item ${isOpen ? "expanded" : ""}`}
                key={clinic}
              >
                <div className="clinic-row-head">
                  <button
                    type="button"
                    onClick={() => setExpandedClinic(isOpen ? null : clinic)}
                  >
                    <span>
                      <strong>{clinic}</strong>
                      <small>
                        {doctors.length} doctor{doctors.length === 1 ? "" : "s"}
                      </small>
                    </span>
                    <ChevronRight className="clinic-inline-chevron" size={17} />
                  </button>
                  {clinic !== "Independent practice" && canViewStatements && (
                    <button
                      className="secondary-button compact"
                      type="button"
                      onClick={() => onClinicStatement(clinic)}
                    >
                      <ReceiptText size={15} />
                      Statement
                    </button>
                  )}
                  {clinic !== "Independent practice" && canManage && (
                    <button
                      className="secondary-button compact"
                      type="button"
                      onClick={() => onClinics(clinic)}
                    >
                      <Pencil size={15} />
                      Edit clinic
                    </button>
                  )}
                  {clinic !== "Independent practice" && (canViewStatements || canManage) && (
                    <>
                      <button
                        className="icon-button clinic-mobile-actions-trigger"
                        type="button"
                        onClick={() =>
                          setMobileClinicAction((current) =>
                            current === clinic ? null : clinic,
                          )
                        }
                        aria-label={`Actions for ${clinic}`}
                        aria-expanded={mobileClinicAction === clinic}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {mobileClinicAction === clinic && (
                        <div
                          className="directory-mobile-action-menu clinic-mobile-action-menu open"
                          role="presentation"
                          onClick={() => setMobileClinicAction(null)}
                        >
                          <section
                            className="directory-mobile-action-sheet"
                            role="dialog"
                            aria-modal="true"
                            aria-label={`Actions for ${clinic}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <header>
                              <span>Clinic actions</span>
                              <strong>{clinic}</strong>
                            </header>
                            <div>
                              {canViewStatements && (
                                <button type="button" onClick={() => { setMobileClinicAction(null); onClinicStatement(clinic); }}>
                                  <ReceiptText size={15} /> Statement
                                </button>
                              )}
                              {canManage && (
                                <button type="button" onClick={() => { setMobileClinicAction(null); onClinics(clinic); }}>
                                  <Pencil size={15} /> Edit clinic
                                </button>
                              )}
                            </div>
                          </section>
                        </div>
                      )}
                    </>
                  )}
                  <button
                    className="icon-button clinic-mobile-expand-trigger"
                    type="button"
                    onClick={() => setExpandedClinic(isOpen ? null : clinic)}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${clinic}`}
                    aria-expanded={isOpen}
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="expand-shell">
                  <div>
                    {doctors.map((doctor) => (
                      <DoctorRow doctor={doctor} compact key={doctor.id} />
                    ))}
                    {!doctors.length && (
                      <p>No doctors are assigned to this clinic.</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function AccountingView({
  data,
  canManageExpenses,
  period,
  setPeriod,
  start,
  onExpense,
  onExport,
  onPrint,
  onStatement,
  onOpenCase,
}: {
  data: OraData;
  canManageExpenses: boolean;
  period: "day" | "week" | "month" | "year" | "all";
  setPeriod: (value: "day" | "week" | "month" | "year" | "all") => void;
  start: string;
  onExpense: () => void;
  onExport: () => void;
  onPrint: () => void;
  onStatement: (id: string) => void;
  onOpenCase: (id: string) => void;
}) {
  const cases = data.cases.filter((item) => item.receivedDate >= start);
  const payments = data.payments.filter(
    (item) => item.date.slice(0, 10) >= start,
  );
  const expenses = data.expenses.filter((item) => item.date >= start);
  const income = cases.reduce((sum, item) => sum + item.price, 0);
  const collected = payments.reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const totalOutstanding = data.cases.reduce(
    (sum, item) => sum + item.price - item.paid,
    0,
  );
  const totalOverdue = data.cases
    .filter((item) => isCaseOverdue(item) && item.paid < item.price)
    .reduce((sum, item) => sum + item.price - item.paid, 0);
  const periodLabel =
    period === "all"
      ? "All-time"
      : period === "day"
        ? "Today"
        : `This ${period}`;

  return (
    <div className="accounting-view">
      <section className="accounting-toolbar">
        <div className="segmented" aria-label="Statement period">
          {(["day", "week", "month", "year", "all"] as const).map((item) => (
            <button
              type="button"
              className={period === item ? "active" : ""}
              key={item}
              onClick={() => setPeriod(item)}
            >
              {item === "all"
                ? "All time"
                : item === "day"
                  ? "Today"
                  : `This ${item}`}
            </button>
          ))}
        </div>
        <div>
          <button className="secondary-button" type="button" onClick={onPrint}>
            <Printer size={16} />
            Print statement
          </button>
          <button className="secondary-button" type="button" onClick={onExport}>
            <FileDown size={16} />
            Export PDF
          </button>
          {canManageExpenses && (
            <button
              className="primary-button"
              type="button"
              onClick={onExpense}
            >
              <Plus size={17} />
              Add expense
            </button>
          )}
        </div>
      </section>
      <section className="metric-grid accounting-metrics">
        <Metric
          icon={ArrowUpRight}
          label="Case charges"
          value={money(income, data.currency)}
          hint={`${cases.length} invoices in period`}
          tone="blue"
        />
        <Metric
          icon={CheckCircle2}
          label="Payments received"
          value={money(collected, data.currency)}
          hint={`${money(collected - expenseTotal, data.currency)} after expenses`}
          tone="green"
        />
        <Metric
          icon={ArrowDownRight}
          label="Expenses"
          value={money(expenseTotal, data.currency)}
          hint={`${expenses.length} entries`}
          tone="danger"
        />
        <Metric
          icon={CircleDollarSign}
          label="Doctor balances"
          value={money(totalOutstanding, data.currency)}
          hint={`${money(totalOverdue, data.currency)} overdue`}
          tone="amber"
        />
      </section>
      <section className="accounting-columns">
        <div className="panel statement-panel">
          <div className="panel-heading">
            <div>
              <span>Doctor accounts</span>
              <h3>{periodLabel} account summary</h3>
            </div>
            <ReceiptText size={18} />
          </div>
          <div className="statement-table">
            <div className="statement-row head">
              <span>Doctor</span>
              <span>Charges</span>
              <span>Payments</span>
              <span>Balance</span>
              <span>Overdue</span>
            </div>
            {data.doctors.map((doctor) => {
              const doctorCases = cases.filter(
                (item) => item.doctorId === doctor.id,
              );
              const doctorPayments = payments.filter(
                (item) => item.doctorId === doctor.id,
              );
              const billed = doctorCases.reduce(
                (sum, item) => sum + item.price,
                0,
              );
              const paid = doctorPayments.reduce(
                (sum, item) => sum + item.amount,
                0,
              );
              const allCases = data.cases.filter(
                (item) => item.doctorId === doctor.id,
              );
              const balance = allCases.reduce(
                (sum, item) => sum + item.price - item.paid,
                0,
              );
              const overdue = allCases
                .filter((item) => isCaseOverdue(item) && item.paid < item.price)
                .reduce((sum, item) => sum + item.price - item.paid, 0);
              return (
                <div className="statement-row" key={doctor.id}>
                  <span>
                    <button
                      className="statement-link"
                      type="button"
                      onClick={() => onStatement(doctor.id)}
                    >
                      <strong>{doctor.name}</strong>
                      <small>
                        {doctorCases.length} cases · Print statement
                      </small>
                    </button>
                  </span>
                  <span>{money(billed, data.currency)}</span>
                  <span>{money(paid, data.currency)}</span>
                  <span className={balance > 0 ? "due-value" : ""}>
                    {money(balance, data.currency)}
                  </span>
                  <span className={overdue > 0 ? "overdue-value" : ""}>
                    {money(overdue, data.currency)}
                  </span>
                </div>
              );
            })}
            <div className="statement-row total">
              <span>Total</span>
              <span>{money(income, data.currency)}</span>
              <span>{money(collected, data.currency)}</span>
              <span>{money(totalOutstanding, data.currency)}</span>
              <span>{money(totalOverdue, data.currency)}</span>
            </div>
          </div>
          <div className="recent-case-values">
            <h4>Case invoices in this period</h4>
            {cases.slice(0, 8).map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onOpenCase(item.id)}
              >
                <span>
                  <strong>{invoiceNumber(item)}</strong>
                  <small>
                    {
                      data.doctors.find((doctor) => doctor.id === item.doctorId)
                        ?.name
                    }{" "}
                    · Patient {item.patient} · {item.units} units
                  </small>
                </span>
                <span>
                  <strong>{money(item.price, data.currency)}</strong>
                  <PaymentBadge labCase={item} />
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </div>
        <aside className="panel expenses-panel">
          <div className="panel-heading">
            <div>
              <span>Outgoing</span>
              <h3>Expenses</h3>
            </div>
            <ArrowDownRight size={18} />
          </div>
          <div className="expense-list">
            {expenses.map((expense) => (
              <div key={expense.id}>
                <span className="expense-icon">
                  <ReceiptText size={16} />
                </span>
                <span>
                  <strong>{expense.description}</strong>
                  <small>
                    {expense.category} ·{" "}
                    {formatDate(expense.date, {
                      day: "2-digit",
                      month: "short",
                    })}
                  </small>
                </span>
                <b>{money(expense.amount, data.currency)}</b>
              </div>
            ))}
            {!expenses.length && (
              <div className="empty-block">
                <ReceiptText size={23} />
                <p>No expenses in this period</p>
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

export function AccountingViewV2({
  data,
  canManageExpenses,
  period,
  setPeriod,
  start,
  onExpense,
  onExport,
  onPrint,
  onStatement,
  onOpenCase,
}: {
  data: OraData;
  canManageExpenses: boolean;
  period: "day" | "week" | "month" | "year" | "all";
  setPeriod: (value: "day" | "week" | "month" | "year" | "all") => void;
  start: string;
  onExpense: () => void;
  onExport: () => void;
  onPrint: () => void;
  onStatement: (id: string) => void;
  onOpenCase: (id: string) => void;
}) {
  const [ledgerFilter, setLedgerFilter] = useState<
    "All" | "Invoice" | "Payment" | "Expense"
  >("All");
  const cases = data.cases.filter((item) => item.receivedDate >= start);
  const payments = data.payments.filter(
    (item) => item.date.slice(0, 10) >= start,
  );
  const expenses = data.expenses.filter((item) => item.date >= start);
  const charges = cases.reduce((sum, item) => sum + item.price, 0);
  const collected = payments.reduce((sum, item) => sum + item.amount, 0);
  const expenseTotal = expenses.reduce((sum, item) => sum + item.amount, 0);
  const netCash = collected - expenseTotal;
  const outstandingCases = data.cases.filter((item) => item.price > item.paid);
  const totalOutstanding = outstandingCases.reduce(
    (sum, item) => sum + item.price - item.paid,
    0,
  );
  const totalOverdue = outstandingCases
    .filter((item) => isCaseOverdue(item))
    .reduce((sum, item) => sum + item.price - item.paid, 0);
  const collectionRate =
    charges > 0 ? Math.max(0, (collected / charges) * 100) : 0;
  const averageInvoice = cases.length ? charges / cases.length : 0;
  const periodLabel =
    period === "all"
      ? "All time"
      : period === "day"
        ? "Today"
        : `This ${period}`;
  const now = new Date();
  const aging = { current: 0, thirty: 0, sixty: 0, older: 0 };
  outstandingCases.forEach((item) => {
    const daysLate = Math.max(
      0,
      Math.floor((now.getTime() - caseDueAt(item).getTime()) / 86400000),
    );
    const balance = item.price - item.paid;
    if (daysLate === 0) aging.current += balance;
    else if (daysLate <= 30) aging.thirty += balance;
    else if (daysLate <= 60) aging.sixty += balance;
    else aging.older += balance;
  });
  const expenseCategories = Object.entries(
    expenses.reduce<Record<string, number>>(
      (totals, expense) => ({
        ...totals,
        [expense.category]: (totals[expense.category] ?? 0) + expense.amount,
      }),
      {},
    ),
  ).sort(([, first], [, second]) => second - first);
  const ledger: Array<{
    id: string;
    type: "Invoice" | "Payment" | "Expense";
    date: string;
    title: string;
    detail: string;
    amount: number;
    caseId?: string;
  }> = [
    ...cases.map((item) => ({
      id: `invoice-${item.id}`,
      type: "Invoice" as const,
      date: item.receivedDate,
      title: invoiceNumber(item),
      detail: `${data.doctors.find((doctor) => doctor.id === item.doctorId)?.name ?? "Doctor"} · ${item.patient}`,
      amount: item.price,
      caseId: item.id,
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      type: "Payment" as const,
      date: payment.date,
      title: payment.note || "Payment received",
      detail:
        data.doctors.find((doctor) => doctor.id === payment.doctorId)?.name ??
        "Doctor",
      amount: payment.amount,
      caseId: payment.caseId,
    })),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      type: "Expense" as const,
      date: expense.date,
      title: expense.description,
      detail: expense.category,
      amount: -expense.amount,
    })),
  ].sort((first, second) => second.date.localeCompare(first.date));
  const visibleLedger =
    ledgerFilter === "All"
      ? ledger
      : ledger.filter((entry) => entry.type === ledgerFilter);

  return (
    <div className="accounting-view accounting-view-v2">
      <section className="accounting-toolbar">
        <div className="segmented" aria-label="Statement period">
          {(["day", "week", "month", "year", "all"] as const).map((item) => (
            <button
              type="button"
              className={period === item ? "active" : ""}
              key={item}
              onClick={() => setPeriod(item)}
            >
              {item === "all"
                ? "All time"
                : item === "day"
                  ? "Today"
                  : `This ${item}`}
            </button>
          ))}
        </div>
        <div>
          <button className="secondary-button" type="button" onClick={onPrint}>
            <Printer size={16} />
            Print statement
          </button>
          <button className="secondary-button" type="button" onClick={onExport}>
            <FileDown size={16} />
            Export PDF
          </button>
          {canManageExpenses && (
            <button
              className="primary-button"
              type="button"
              onClick={onExpense}
            >
              <Plus size={17} />
              Add expense
            </button>
          )}
        </div>
      </section>
      <section className="metric-grid accounting-metrics accounting-metrics-expanded">
        <Metric
          icon={ArrowUpRight}
          label="Invoiced"
          value={money(charges, data.currency)}
          hint={`${cases.length} invoices in ${periodLabel.toLowerCase()}`}
          tone="blue"
        />
        <Metric
          icon={CheckCircle2}
          label="Collected"
          value={money(collected, data.currency)}
          hint={`${collectionRate.toFixed(0)}% collection rate`}
          tone="green"
        />
        <Metric
          icon={ArrowDownRight}
          label="Expenses"
          value={money(expenseTotal, data.currency)}
          hint={`${expenses.length} expense entries`}
          tone="danger"
        />
        <Metric
          icon={WalletCards}
          label="Net cash"
          value={money(netCash, data.currency)}
          hint={
            netCash >= 0 ? "Positive cash movement" : "Costs exceed collections"
          }
          tone={netCash >= 0 ? "green" : "danger"}
        />
        <Metric
          icon={CircleDollarSign}
          label="Receivables"
          value={money(totalOutstanding, data.currency)}
          hint={`${money(totalOverdue, data.currency)} overdue`}
          tone="amber"
        />
        <Metric
          icon={ReceiptText}
          label="Average invoice"
          value={money(averageInvoice, data.currency)}
          hint={`${cases.length || 0} cases in period`}
          tone="neutral"
        />
      </section>
      <section className="finance-health-grid">
        <article className="panel finance-health-card">
          <div className="panel-heading">
            <div>
              <span>Cash position</span>
              <h3>{periodLabel} movement</h3>
            </div>
            <WalletCards size={18} />
          </div>
          <div className="cash-position">
            <span>
              <small>Collections</small>
              <strong>{money(collected, data.currency)}</strong>
            </span>
            <i>−</i>
            <span>
              <small>Expenses</small>
              <strong>{money(expenseTotal, data.currency)}</strong>
            </span>
            <i>=</i>
            <span className={netCash < 0 ? "negative" : "positive"}>
              <small>Net cash</small>
              <strong>{money(netCash, data.currency)}</strong>
            </span>
          </div>
          <div className="collection-progress">
            <span>
              <i style={{ width: `${Math.min(100, collectionRate)}%` }} />
            </span>
            <small>
              {collectionRate.toFixed(0)}% of invoiced value collected in this
              period
            </small>
          </div>
        </article>
        <article className="panel finance-health-card">
          <div className="panel-heading">
            <div>
              <span>Accounts receivable</span>
              <h3>Balance aging</h3>
            </div>
            <Clock3 size={18} />
          </div>
          <div className="aging-grid">
            <span>
              <small>Current</small>
              <strong>{money(aging.current, data.currency)}</strong>
            </span>
            <span>
              <small>1–30 days</small>
              <strong>{money(aging.thirty, data.currency)}</strong>
            </span>
            <span>
              <small>31–60 days</small>
              <strong>{money(aging.sixty, data.currency)}</strong>
            </span>
            <span className={aging.older > 0 ? "older" : ""}>
              <small>60+ days</small>
              <strong>{money(aging.older, data.currency)}</strong>
            </span>
          </div>
        </article>
        <article className="panel finance-health-card">
          <div className="panel-heading">
            <div>
              <span>Cost control</span>
              <h3>Expenses by category</h3>
            </div>
            <ArrowDownRight size={18} />
          </div>
          <div className="expense-category-list">
            {expenseCategories.slice(0, 4).map(([category, amount]) => (
              <div key={category}>
                <span>
                  <strong>{category}</strong>
                  <small>
                    {expenseTotal
                      ? `${Math.round((amount / expenseTotal) * 100)}% of spend`
                      : "No spend"}
                  </small>
                </span>
                <b>{money(amount, data.currency)}</b>
              </div>
            ))}
            {!expenseCategories.length && (
              <div className="empty-finance">No expenses for this period.</div>
            )}
          </div>
        </article>
      </section>
      <section className="accounting-columns accounting-main-columns">
        <div className="panel statement-panel">
          <div className="panel-heading">
            <div>
              <span>Customer accounts</span>
              <h3>Doctor receivables</h3>
            </div>
            <ReceiptText size={18} />
          </div>
          <div className="statement-table">
            <div className="statement-row head">
              <span>Doctor</span>
              <span>Invoiced</span>
              <span>Payments</span>
              <span>Balance</span>
              <span>Overdue</span>
            </div>
            {data.doctors
              .filter((doctor) => doctor.active !== false)
              .map((doctor) => {
                const doctorCases = cases.filter(
                  (item) => item.doctorId === doctor.id,
                );
                const doctorPayments = payments.filter(
                  (item) => item.doctorId === doctor.id,
                );
                const billed = doctorCases.reduce(
                  (sum, item) => sum + item.price,
                  0,
                );
                const paid = doctorPayments.reduce(
                  (sum, item) => sum + item.amount,
                  0,
                );
                const allCases = data.cases.filter(
                  (item) => item.doctorId === doctor.id,
                );
                const balance = allCases.reduce(
                  (sum, item) => sum + item.price - item.paid,
                  0,
                );
                const overdue = allCases
                  .filter(
                    (item) => isCaseOverdue(item) && item.paid < item.price,
                  )
                  .reduce((sum, item) => sum + item.price - item.paid, 0);
                return (
                  <div className="statement-row" key={doctor.id}>
                    <span>
                      <button
                        className="statement-link"
                        type="button"
                        onClick={() => onStatement(doctor.id)}
                      >
                        <strong>{doctor.name}</strong>
                        <small>{doctor.clinic}</small>
                      </button>
                    </span>
                    <span>{money(billed, data.currency)}</span>
                    <span>{money(paid, data.currency)}</span>
                    <span className={balance > 0 ? "due-value" : ""}>
                      {money(balance, data.currency)}
                    </span>
                    <span className={overdue > 0 ? "overdue-value" : ""}>
                      {money(overdue, data.currency)}
                    </span>
                  </div>
                );
              })}
            <div className="statement-row total">
              <span>Total</span>
              <span>{money(charges, data.currency)}</span>
              <span>{money(collected, data.currency)}</span>
              <span>{money(totalOutstanding, data.currency)}</span>
              <span>{money(totalOverdue, data.currency)}</span>
            </div>
          </div>
        </div>
        <aside className="panel expenses-panel">
          <div className="panel-heading">
            <div>
              <span>Outgoing</span>
              <h3>Recent expenses</h3>
            </div>
            <ArrowDownRight size={18} />
          </div>
          <div className="expense-list">
            {expenses.slice(0, 7).map((expense) => (
              <div key={expense.id}>
                <span className="expense-icon">
                  <ReceiptText size={16} />
                </span>
                <span>
                  <strong>{expense.description}</strong>
                  <small>
                    {expense.category} ·{" "}
                    {formatDate(expense.date, {
                      day: "2-digit",
                      month: "short",
                    })}
                  </small>
                </span>
                <b>{money(expense.amount, data.currency)}</b>
              </div>
            ))}
            {!expenses.length && (
              <div className="empty-block">
                <ReceiptText size={23} />
                <p>No expenses in this period</p>
              </div>
            )}
          </div>
        </aside>
      </section>
      <section className="panel finance-ledger">
        <div className="panel-heading">
          <div>
            <span>Financial activity</span>
            <h3>General ledger</h3>
          </div>
          <div className="segmented ledger-filter">
            {(["All", "Invoice", "Payment", "Expense"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={ledgerFilter === item ? "active" : ""}
                onClick={() => setLedgerFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="ledger-list">
          {visibleLedger.slice(0, 18).map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={`ledger-entry ${entry.type.toLowerCase()}`}
              onClick={() => entry.caseId && onOpenCase(entry.caseId)}
              disabled={!entry.caseId}
            >
              <span className="ledger-type">{entry.type}</span>
              <span>
                <strong>{entry.title}</strong>
                <small>
                  {entry.detail} ·{" "}
                  {formatDate(entry.date.slice(0, 10), {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </small>
              </span>
              <b
                className={
                  entry.amount < 0
                    ? "negative"
                    : entry.type === "Invoice"
                      ? "due-value"
                      : "positive"
                }
              >
                {entry.amount < 0 ? "−" : entry.type === "Payment" ? "+" : ""}
                {money(Math.abs(entry.amount), data.currency)}
              </b>
              {entry.caseId && <ChevronRight size={15} />}
            </button>
          ))}
          {!visibleLedger.length && (
            <div className="empty-block">
              <History size={22} />
              <p>No ledger entries in this period.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type AccountingWorkspaceProps = {
  data: OraData;
  canManageExpenses: boolean;
  period: "day" | "week" | "month" | "year" | "all";
  setPeriod: (value: "day" | "week" | "month" | "year" | "all") => void;
  start: string;
  onExpense: () => void;
  onExport: () => void;
  onPrint: () => void;
  onStatement: (id: string) => void;
  onOpenCase: (id: string) => void;
};

function AccountingWorkspace(props: AccountingWorkspaceProps) {
  return (
    <AccountingWorkspacePage data={props.data} onOpenCase={props.onOpenCase} />
  );
}

export function BankingWorkspace({
  data,
  period,
  start,
  onOpenCase,
}: Pick<AccountingWorkspaceProps, "data" | "period" | "start" | "onOpenCase">) {
  type BankTransaction = {
    id: string;
    account: string;
    date: string;
    merchant: string;
    amount: number;
    category: string;
    status: "Reviewed" | "For review";
  };
  const [connected, setConnected] = useState(true);
  const [lastSync, setLastSync] = useState("Today, 09:32");
  const [transactions, setTransactions] = useState<BankTransaction[]>([
    {
      id: "bank-1",
      account: "Ora Operating",
      date: "2026-08-10",
      merchant: "Dr. Layla Mansour payment",
      amount: 62,
      category: "Client payment",
      status: "Reviewed",
    },
    {
      id: "bank-2",
      account: "Ora Operating",
      date: "2026-08-09",
      merchant: "Zirconia supplier",
      amount: -420,
      category: "Materials",
      status: "Reviewed",
    },
    {
      id: "bank-3",
      account: "Business card",
      date: "2026-08-08",
      merchant: "Courier service",
      amount: -18.5,
      category: "Uncategorized",
      status: "For review",
    },
    {
      id: "bank-4",
      account: "Business card",
      date: "2026-08-07",
      merchant: "Lab utilities",
      amount: -31,
      category: "Utilities",
      status: "For review",
    },
  ]);
  const receiptInput = useRef<HTMLInputElement>(null);
  const [receipts, setReceipts] = useState([
    "zirconia-restock.pdf",
    "courier-august.jpg",
  ]);
  const importedIncome = transactions
    .filter((item) => item.amount > 0)
    .reduce((sum, item) => sum + item.amount, 0);
  const importedSpend = transactions
    .filter((item) => item.amount < 0)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const awaitingReview = transactions.filter(
    (item) => item.status === "For review",
  );
  const invoices = data.cases
    .filter((item) => item.receivedDate >= start && item.price > item.paid)
    .sort(
      (first, second) =>
        caseDueAt(first).getTime() - caseDueAt(second).getTime(),
    );
  const sync = () => {
    setLastSync("Just now");
    setTransactions((current) =>
      current.map((item) =>
        item.status === "For review"
          ? {
              ...item,
              status: "Reviewed",
              category:
                item.category === "Uncategorized"
                  ? "Courier and delivery"
                  : item.category,
            }
          : item,
      ),
    );
  };
  return (
    <div className="accounting-module-view banking-workspace">
      <section className="accounting-toolbar">
        <div>
          <strong>Banking and receipts</strong>
          <small>Review and categorize account transactions.</small>
        </div>
        <div>
          {connected ? (
            <>
              <button className="secondary-button" type="button" onClick={sync}>
                <RotateCcw size={16} />
                Refresh transactions
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setConnected(false)}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setConnected(true);
                setLastSync("Just now");
              }}
            >
              <WalletCards size={16} />
              Connect account
            </button>
          )}
        </div>
      </section>
      {connected ? (
        <>
          <section className="bank-account-grid">
            <article className="bank-account-card">
              <span>
                <WalletCards size={18} />
                Ora Operating
              </span>
              <strong>{money(5820.45, data.currency)}</strong>
              <small>Ending balance · {lastSync}</small>
            </article>
            <article className="bank-account-card card">
              <span>
                <CircleDollarSign size={18} />
                Business card
              </span>
              <strong>{money(-49.5, data.currency)}</strong>
              <small>Current statement balance · {lastSync}</small>
            </article>
            <article className="bank-account-card review">
              <span>
                <AlertTriangle size={18} />
                For review
              </span>
              <strong>{awaitingReview.length}</strong>
              <small>Transactions waiting for a category</small>
            </article>
          </section>
          <section className="banking-columns">
            <section className="panel bank-feed">
              <div className="panel-heading">
                <div>
                  <span>Imported transactions</span>
                  <h3>Bank feed</h3>
                </div>
                <small>
                  {period === "all" ? "All time" : `This ${period}`}
                </small>
              </div>
              <div className="bank-summary">
                <span>
                  <small>Money in</small>
                  <strong>{money(importedIncome, data.currency)}</strong>
                </span>
                <span>
                  <small>Money out</small>
                  <strong>{money(importedSpend, data.currency)}</strong>
                </span>
                <span>
                  <small>Ready to reconcile</small>
                  <strong>
                    {
                      transactions.filter((item) => item.status === "Reviewed")
                        .length
                    }
                  </strong>
                </span>
              </div>
              <div className="bank-transaction-list">
                {transactions.map((transaction) => (
                  <article key={transaction.id}>
                    <span>
                      <strong>{transaction.merchant}</strong>
                      <small>
                        {transaction.account} ·{" "}
                        {formatDate(transaction.date, {
                          day: "2-digit",
                          month: "short",
                        })}
                      </small>
                    </span>
                    <select
                      aria-label={`Category for ${transaction.merchant}`}
                      value={transaction.category}
                      onChange={(event) =>
                        setTransactions((current) =>
                          current.map((item) =>
                            item.id === transaction.id
                              ? {
                                  ...item,
                                  category: event.target.value,
                                  status: "Reviewed",
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option>Client payment</option>
                      <option>Materials</option>
                      <option>Utilities</option>
                      <option>Courier and delivery</option>
                      <option>Payroll</option>
                      <option>Uncategorized</option>
                    </select>
                    <b
                      className={
                        transaction.amount >= 0 ? "positive" : "negative"
                      }
                    >
                      {transaction.amount >= 0 ? "+" : "−"}
                      {money(Math.abs(transaction.amount), data.currency)}
                    </b>
                    <small
                      className={
                        transaction.status === "Reviewed"
                          ? "bank-reviewed"
                          : "bank-review"
                      }
                    >
                      {transaction.status}
                    </small>
                  </article>
                ))}
              </div>
            </section>
            <aside className="panel receipt-register">
              <div className="panel-heading">
                <div>
                  <span>Expense evidence</span>
                  <h3>Receipts</h3>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => receiptInput.current?.click()}
                  aria-label="Upload receipt"
                  title="Upload receipt"
                >
                  <Upload size={16} />
                </button>
                <input
                  ref={receiptInput}
                  type="file"
                  accept="image/*,.pdf"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) setReceipts((current) => [file.name, ...current]);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              <div className="receipt-list">
                {receipts.map((receipt) => (
                  <div key={receipt}>
                    <ReceiptText size={16} />
                    <span>
                      <strong>{receipt}</strong>
                      <small>Available in this workspace</small>
                    </span>
                    <CheckCircle2 size={15} />
                  </div>
                ))}
              </div>
            </aside>
          </section>
          <section className="panel payment-follow-up">
            <div className="panel-heading">
              <div>
                <span>Invoicing and payments</span>
                <h3>Payment follow-up</h3>
              </div>
              <ReceiptText size={18} />
            </div>
            <div>
              {invoices.slice(0, 6).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onOpenCase(item.id)}
                >
                  <span>
                    <strong>
                      {invoiceNumber(item)} · {item.patient}
                    </strong>
                    <small>
                      {
                        data.doctors.find(
                          (doctor) => doctor.id === item.doctorId,
                        )?.name
                      }{" "}
                      · Due {formatDue(item)}
                    </small>
                  </span>
                  <PaymentBadge labCase={item} />
                  <b>{money(item.price - item.paid, data.currency)}</b>
                  <ChevronRight size={15} />
                </button>
              ))}
              {!invoices.length && (
                <div className="empty-block">
                  <CheckCircle2 size={22} />
                  <p>Every invoice in this period is paid.</p>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="panel connect-empty">
          <WalletCards size={30} />
          <h3>Connect a bank feed</h3>
          <p>
            Link a bank feed here when your financial integration is ready.
          </p>
        </section>
      )}
    </div>
  );
}

export function ReportingWorkspace({
  data,
  period,
  start,
  onExport,
}: Pick<AccountingWorkspaceProps, "data" | "period" | "start" | "onExport">) {
  const cases = data.cases.filter((item) => item.receivedDate >= start);
  const payments = data.payments.filter(
    (item) => item.date.slice(0, 10) >= start,
  );
  const expenses = data.expenses.filter((item) => item.date >= start);
  const revenue = cases.reduce((sum, item) => sum + item.price, 0);
  const collections = payments.reduce((sum, item) => sum + item.amount, 0);
  const spend = expenses.reduce((sum, item) => sum + item.amount, 0);
  const receivables = data.cases.reduce(
    (sum, item) => sum + item.price - item.paid,
    0,
  );
  const stockValue = data.materials.reduce(
    (sum, item) => sum + item.stock * item.cost,
    0,
  );
  const reports = [
    {
      title: "Profit and loss",
      description: "Revenue less operating expenses for the selected period.",
      value: revenue - spend,
      rows: [
        ["Revenue", revenue],
        ["Operating expenses", -spend],
        ["Net income", revenue - spend],
      ],
    },
    {
      title: "Cash flow",
      description: "Cash collected and spent during the selected period.",
      value: collections - spend,
      rows: [
        ["Customer collections", collections],
        ["Operating expenses", -spend],
        ["Net cash movement", collections - spend],
      ],
    },
    {
      title: "Balance snapshot",
      description: "A simple operational balance view for the workspace.",
      value: receivables + stockValue,
      rows: [
        ["Accounts receivable", receivables],
        ["Inventory at cost", stockValue],
        ["Estimated operating assets", receivables + stockValue],
      ],
    },
  ];
  return (
    <div className="accounting-module-view reporting-workspace">
      <section className="accounting-toolbar">
        <div>
          <strong>Financial reports</strong>
          <small>
            Reporting for{" "}
            {period === "all" ? "all time" : `this ${period}`}.
          </small>
        </div>
        <button className="secondary-button" type="button" onClick={onExport}>
          <FileDown size={16} />
          Export accounting PDF
        </button>
      </section>
      <section className="report-card-grid">
        {reports.map((report) => (
          <article className="panel report-card" key={report.title}>
            <div className="panel-heading">
              <div>
                <span>Standard report</span>
                <h3>{report.title}</h3>
              </div>
              <BarChart3 size={18} />
            </div>
            <p>{report.description}</p>
            <strong className={report.value < 0 ? "negative" : "positive"}>
              {money(report.value, data.currency)}
            </strong>
            <div>
              {report.rows.map(([label, value]) => (
                <span key={label as string}>
                  <small>{label}</small>
                  <b className={(value as number) < 0 ? "negative" : ""}>
                    {(value as number) < 0 ? "−" : ""}
                    {money(Math.abs(value as number), data.currency)}
                  </b>
                </span>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export function PayrollWorkspace({
  data,
  period,
}: Pick<AccountingWorkspaceProps, "data" | "period">) {
  const [prepared, setPrepared] = useState(false);
  const staff = data.staff.filter((member) => member.active !== false);
  const payroll = staff.map((member, index) => {
    const hourlyRate = 3.5 + (index % 3) * 0.75;
    const hours = member.role.includes("Admin") ? 176 : 160;
    const gross = hourlyRate * hours;
    const withholding = gross * 0.05;
    return { member, hours, gross, withholding, net: gross - withholding };
  });
  const grossTotal = payroll.reduce((sum, item) => sum + item.gross, 0);
  const withholdingTotal = payroll.reduce(
    (sum, item) => sum + item.withholding,
    0,
  );
  const netTotal = payroll.reduce((sum, item) => sum + item.net, 0);
  return (
    <div className="accounting-module-view payroll-workspace">
      <section className="accounting-toolbar">
        <div>
          <strong>Payroll planner</strong>
          <small>
            Review payroll figures before finalizing payroll.
          </small>
        </div>
        <button
          className={prepared ? "secondary-button" : "primary-button"}
          type="button"
          onClick={() => setPrepared((current) => !current)}
        >
          {prepared ? <CheckCircle2 size={16} /> : <WalletCards size={16} />}
          {prepared ? "Payroll prepared" : "Prepare payroll"}
        </button>
      </section>
      <section className="metric-grid payroll-metrics">
        <Metric
          icon={UsersRound}
          label="Team members"
          value={payroll.length}
          hint="Included in this pay run"
          tone="neutral"
        />
        <Metric
          icon={WalletCards}
          label="Gross wages"
          value={money(grossTotal, data.currency)}
          hint={`${period === "all" ? "Current" : `This ${period}`} pay run`}
          tone="blue"
        />
        <Metric
          icon={ArrowDownRight}
          label="Estimated withholding"
          value={money(withholdingTotal, data.currency)}
          hint="Planning estimate only"
          tone="amber"
        />
        <Metric
          icon={CheckCircle2}
          label="Net payroll"
          value={money(netTotal, data.currency)}
          hint={prepared ? "Ready for approval" : "Not yet prepared"}
          tone="green"
        />
      </section>
      <section className="panel payroll-table">
        <div className="panel-heading">
          <div>
            <span>Pay run</span>
            <h3>Team wage planning</h3>
          </div>
          <small>{prepared ? "Prepared locally" : "Draft"}</small>
        </div>
        <div className="payroll-row payroll-head">
          <span>Team member</span>
          <span>Hours</span>
          <span>Gross</span>
          <span>Withholding</span>
          <span>Net pay</span>
        </div>
        {payroll.map((entry) => (
          <div className="payroll-row" key={entry.member.id}>
            <span>
              <Avatar member={entry.member} small />
              <strong>
                {entry.member.name}
                <small>{entry.member.role}</small>
              </strong>
            </span>
            <span>{entry.hours}h</span>
            <span>{money(entry.gross, data.currency)}</span>
            <span>{money(entry.withholding, data.currency)}</span>
            <b>{money(entry.net, data.currency)}</b>
          </div>
        ))}
        <div className="payroll-row payroll-total">
          <span>Total</span>
          <span></span>
          <span>{money(grossTotal, data.currency)}</span>
          <span>{money(withholdingTotal, data.currency)}</span>
          <b>{money(netTotal, data.currency)}</b>
        </div>
      </section>
    </div>
  );
}

export function InventoryView({
  data,
  canManage,
  canViewCosts,
  onAdd,
  onAdjust,
}: {
  data: OraData;
  canManage: boolean;
  canViewCosts: boolean;
  onAdd: () => void;
  onAdjust: (id: string) => void;
}) {
  const inventoryValue = data.materials.reduce(
    (sum, item) => sum + item.stock * item.cost,
    0,
  );
  const low = data.materials.filter((item) => item.stock <= item.lowStock);
  return (
    <div className="inventory-view">
      <section className="inventory-summary">
        <div>
          <Boxes size={20} />
          <span>
            <small>Materials</small>
            <strong>{data.materials.length}</strong>
          </span>
        </div>
        <div>
          <AlertTriangle size={20} />
          <span>
            <small>Low stock</small>
            <strong>{low.length}</strong>
          </span>
        </div>
        {canViewCosts && (
          <div>
            <CircleDollarSign size={20} />
            <span>
              <small>Estimated stock value</small>
              <strong>{money(inventoryValue, data.currency)}</strong>
            </span>
          </div>
        )}
        {canManage && (
          <button className="primary-button" type="button" onClick={onAdd}>
            <PackagePlus size={17} />
            Add material
          </button>
        )}
      </section>
      <section className="panel table-panel">
        <div className="section-toolbar">
          <div>
            <h2>Material stock</h2>
            <p>
              Usage recorded on a case automatically reduces the available
              quantity.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Category</th>
                <th>On hand</th>
                <th>Low at</th>
                <th>Batch</th>
                <th>Supplier</th>
                <th>Expiry</th>
                {canManage && <th />}
              </tr>
            </thead>
            <tbody>
              {data.materials.map((item) => {
                const isLow = item.stock <= item.lowStock;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                      {canViewCosts && (
                        <small>
                          {money(item.cost, data.currency)} per{" "}
                          {item.unit.replace(/s$/, "")}
                        </small>
                      )}
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <div className={`stock-level ${isLow ? "low" : ""}`}>
                        <span>
                          <i
                            style={{
                              width: `${Math.min(100, (item.stock / Math.max(item.lowStock * 2, 1)) * 100)}%`,
                            }}
                          />
                        </span>
                        <strong>
                          {item.stock} {item.unit}
                        </strong>
                      </div>
                    </td>
                    <td>
                      {item.lowStock} {item.unit}
                    </td>
                    <td>{item.batch}</td>
                    <td>{item.supplier}</td>
                    <td>
                      {formatDate(item.expiry, {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      })}
                    </td>
                    {canManage && (
                      <td>
                        <button
                          className="secondary-button compact"
                          type="button"
                          onClick={() => onAdjust(item.id)}
                        >
                          Adjust
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel usage-panel">
        <div className="panel-heading">
          <div>
            <span>Inventory ledger</span>
            <h3>Recent movements</h3>
          </div>
          <History size={18} />
        </div>
        <div className="usage-log">
          {data.inventoryLogs.slice(0, 8).map((log) => {
            const material = data.materials.find(
              (item) => item.id === log.materialId,
            );
            const labCase = data.cases.find((item) => item.id === log.caseId);
            return (
              <div key={log.id}>
                <span
                  className={`movement-icon ${log.quantity > 0 ? "in" : "out"}`}
                >
                  {log.quantity > 0 ? (
                    <ArrowUpRight size={16} />
                  ) : (
                    <ArrowDownRight size={16} />
                  )}
                </span>
                <span>
                  <strong>{material?.name}</strong>
                  <small>
                    {labCase ? `${labCase.caseNumber} · ` : ""}
                    {log.note} · {formatDateTime(log.date)}
                  </small>
                </span>
                <b className={log.quantity > 0 ? "positive" : "negative"}>
                  {log.quantity > 0 ? "+" : ""}
                  {log.quantity} {material?.unit}
                </b>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function TeamView({
  data,
  activeStaff,
  onAdd,
  onEdit,
  onAccount,
  onRemove,
  onStatement,
}: {
  data: OraData;
  activeStaff: StaffMember;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onAccount: (id: string) => void;
  onRemove: (member: StaffMember) => void;
  onStatement: (id: string) => void;
}) {
  const canManageTeam = hasPermission(data, activeStaff, "team_manage");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  return (
    <div className="team-view">
      <section className="section-toolbar">
        <div>
          <h2>Team performance</h2>
          <p>
            Case handling, specialties and access are measured from the recorded
            work log.
          </p>
        </div>
        {canManageTeam && (
          <button className="primary-button" type="button" onClick={onAdd}>
            <Plus size={17} />
            Add staff member
          </button>
        )}
      </section>
      <section className="team-grid performance-grid">
        {data.staff
          .filter((member) => member.active !== false)
          .map((member) => {
            const histories = data.cases.flatMap((labCase) =>
              labCase.history
                .filter(
                  (entry) =>
                    entry.staffId === member.id ||
                    entry.toStaffId === member.id,
                )
                .map((entry) => ({ ...entry, labCase })),
            );
            const handled = new Set(histories.map((entry) => entry.labCase.id))
              .size;
            const completed = histories.filter(
              (entry) =>
                entry.action === "status" || entry.action === "quality",
            ).length;
            const current = data.cases.filter(
              (labCase) =>
                !labCase.archived &&
                labCase.assignedTo === member.id &&
                labCase.status !== "Closed",
            ).length;
            const closed = new Set(
              histories
                .filter((entry) => entry.labCase.status === "Closed")
                .map((entry) => entry.labCase.id),
            ).size;
            const roleLabel = staffRoles(data, member)
              .map((role) => role.name)
              .join(" · ");
            return (
              <article className="team-card performance-card" key={member.id}>
                <header
                  className="team-card-header-toggle"
                  onClick={() =>
                    setExpandedMemberId((current) =>
                      current === member.id ? null : member.id,
                    )
                  }
                >
                  <Avatar member={member} />
                  <span>
                    <h3>{member.name}</h3>
                    <p>{roleLabel || member.role}</p>
                  </span>
                  {member.id === activeStaff.id && <em>Signed in</em>}
                </header>
                <div className={`employee-details ${expandedMemberId === member.id ? "expanded" : ""}`}>
                  <button
                    type="button"
                    className="employee-details-summary"
                    aria-label={`Toggle ${member.name}'s details`}
                    aria-expanded={expandedMemberId === member.id}
                    onClick={() => {
                      setExpandedMemberId((current) =>
                        current === member.id ? null : member.id,
                      );
                    }}
                  >
                    <span className="staff-kpis">
                      <span>
                        <small>Handled</small>
                        <strong>{handled}</strong>
                      </span>
                      <span>
                        <small>Steps done</small>
                        <strong>{completed}</strong>
                      </span>
                      <span>
                        <small>Closed</small>
                        <strong>{closed}</strong>
                      </span>
                      <span>
                        <small>Active</small>
                        <strong>{current}</strong>
                      </span>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                  <div className="employee-details-content">
                    <div className="specialty-tags team-role-tags">
                      {staffRoles(data, member).map((role) => (
                        <span
                          className="team-role-tag"
                          key={role.id}
                          style={{
                            borderColor: role.color,
                            backgroundColor: role.color,
                            color: "#ffffff",
                          }}
                        >
                          {role.name}
                        </span>
                      ))}
                      {!staffRoles(data, member).length && (
                        <small>No roles assigned</small>
                      )}
                    </div>
                    <footer>
                      <button
                        className="secondary-button compact"
                        type="button"
                        onClick={() => onStatement(member.id)}
                      >
                        <BarChart3 size={15} />
                        Work statement
                      </button>
                      {canManageTeam && (
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => onAccount(member.id)}
                          aria-label={`Manage ${member.name}'s login`}
                          title="Manage login"
                        >
                          <KeyRound size={16} />
                        </button>
                      )}
                      {(canManageTeam || member.id === activeStaff.id) && (
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => onEdit(member.id)}
                          aria-label={`Edit ${member.name}`}
                          title="Edit profile"
                        >
                          <UserPen size={16} />
                        </button>
                      )}
                      {canManageTeam && member.id !== activeStaff.id && (
                        <button
                          className="icon-button danger-icon"
                          type="button"
                          onClick={() => onRemove(member)}
                          aria-label={`Remove ${member.name}`}
                          title="Remove user"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </footer>
                  </div>
                </div>
              </article>
            );
          })}
      </section>
    </div>
  );
}

export function SettingsViewV2({
  data,
  activeStaff,
  authUser,
  onUpdate,
  onAddService,
  onAddCategory,
  onRenameService,
  onRenameCategory,
  onRemoveService,
  onRemoveCategory,
  onAddRole,
  onEditRole,
  onRemoveRole,
  onExport,
  onImport,
}: {
  data: OraData;
  activeStaff: StaffMember;
  authUser: AuthUser | null;
  onUpdate: (updater: DataUpdater) => void;
  onAddService: (name: string, defaultPrice: number) => boolean;
  onAddCategory: (name: string) => boolean;
  onRenameService: (oldName: string, newName: string) => boolean;
  onRenameCategory: (oldName: string, newName: string) => boolean;
  onRemoveService: (name: string) => void;
  onRemoveCategory: (name: string) => void;
  onAddRole: () => void;
  onEditRole: (id: string) => void;
  onRemoveRole: (role: RoleDefinition) => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const catalogAccess = hasPermission(data, activeStaff, "catalog_manage");
  const backupAccess = hasPermission(data, activeStaff, "backup_manage");
  const settingsAccess =
    hasPermission(data, activeStaff, "role_manage") ||
    hasPermission(data, activeStaff, "catalog_manage");
  const workflowAccess = activeStaff.roleIds.includes("role-admin");
  return (
    <div className="settings-view">
      {settingsAccess && (
        <SettingsAccordion title="Sidebar branding">
          <BrandingEditor data={data} onUpdate={onUpdate} hideHeading />
        </SettingsAccordion>
      )}
      {catalogAccess && (
        <SettingsAccordion title="Service and material catalogs">
          <CatalogEditor
            data={data}
            onAddService={onAddService}
            onAddCategory={onAddCategory}
            onRenameService={onRenameService}
            onRenameCategory={onRenameCategory}
            onRemoveService={onRemoveService}
            onRemoveCategory={onRemoveCategory}
            hideHeading
          />
        </SettingsAccordion>
      )}
      {workflowAccess && (
        <SettingsAccordion title="Case stage order">
          <WorkflowOrderEditor data={data} onUpdate={onUpdate} hideHeading />
        </SettingsAccordion>
      )}
      {hasPermission(data, activeStaff, "role_manage") && (
        <SettingsAccordion
          title="Roles, permissions and specialties"
          action={
            <button className="primary-button compact" type="button" onClick={onAddRole}>
              <Plus size={15} />
              New role
            </button>
          }
        >
          <RoleManagement
            data={data}
            onAdd={onAddRole}
            onEdit={onEditRole}
            onRemove={onRemoveRole}
            hideHeading
          />
        </SettingsAccordion>
      )}
      <AccountSecurityPanel authUser={authUser} />
      {backupAccess && (
        <section className="settings-band">
          <div className="settings-icon">
            <DatabaseBackup size={20} />
          </div>
          <div>
            <h3>Workspace backup</h3>
            <p>
              Export or restore the current workspace as a JSON file.
            </p>
          </div>
          <div className="button-group">
            <button
              className="secondary-button"
              type="button"
              onClick={onImport}
            >
              <Upload size={16} />
              Restore
            </button>
            <button className="primary-button" type="button" onClick={onExport}>
              <Download size={16} />
              Export backup
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function RoleManagement({
  data,
  onAdd,
  onEdit,
  onRemove,
  hideHeading = false,
}: {
  data: OraData;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onRemove: (role: RoleDefinition) => void;
  hideHeading?: boolean;
}) {
  return (
    <section className="panel role-management">
      {!hideHeading && <div className="panel-heading">
        <div>
          <span>Access control</span>
          <h3>Roles, permissions and specialties</h3>
        </div>
        <button className="primary-button compact" type="button" onClick={onAdd}>
          <Plus size={15} />
          New role
        </button>
      </div>}
      <div className="role-grid">
        {data.roles.map((role) => (
          <article className="role-card" key={role.id}>
            <header>
              <span style={{ background: role.color }} />
              <div>
                <h4>{role.name}</h4>
                <small>
                  {data.staff.filter((member) => member.active !== false && member.roleIds.includes(role.id)).length} members
                </small>
              </div>
              <div>
                <button className="icon-button" type="button" onClick={() => onEdit(role.id)} aria-label={`Edit ${role.name}`} title="Edit role">
                  <Pencil size={15} />
                </button>
                <button className="icon-button danger-icon" type="button" onClick={() => onRemove(role)} aria-label={`Delete ${role.name}`} title="Delete role">
                  <Trash2 size={15} />
                </button>
              </div>
            </header>
            <p>{role.permissions.length} permissions</p>
            <div className="specialty-tags">
              {role.specialties.map((stage) => <span key={stage}>{stage}</span>)}
              {!role.specialties.length && <small>No workflow specialties</small>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsAccordion({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`settings-accordion ${open ? "expanded" : ""}`}>
      <header>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          <span>{title}</span>
          <ChevronRight size={17} />
        </button>
        {open && action && <div className="settings-accordion-action">{action}</div>}
      </header>
      <div className="expand-shell">
        <div>{children}</div>
      </div>
    </section>
  );
}

function AccountSecurityPanel({ authUser }: { authUser: AuthUser | null }) {
  const [enrollment, setEnrollment] = useState<{
    qrCode: string;
    manualKey: string;
  } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function begin() {
    setBusy(true);
    setError("");
    window.setTimeout(() => {
      setEnrollment({ qrCode: "", manualKey: "DEMO-AUTHENTICATOR-KEY" });
      setBusy(false);
    }, 120);
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const code = String(new FormData(event.currentTarget).get("code"));
    if (!/^\d{6}$/.test(code)) {
      setError("Enter a valid six-digit code.");
      setBusy(false);
      return;
    }
    setRecoveryCodes(["DEMO-ORA-001", "DEMO-ORA-002", "DEMO-ORA-003"]);
    setBusy(false);
  }
  const enabled = Boolean(authUser?.mfaEnabled || recoveryCodes);
  return (
    <>
      <section className="settings-band">
        <div className="settings-icon">
          <LockKeyhole size={20} />
        </div>
        <div>
          <h3>Account authenticator</h3>
          <p>
            {enabled
              ? "Your account uses an authenticator code at every sign-in."
              : authUser?.mfaRequired
                ? "Your role requires authenticator protection."
                : "Add an optional authenticator code to protect your personal login."}
          </p>
        </div>
        {enabled ? (
          <span className="mode-badge">
            <span />
            Enabled
          </span>
        ) : (
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={begin}
          >
            <ShieldCheck size={16} />
            Enable authenticator
          </button>
        )}
      </section>
      {enrollment && (
        <Modal
          title="Enable authenticator"
          subtitle="Scan the QR code, then confirm the current six-digit code."
          onClose={() => {
            setEnrollment(null);
            setError("");
          }}
        >
          <form className="auth-form mfa-form" onSubmit={confirm}>
            {!recoveryCodes ? (
              <>
                <div className="mfa-qr">
                  <img
                    src={enrollment.qrCode}
                    alt="Ora authenticator setup code"
                  />
                  <span>
                    <strong>Cannot scan?</strong>
                    <code>{enrollment.manualKey}</code>
                  </span>
                </div>
                <label className="field">
                  <span>Six-digit code</span>
                  <input
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    name="code"
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    required
                  />
                </label>
                {error && <p className="form-error">{error}</p>}
                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setEnrollment(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={busy}
                  >
                    <ShieldCheck size={16} />
                    Confirm
                  </button>
                </div>
              </>
            ) : (
              <div className="recovery-panel">
                <div>
                  <ShieldCheck size={20} />
                  <span>
                    <strong>Authenticator enabled</strong>
                    <p>
                      Store these one-use recovery codes somewhere private. They
                      will not be shown again.
                    </p>
                  </span>
                </div>
                <pre>{recoveryCodes.join("\n")}</pre>
                <button
                  className="primary-button full"
                  type="button"
                  onClick={() => {
                    setEnrollment(null);
                    window.location.reload();
                  }}
                >
                  I stored the codes
                </button>
              </div>
            )}
          </form>
        </Modal>
      )}
    </>
  );
}

function WorkflowOrderEditor({
  data,
  onUpdate,
  hideHeading = false,
}: {
  data: OraData;
  onUpdate: (updater: DataUpdater) => void;
  hideHeading?: boolean;
}) {
  const [mobileImpressionType, setMobileImpressionType] =
    useState<ImpressionType>("Oral Scan");
  const [draggingStage, setDraggingStage] = useState<{
    impressionType: ImpressionType;
    stage: CaseStatus;
  } | null>(null);
  const workflowTypes: ImpressionType[] = ["Oral Scan", "Physical Impression"];

  function moveStage(
    impressionType: ImpressionType,
    stage: CaseStatus,
    targetStage: CaseStatus,
  ) {
    onUpdate((current) => {
      const order = [...current.workflowOrder[impressionType]];
      const index = order.indexOf(stage);
      const target = order.indexOf(targetStage);
      if (
        index <= 0 ||
        target <= 0 ||
        index >= order.length - 1 ||
        target >= order.length - 1 ||
        index === target
      )
        return current;
      order.splice(index, 1);
      order.splice(target, 0, stage);
      return {
        ...current,
        workflowOrder: { ...current.workflowOrder, [impressionType]: order },
      };
    });
  }

  function resetWorkflow(impressionType: ImpressionType) {
    onUpdate((current) => ({
      ...current,
      workflowOrder: {
        ...current.workflowOrder,
        [impressionType]:
          impressionType === "Oral Scan"
            ? ["Received", "Approved", "Design", "Production", "Printing", "Finishing", "Build Up", "Glazing", "Quality Review", "Closed"]
            : ["Received", "Casting", "Approved", "Design", "Production", "Finishing", "Build Up", "Glazing", "Quality Review", "Closed"],
      },
    }));
  }

  function renderWorkflowColumn(impressionType: ImpressionType) {
    const workflow = data.workflowOrder[impressionType];
    return (
      <section
        className={`workflow-order-column ${impressionType === mobileImpressionType ? "mobile-workflow-active" : "mobile-workflow-hidden"}`}
        key={impressionType}
      >
        <header className="workflow-order-column-heading">
          <div>
            <span>{impressionType === "Oral Scan" ? "OS" : "PI"}</span>
            <h4>{impressionType}</h4>
          </div>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() => resetWorkflow(impressionType)}
          >
            <RotateCcw size={15} />
            Reset order
          </button>
        </header>
        <div className="workflow-order-list">
          {workflow.map((stage, index) => {
            const fixed = index === 0 || index === workflow.length - 1;
            const isDragging =
              draggingStage?.impressionType === impressionType &&
              draggingStage.stage === stage;
            return (
              <div
                key={stage}
                className={isDragging ? "dragging" : ""}
                onDragOver={(event) => {
                  if (!fixed && draggingStage?.impressionType === impressionType)
                    event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggingStage?.impressionType === impressionType)
                    moveStage(impressionType, draggingStage.stage, stage);
                  setDraggingStage(null);
                }}
              >
                <span className="workflow-order-number">{index + 1}</span>
                {fixed ? (
                  <span className="workflow-drag-placeholder" />
                ) : (
                  <button
                    className="workflow-drag-handle"
                    type="button"
                    draggable
                    onDragStart={() => setDraggingStage({ impressionType, stage })}
                    onDragEnd={() => setDraggingStage(null)}
                    aria-label={`Drag ${stage} to reorder`}
                    title="Drag to reorder"
                  >
                    <GripVertical size={17} />
                  </button>
                )}
                <StatusBadge status={stage} />
                {fixed && <small>Fixed</small>}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="panel workflow-settings-panel">
      {!hideHeading && <div className="panel-heading">
        <div>
          <span>Admin workflow setup</span>
          <h3>Case stage order</h3>
        </div>
        <ArrowUpDown size={18} />
      </div>}
      <div className="workflow-settings-toolbar workflow-mobile-toggle">
        <div className="segmented">
          {workflowTypes.map((impressionType) => (
            <button
              key={impressionType}
              type="button"
              className={mobileImpressionType === impressionType ? "active" : ""}
              onClick={() => setMobileImpressionType(impressionType)}
            >
              {impressionType}
            </button>
          ))}
        </div>
      </div>
      <p className="workflow-settings-note">
        Drag a stage by its handle to set the order. Received remains first and Closed remains last.
      </p>
      <div className="workflow-settings-columns">
        {workflowTypes.map(renderWorkflowColumn)}
      </div>
    </section>
  );
}

function BrandingEditor({
  data,
  onUpdate,
  hideHeading = false,
}: {
  data: OraData;
  onUpdate: (updater: DataUpdater) => void;
  hideHeading?: boolean;
}) {
  const [title, setTitle] = useState(data.branding.title);
  const [subtitle, setSubtitle] = useState(data.branding.subtitle);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const cropWindowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(
    null,
  );
  function chooseLogo(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSource(String(reader.result));
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
    };
    reader.readAsDataURL(file);
  }
  function saveCrop() {
    if (!cropSource) return;
    const image = new Image();
    image.onload = () => {
      const outputSize = 320;
      const previewSize = cropWindowRef.current?.clientWidth || 310;
      const containScale = Math.min(
        outputSize / image.naturalWidth,
        outputSize / image.naturalHeight,
      );
      const width = image.naturalWidth * containScale * zoom;
      const height = image.naturalHeight * containScale * zoom;
      const x = (outputSize - width) / 2 + (offsetX * outputSize) / previewSize;
      const y =
        (outputSize - height) / 2 + (offsetY * outputSize) / previewSize;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, outputSize, outputSize);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, x, y, width, height);
      const logo = canvas.toDataURL("image/png");
      onUpdate((current) => ({
        ...current,
        branding: { ...current.branding, logo },
      }));
      setCropSource(null);
    };
    image.src = cropSource;
  }
  return (
    <>
      <section className="panel branding-panel">
        {!hideHeading && <div className="panel-heading">
          <div>
            <span>Workspace identity</span>
            <h3>Sidebar branding</h3>
          </div>
          <Pencil size={18} />
        </div>}
        <div className="branding-editor">
          <div className="branding-preview">
            {data.branding.logo ? (
              <span
                className="brand-mark custom-logo"
                style={{ backgroundImage: `url("${data.branding.logo}")` }}
              />
            ) : (
              <span className="brand-mark">
                {title.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span>
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Subtitle</span>
              <input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
              />
            </label>
          </div>
          <div className="button-group">
            <label className="secondary-button">
              <Upload size={16} />
              Choose logo
              <input
                className="hidden-input"
                type="file"
                accept="image/*"
                onChange={(event) => chooseLogo(event.target.files?.[0])}
              />
            </label>
            {data.branding.logo && (
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  onUpdate((current) => ({
                    ...current,
                    branding: { ...current.branding, logo: "" },
                  }))
                }
              >
                Remove logo
              </button>
            )}
            <button
              className="primary-button"
              type="button"
              onClick={() =>
                onUpdate((current) => ({
                  ...current,
                  branding: {
                    ...current.branding,
                    title: title.trim() || "Ora",
                    subtitle: subtitle.trim() || "Dental Lab",
                  },
                }))
              }
            >
              Save branding
            </button>
          </div>
        </div>
      </section>
      {cropSource && (
        <Modal
          title="Position workspace logo"
          subtitle="Drag the image to position it, then adjust the zoom if needed."
          onClose={() => setCropSource(null)}
        >
          <div className="logo-cropper">
            <div
              className="crop-window"
              ref={cropWindowRef}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragRef.current = {
                  pointerId: event.pointerId,
                  x: event.clientX,
                  y: event.clientY,
                };
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                setOffsetX((value) => value + event.clientX - drag.x);
                setOffsetY((value) => value + event.clientY - drag.y);
                dragRef.current = {
                  ...drag,
                  x: event.clientX,
                  y: event.clientY,
                };
              }}
              onPointerUp={(event) => {
                if (dragRef.current?.pointerId === event.pointerId)
                  dragRef.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
            >
              <img
                draggable={false}
                src={cropSource}
                alt="Logo position preview"
                style={{
                  transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
                }}
              />
              <span>Drag to position</span>
            </div>
            <label className="field zoom-control">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="modal-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setCropSource(null)}
            >
              Cancel
            </button>
            <button className="primary-button" type="button" onClick={saveCrop}>
              Use logo
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CatalogEditor({
  data,
  onAddService,
  onAddCategory,
  onRenameService,
  onRenameCategory,
  onRemoveService,
  onRemoveCategory,
  hideHeading = false,
}: {
  data: OraData;
  onAddService: (name: string, defaultPrice: number) => boolean;
  onAddCategory: (name: string) => boolean;
  onRenameService: (oldName: string, newName: string) => boolean;
  onRenameCategory: (oldName: string, newName: string) => boolean;
  onRemoveService: (name: string) => void;
  onRemoveCategory: (name: string) => void;
  hideHeading?: boolean;
}) {
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState(0);
  const [categoryName, setCategoryName] = useState("");
  const [editingService, setEditingService] = useState<string | null>(null);
  const [serviceEditName, setServiceEditName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryEditName, setCategoryEditName] = useState("");
  const finishServiceEdit = () => {
    if (editingService && onRenameService(editingService, serviceEditName))
      setEditingService(null);
  };
  const finishCategoryEdit = () => {
    if (editingCategory && onRenameCategory(editingCategory, categoryEditName))
      setEditingCategory(null);
  };
  return (
    <section className="panel catalog-panel">
      {!hideHeading && <div className="panel-heading">
        <div>
          <span>Input setup</span>
          <h3>Service and material catalogs</h3>
        </div>
        <Settings size={18} />
      </div>}
      <div className="catalog-columns">
        <div>
          <div className="catalog-heading">
            <span>
              <Stethoscope size={17} />
              Service types
            </span>
            <small>Added to every doctor&apos;s price list</small>
          </div>
          <div className="catalog-tags">
            {data.serviceTypes.map((service) =>
              editingService === service ? (
                <span className="catalog-tag editing" key={service}>
                  <span className="catalog-card-copy">
                    <input
                      autoFocus
                     
                      value={serviceEditName}
                      onChange={(event) =>
                        setServiceEditName(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") finishServiceEdit();
                        if (event.key === "Escape") setEditingService(null);
                      }}
                      aria-label={`Rename ${service}`}
                    />
                    <strong>Service type</strong>
                  </span>
                  <button
                    className="catalog-save-button"
                    type="button"
                    onClick={finishServiceEdit}
                    aria-label={`Save ${service}`}
                    title="Save name"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingService(null)}
                    aria-label="Cancel rename"
                    title="Cancel"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <span className="catalog-tag" key={service}>
                  <span className="catalog-card-copy">
                    <small>{service}</small>
                    <strong>Service type</strong>
                  </span>
                  <button
                    className="catalog-edit-button"
                    type="button"
                    onClick={() => {
                      setEditingService(service);
                      setServiceEditName(service);
                    }}
                    aria-label={`Edit ${service}`}
                    title="Edit service name"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="catalog-delete-button"
                    type="button"
                    onClick={() => onRemoveService(service)}
                    aria-label={`Delete ${service}`}
                    title="Delete service"
                  >
                    <X size={12} />
                  </button>
                </span>
              ),
            )}
          </div>
          <form
            className="catalog-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (onAddService(serviceName, servicePrice)) {
                setServiceName("");
                setServicePrice(0);
              }
            }}
          >
            <input
             
              value={serviceName}
              onChange={(event) => setServiceName(event.target.value)}
              placeholder="New service type"
              required
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={servicePrice}
              onChange={(event) => setServicePrice(Number(event.target.value))}
              aria-label="Default price"
              placeholder="Default price"
            />
            <button className="primary-button compact" type="submit">
              <Plus size={15} />
              Add
            </button>
          </form>
        </div>
        <div>
          <div className="catalog-heading">
            <span>
              <Boxes size={17} />
              Material types
            </span>
            <small>Used to organize inventory materials</small>
          </div>
          <div className="catalog-tags">
            {data.materialCategories.map((category) =>
              editingCategory === category ? (
                <span className="catalog-tag editing" key={category}>
                  <span className="catalog-card-copy">
                    <input
                      autoFocus
                     
                      value={categoryEditName}
                      onChange={(event) =>
                        setCategoryEditName(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") finishCategoryEdit();
                        if (event.key === "Escape") setEditingCategory(null);
                      }}
                      aria-label={`Rename ${category}`}
                    />
                    <strong>Material type</strong>
                  </span>
                  <button
                    className="catalog-save-button"
                    type="button"
                    onClick={finishCategoryEdit}
                    aria-label={`Save ${category}`}
                    title="Save name"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    aria-label="Cancel rename"
                    title="Cancel"
                  >
                    <X size={12} />
                  </button>
                </span>
              ) : (
                <span className="catalog-tag" key={category}>
                  <span className="catalog-card-copy">
                    <small>{category}</small>
                    <strong>Material type</strong>
                  </span>
                  <button
                    className="catalog-edit-button"
                    type="button"
                    onClick={() => {
                      setEditingCategory(category);
                      setCategoryEditName(category);
                    }}
                    aria-label={`Edit ${category}`}
                    title="Edit material type"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className="catalog-delete-button"
                    type="button"
                    onClick={() => onRemoveCategory(category)}
                    aria-label={`Delete ${category}`}
                    title="Delete material type"
                  >
                    <X size={12} />
                  </button>
                </span>
              ),
            )}
          </div>
          <form
            className="catalog-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (onAddCategory(categoryName)) setCategoryName("");
            }}
          >
            <input
             
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="New material type"
              required
            />
            <button className="primary-button compact" type="submit">
              <Plus size={15} />
              Add
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

type CaseDrawerProps = {
  data: OraData;
  labCase: LabCase;
  activeStaff: StaffMember;
  canArchive: boolean;
  canManageHold: boolean;
  onClose: () => void;
  onQr: () => void;
  onPrintJob: () => void;
  onPrintSticker: () => void;
  onStatus: (labCase: LabCase, status: CaseStatus) => void;
  onTake: (labCase: LabCase) => void;
  onRelease: (labCase: LabCase) => void;
  onArchive: (labCase: LabCase) => void;
  onRestore: (labCase: LabCase) => void;
  onSetHold: (labCase: LabCase, note: string) => void;
  onResumeHold: (labCase: LabCase) => void;
  onAssign: (labCase: LabCase, staffId: string) => void;
  onNote: (event: FormEvent<HTMLFormElement>, caseId: string) => void;
  onDoctorMessage: (event: FormEvent<HTMLFormElement>, caseId: string) => void;
  onApproveIntake: (labCase: LabCase) => void;
  onApprove: (event: FormEvent<HTMLFormElement>, labCase: LabCase) => void;
  onUsage: (event: FormEvent<HTMLFormElement>, labCase: LabCase) => void;
  onPayment: (event: FormEvent<HTMLFormElement>, labCase: LabCase) => void;
  onEdit: (event: FormEvent<HTMLFormElement>, labCase: LabCase) => void;
  onReviseUsage: (labCase: LabCase, usageId: string, quantity: number) => void;
  onRemoveUsage: (labCase: LabCase, usageId: string) => void;
};

function CaseDrawerV2({
  data,
  labCase,
  activeStaff,
  canArchive,
  canManageHold,
  onClose,
  onQr,
  onPrintJob,
  onPrintSticker,
  onStatus,
  onTake,
  onRelease,
  onArchive,
  onRestore,
  onSetHold,
  onResumeHold,
  onAssign,
  onNote,
  onDoctorMessage,
  onApproveIntake,
  onApprove,
  onUsage,
  onEdit,
  onReviseUsage,
  onRemoveUsage,
}: CaseDrawerProps) {
  const t = (value: string) => value;
  const [editing, setEditing] = useState(false);
  const [draftLines, setDraftLines] = useState<CaseServiceLine[]>(
    caseServiceLines(labCase),
  );
  const [draftDueDate, setDraftDueDate] = useState(labCase.dueDate);
  const [draftDueTime, setDraftDueTime] = useState(labCase.dueTime);
  const [draftAppointmentDate, setDraftAppointmentDate] = useState(
    labCase.appointmentDate ?? labCase.dueDate,
  );
  const [draftAppointmentTime, setDraftAppointmentTime] = useState(
    labCase.appointmentTime ?? labCase.dueTime,
  );
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  const assigned = data.staff.find((item) => item.id === labCase.assignedTo);
  const workflow = workflowForImpression(
    labCase.impressionType,
    data.workflowOrder,
  );
  const currentIndex = workflow.indexOf(labCase.status);
  const archived = Boolean(labCase.archived);
  const onHold = Boolean(labCase.onHold);
  const assignedToMe = labCase.assignedTo === activeStaff.id;
  const canEdit = hasPermission(data, activeStaff, "case_edit");
  const canAssign =
    !archived && !onHold && hasPermission(data, activeStaff, "case_assign");
  const canTake =
    !archived && !onHold && canHandleStage(data, activeStaff, labCase.status);
  const canMove =
    !archived &&
    !onHold &&
    assignedToMe &&
    hasPermission(data, activeStaff, "case_workflow");
  const canInspect =
    hasPermission(data, activeStaff, "case_qc") ||
    hasPermission(data, activeStaff, "case_assign");
  const canViewValue = hasPermission(data, activeStaff, "view_case_value");
  const materialAccess =
    !archived && !onHold && hasPermission(data, activeStaff, "material_usage");
  const qualityAccess =
    !archived &&
    !onHold &&
    assignedToMe &&
    labCase.status === "Quality Review" &&
    hasPermission(data, activeStaff, "case_qc");
  const lastStatusChange = [...labCase.history]
    .reverse()
    .find(
      (entry) => entry.action === "status" && entry.toStatus === labCase.status,
    );
  const canOptOut =
    assignedToMe &&
    lastStatusChange?.staffId === activeStaff.id &&
    canHandleStage(data, activeStaff, labCase.status);
  const editDoctorPrices = doctorPriceList(data, doctor);
  const editTotal = draftLines.reduce(
    (sum, line) => sum + line.units * line.unitPrice,
    0,
  );

  function setDraftLine(id: string, patch: Partial<CaseServiceLine>) {
    setDraftLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        className="case-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${labCase.caseNumber} details`}
      >
        <header className="drawer-header">
          <div>
            <span>
              {t("Case")} {labCase.caseNumber}
              <CaseTags labCase={labCase} />
              {isCaseOverdue(labCase) && (
                <em className="overdue-label">{t("Overdue")}</em>
              )}
            </span>
            <h2>{doctor?.name}</h2>
            <p>
              {labCase.patient} · {doctor?.clinic}
            </p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close case"
          >
            <X size={19} />
          </button>
        </header>
        <div className="case-drawer-quick-actions">
          {canEdit && (
            <button
              className="secondary-button compact case-action-icon"
              type="button"
              onClick={() => setEditing((value) => !value)}
              aria-label={editing ? "Close case editor" : "Edit case details"}
              title={editing ? "Close case editor" : "Edit case details"}
            >
              <Pencil size={15} />
              <span className="case-edit-label">{t("Edit")}</span>
            </button>
          )}
          {canArchive && (
            <button
              className="secondary-button compact"
              type="button"
              onClick={() =>
                archived ? onRestore(labCase) : onArchive(labCase)
              }
            >
              {archived ? <RotateCcw size={15} /> : <Archive size={15} />}
              {archived ? t("Restore") : t("Archive")}
            </button>
          )}
          {canEdit && (
            <button
              className="secondary-button compact"
              type="button"
              onClick={onPrintJob}
            >
              <Printer size={15} />
              {t("Job order")}
            </button>
          )}
          {canEdit && (
            <button
              className="secondary-button compact"
              type="button"
              onClick={onPrintSticker}
            >
              <Sticker size={15} />
              {t("Sticker")}
            </button>
          )}
          <button
            className="secondary-button compact"
            type="button"
            onClick={onQr}
          >
            <QrCode size={15} />
            {t("Case QR")}
          </button>
        </div>
        <div className="drawer-body">
          {labCase.intakeApprovalPending && (
            <section className="case-portal-approval">
              <span>
                <Stethoscope size={19} />
                <span>
                  <strong>{t("Doctor case awaiting approval")}</strong>
                  <small>
                    The doctor submitted this oral scan through their portal.
                    Accept it before the production workflow begins, or modify
                    its details and let the doctor know.
                  </small>
                </span>
              </span>
              {canArchive && (
                <span className="case-approval-actions">
                  <button
                    className="secondary-button compact"
                    type="button"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil size={15} />
                    Modify
                  </button>
                  <button
                    className="primary-button compact"
                    type="button"
                    onClick={() => onApproveIntake(labCase)}
                  >
                    <CheckCircle2 size={15} />
                    Approve case
                  </button>
                </span>
              )}
            </section>
          )}

          {editing ? (
            <form
              className="drawer-section case-edit-form"
              onSubmit={(event) => {
                onEdit(event, labCase);
                setEditing(false);
              }}
            >
              <input
                type="hidden"
                name="serviceLines"
                value={JSON.stringify(draftLines)}
              />
              <div className="section-title">
                <span>
                  <Pencil size={17} />
                  {t("Edit case details")}
                </span>
                <strong>
                  {canViewValue
                    ? money(editTotal, data.currency)
                    : `${draftLines.reduce((sum, line) => sum + line.units, 0)} units`}
                </strong>
              </div>
              <div className="form-grid">
                <label className="field span-2">
                  <span>{t("Doctor")}</span>
                  <select name="doctorId" defaultValue={labCase.doctorId}>
                    {data.doctors
                      .filter((item) => item.active !== false)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.clinic}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t("Patient")}</span>
                  <input
                    name="patient"
                    defaultValue={labCase.patient}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t("Patient reference")}</span>
                  <input
                    name="patientRef"
                    defaultValue={labCase.patientRef}
                    required
                  />
                </label>
                <label className="field">
                  <span>{t("Impression type")}</span>
                  <select
                    name="impressionType"
                    defaultValue={labCase.impressionType}
                  >
                    <option value="Oral Scan">{t("Oral Scan")}</option>
                    <option value="Physical Impression">{t("Physical Impression")}</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t("Priority")}</span>
                  <select name="priority" defaultValue={labCase.priority}>
                    <option>Normal</option>
                    <option>Rush</option>
                  </select>
                </label>
                <CompactDatePicker
                  name="dueDate"
                  label={t("Due date")}
                  value={draftDueDate}
                  onChange={setDraftDueDate}
                />
                <CompactTimePicker
                  name="dueTime"
                  label={t("Due time")}
                  value={draftDueTime}
                  onChange={setDraftDueTime}
                />
                <CompactDatePicker
                  name="appointmentDate"
                  label={t("Appointment date")}
                  value={draftAppointmentDate}
                  onChange={setDraftAppointmentDate}
                />
                <CompactTimePicker
                  name="appointmentTime"
                  label={t("Appointment time")}
                  value={draftAppointmentTime}
                  onChange={setDraftAppointmentTime}
                />
                <label className="field span-2">
                  <span>{t("Telegram reference")}</span>
                  <input
                    name="telegramRef"
                    defaultValue={labCase.telegramRef}
                  />
                </label>
              </div>
              <div className="service-line-list compact">
                {draftLines.map((line, index) => (
                  <div className="service-line-editor" key={line.id}>
                    <div className="service-line-head">
                      <strong>{t("Service")} {index + 1}</strong>
                      {draftLines.length > 1 && (
                        <button
                          className="icon-button danger"
                          type="button"
                          onClick={() =>
                            setDraftLines((current) =>
                              current.filter((item) => item.id !== line.id),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <div className="form-grid">
                      <label className="field">
                        <span>{t("Type")}</span>
                        <select
                          value={line.service}
                          onChange={(event) =>
                            setDraftLine(line.id, {
                              service: event.target.value,
                              unitPrice:
                                editDoctorPrices[event.target.value] ??
                                line.unitPrice,
                            })
                          }
                        >
                          {data.serviceTypes.map((item) => (
                            <option key={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>{t("Teeth / units")}</span>
                        <input
                          type="number"
                          min="1"
                          value={line.units}
                          onChange={(event) =>
                            setDraftLine(line.id, {
                              units: Math.max(
                                1,
                                Number(event.target.value) || 1,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t("Shade")}</span>
                        <input
                          value={line.shade}
                          onChange={(event) =>
                            setDraftLine(line.id, { shade: event.target.value })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>{t("Unit price")}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(event) =>
                            setDraftLine(line.id, {
                              unitPrice: Math.max(
                                0,
                                Number(event.target.value) || 0,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => {
                  const service = data.serviceTypes[0] ?? "Other";
                  setDraftLines((current) => [
                    ...current,
                    {
                      id: uid("service"),
                      service,
                      units: 1,
                      shade: "",
                      unitPrice: editDoctorPrices[service] ?? 0,
                    },
                  ]);
                }}
              >
                <Plus size={15} />
                {t("Add service")}
              </button>
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setEditing(false)}
                >
                  {t("Cancel")}
                </button>
                <button className="primary-button" type="submit">
                  {t("Save case details")}
                </button>
              </div>
            </form>
          ) : (
            <section className="case-summary">
              <div>
                <small>{t("Patient")}</small>
                <strong>
                  {labCase.patient} · {labCase.patientRef}
                </strong>
              </div>
              <div>
                <small>{t("Impression")}</small>
                <strong>{labCase.impressionType}</strong>
              </div>
              <div>
                <small>{t("Services")}</small>
                <strong>{caseServiceSummary(labCase)}</strong>
              </div>
              <div>
                <small>{t("total units")}</small>
                <strong>{caseTotalUnits(labCase)}</strong>
              </div>
              <div>
                <small>{t("Due")}</small>
                <strong>{formatDue(labCase)}</strong>
              </div>
              <div>
                <small>{t("Assigned")}</small>
                <strong className="assigned">
                  <Avatar member={assigned} small />
                  {assigned?.name ?? t("Unassigned")}
                </strong>
              </div>
              {labCase.telegramRef && (
                <div className="case-telegram-reference">
                  <small>{t("Telegram ref")}</small>
                  <strong>{labCase.telegramRef}</strong>
                </div>
              )}
            </section>
          )}

          {canAssign && labCase.status !== "Closed" && (
            <section className="assignment-strip">
              <span>
                <UserRoundCog size={18} />
                <span>
                  <strong>{t("Assign current stage")}</strong>
                  <small>
                    Only staff whose specialties include {labCase.status} are
                    listed.
                  </small>
                </span>
              </span>
              <select
                value={labCase.assignedTo}
                onChange={(event) => onAssign(labCase, event.target.value)}
              >
                <option value="" disabled>
                  {t("Choose team member")}
                </option>
                {data.staff
                  .filter((member) =>
                    canHandleStage(data, member, labCase.status),
                  )
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </section>
          )}
          {canTake && !assignedToMe && labCase.status !== "Closed" && (
            <section className="take-case-strip">
              <span>
                <UserRoundCog size={18} />
                <span>
                  <strong>
                    {assigned
                      ? `Take over from ${assigned.name}`
                      : "This case is ready to take"}
                  </strong>
                  <small>Your specialties include {labCase.status}.</small>
                </span>
              </span>
              <button
                className="primary-button compact"
                type="button"
                onClick={() => onTake(labCase)}
              >
                {t("Take case")}
              </button>
            </section>
          )}
          {canOptOut && labCase.status !== "Closed" && (
            <section className="release-case-strip">
              <span>
                <UserMinus size={18} />
                <span>
                  <strong>Hand off the next step</strong>
                  <small>
                    You can continue because this stage is also one of your
                    specialties.
                  </small>
                </span>
              </span>
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => onRelease(labCase)}
              >
                Opt out
              </button>
            </section>
          )}

          <section className="drawer-section">
            <div className="section-title">
              <span>
                <Gauge size={17} />
                {t("Workflow")}
              </span>
              <StatusBadge status={labCase.status} />
            </div>
            <div
              className="workflow-steps"
              style={{
                gridTemplateColumns: `repeat(${workflow.length}, minmax(70px, 1fr))`,
              }}
            >
              {workflow.map((status, index) => {
                const past = index < currentIndex;
                const future = index > currentIndex;
                const allowed = canMove && ((past && canInspect) || future);
                return (
                  <button
                    type="button"
                    disabled={!allowed}
                    className={`${past ? "done" : ""} ${status === labCase.status ? "current" : ""}`}
                    key={status}
                    onClick={() => onStatus(labCase, status)}
                    title={allowed ? `Move to ${status}` : status}
                  >
                    <span>{past ? <Check size={13} /> : index + 1}</span>
                    <small>{t(status)}</small>
                  </button>
                );
              })}
            </div>
            {!canMove && labCase.status !== "Closed" && (
              <p className="permission-hint workflow-hint">
                Take the case for its current specialty before changing the
                workflow.
              </p>
            )}
          </section>

          {canViewValue && (
            <section className="drawer-section financial-case">
              <div className="section-title">
                <span>
                  <BadgeDollarSign size={17} />
                  {t("Case value")}
                </span>
                <strong>{money(labCase.price, data.currency)}</strong>
              </div>
              {caseServiceLines(labCase).map((line) => (
                <div className="calculation-line" key={line.id}>
                  <span>
                    {line.service} · {line.units} units
                  </span>
                  <span>
                    {money(line.unitPrice * line.units, data.currency)}
                  </span>
                </div>
              ))}
            </section>
          )}

          {((canManageHold && !archived) || onHold) && (
            <section
              className={`drawer-section case-hold-section ${onHold ? "on-hold" : ""}`}
            >
              <div className="section-title">
                <span>
                  <AlertTriangle size={17} />
                  {t("Case hold")}
                </span>
                {onHold && <em>{t("On hold")}</em>}
              </div>
              {onHold ? (
                <div className="case-hold-note">
                  <strong>Production is paused</strong>
                  <p>{labCase.holdNote || "No hold note was added."}</p>
                  <small>
                    {labCase.holdBy
                      ? `${data.staff.find((member) => member.id === labCase.holdBy)?.name ?? "Ora admin"} placed this case on hold`
                      : "An Ora admin placed this case on hold"}
                    {labCase.holdAt ? ` · ${formatDateTime(labCase.holdAt)}` : ""}
                  </small>
                  {canManageHold && (
                    <button
                      className="secondary-button compact"
                      type="button"
                      onClick={() => onResumeHold(labCase)}
                    >
                      <RotateCcw size={15} />
                      {t("Resume case")}
                    </button>
                  )}
                </div>
              ) : (
                <form
                  className="case-hold-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const note = String(
                      new FormData(event.currentTarget).get("holdNote") ?? "",
                    ).trim();
                    onSetHold(labCase, note);
                  }}
                >
                  <textarea
                    className="compact-note-input"
                    name="holdNote"
                   
                    placeholder="Reason for putting this case on hold..."
                    rows={1}
                    onInput={(event) => {
                      const field = event.currentTarget;
                      field.style.height = "auto";
                      field.style.height = `${field.scrollHeight}px`;
                    }}
                    required
                  />
                  <button className="secondary-button compact danger" type="submit">
                    <AlertTriangle size={15} />
                    {t("Put case on hold")}
                  </button>
                </form>
              )}
            </section>
          )}

          <section className="drawer-section">
            <div className="section-title">
              <span>
                <Boxes size={17} />
                {t("Materials used")}
              </span>
              <small>{labCase.materialUsage.length} {t("entries")}</small>
            </div>
            <div className="material-usage-list">
              {labCase.materialUsage.map((usage) => {
                const material = data.materials.find(
                  (item) => item.id === usage.materialId,
                );
                const mayCorrect = usage.staffId === activeStaff.id || canEdit;
                return (
                  <form
                    key={usage.id}
                    onSubmit={(event) => {
                      event.preventDefault();
                      onReviseUsage(
                        labCase,
                        usage.id,
                        Number(
                          new FormData(event.currentTarget).get("quantity"),
                        ),
                      );
                    }}
                  >
                    <span>
                      <strong>{material?.name ?? "Material"}</strong>
                      <small>
                        {data.staff.find((item) => item.id === usage.staffId)
                          ?.name ?? "Ora staff"}{" "}
                        · {formatDateTime(usage.createdAt)}
                      </small>
                    </span>
                    <input
                      name="quantity"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={usage.quantity}
                      disabled={!mayCorrect}
                    />
                    <b>{material?.unit}</b>
                    {mayCorrect && (
                      <>
                        <button
                          className="icon-button"
                          type="submit"
                          title="Save corrected quantity"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          title="Remove usage"
                          onClick={() => onRemoveUsage(labCase, usage.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </form>
                );
              })}
              {!labCase.materialUsage.length && (
                <p>{t("No material usage recorded.")}</p>
              )}
            </div>
            {materialAccess && (
              <form
                className="inline-form usage-form"
                onSubmit={(event) => onUsage(event, labCase)}
              >
                <select name="materialId" required defaultValue="">
                  <option value="" disabled>
                    {t("Choose material")}
                  </option>
                  {data.materials.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {item.stock} {item.unit}
                    </option>
                  ))}
                </select>
                <input
                  name="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder={t("Qty")}
                  required
                />
                <button className="secondary-button compact" type="submit">
                  {t("Use")}
                </button>
              </form>
            )}
          </section>

          <section className="drawer-section case-history-section">
            <div className="section-title">
              <span>
                <History size={17} />
                {t("Handling log")}
              </span>
              <small>{labCase.history.length} {t("events")}</small>
            </div>
            <div className="case-history">
              {[...labCase.history].reverse().map((entry) => {
                const actor = data.staff.find(
                  (member) => member.id === entry.staffId,
                );
                const from = data.staff.find(
                  (member) => member.id === entry.fromStaffId,
                );
                const to = data.staff.find(
                  (member) => member.id === entry.toStaffId,
                );
                return (
                  <div key={entry.id}>
                    <Avatar member={actor} small />
                    <span>
                      <strong>{entry.label}</strong>
                      <small>
                        {actor?.name ?? "Ora staff"} ·{" "}
                        {formatDateTime(entry.date)}
                      </small>
                      {(from || to) && (
                        <p>
                          {from?.name ?? "Unassigned"} →{" "}
                          {to?.name ?? "Unassigned"}
                        </p>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="drawer-section doctor-case-messages">
            <div className="section-title">
              <span>
                <MessageSquareText size={17} />
                {t("Doctor conversation")}
              </span>
              <small>{labCase.doctorMessages?.length ?? 0}</small>
            </div>
            <p className="doctor-message-intro">
              Messages and files are shared with {doctor?.name ?? "the doctor"}{" "}
              through their portal.
            </p>
            <div className="doctor-message-list">
              {[...(labCase.doctorMessages ?? [])].reverse().map((message) => (
                <article key={message.id}>
                  <header>
                    <span className={message.author}>
                      <Stethoscope size={14} />
                    </span>
                    <div>
                      <strong>{message.authorName}</strong>
                      <small>{formatDateTime(message.createdAt)}</small>
                    </div>
                  </header>
                  {message.text && <p>{message.text}</p>}
                  {message.attachments.length > 0 && (
                    <div className="doctor-message-files">
                      {message.attachments.map((attachment) =>
                        attachment.type.startsWith("image/") ? (
                          <a
                            className="doctor-media-preview image"
                            key={attachment.id}
                            href={attachment.dataUrl}
                            download={attachment.name}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img src={attachment.dataUrl} alt={attachment.name} />
                            <span>
                              <strong>{attachment.name}</strong>
                              <small>Image · Open</small>
                            </span>
                          </a>
                        ) : attachment.type.startsWith("video/") ? (
                          <div className="doctor-media-preview video" key={attachment.id}>
                            <video controls preload="metadata" src={attachment.dataUrl} />
                            <a
                              href={attachment.dataUrl}
                              download={attachment.name}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {attachment.name}
                            </a>
                          </div>
                        ) : (
                          <a
                            key={attachment.id}
                            href={attachment.dataUrl}
                            download={attachment.name}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Paperclip size={14} />
                            <span>
                              <strong>{attachment.name}</strong>
                              <small>
                                {Math.max(1, Math.round(attachment.size / 1024))}{" "}
                                KB
                              </small>
                            </span>
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </article>
              ))}
              {!labCase.doctorMessages?.length && (
                <p className="empty-note">{t("No messages or files yet.")}</p>
              )}
            </div>
            {canArchive && (
              <form
                className="note-form doctor-reply-form"
                onSubmit={(event) => onDoctorMessage(event, labCase.id)}
              >
                <textarea
                  className="compact-note-input"
                 
                  name="message"
                  placeholder={t("Reply to the doctor...")}
                  rows={1}
                  onInput={(event) => {
                    const field = event.currentTarget;
                    field.style.height = "auto";
                    field.style.height = `${field.scrollHeight}px`;
                  }}
                  required
                />
                <button
                  className="primary-button compact"
                  type="submit"
                  aria-label="Send reply"
                  title="Send reply"
                >
                  <Send size={15} />
                </button>
              </form>
            )}
          </section>
          <section className="drawer-section">
            <div className="section-title">
              <span>
                <MessageSquareText size={17} />
                {t("Internal notes")}
              </span>
              <small>{labCase.notes.length}</small>
            </div>
            <div className="notes-list">
              {labCase.notes.map((note) => {
                const author = data.staff.find(
                  (item) => item.id === note.staffId,
                );
                return (
                  <div key={note.id}>
                    <Avatar member={author} small />
                    <span>
                      <strong>
                        {author?.name}
                        <small>{formatDateTime(note.createdAt)}</small>
                      </strong>
                      <p>{note.text}</p>
                    </span>
                  </div>
                );
              })}
              {!labCase.notes.length && (
                <p className="empty-note">No internal notes yet.</p>
              )}
            </div>
            {hasPermission(data, activeStaff, "case_notes") && (
              <form
                className="note-form"
                onSubmit={(event) => onNote(event, labCase.id)}
              >
                <textarea
                  className="compact-note-input"
                 
                  name="note"
                  placeholder={t("Add a note...")}
                  rows={1}
                  onInput={(event) => {
                    const field = event.currentTarget;
                    field.style.height = "auto";
                    field.style.height = `${field.scrollHeight}px`;
                  }}
                  required
                />
                <button className="primary-button compact" type="submit">
                  <Plus size={15} />
                  {t("Add note")}
                </button>
              </form>
            )}
          </section>
          <section className="drawer-section qc-section">
            <div className="section-title">
              <span>
                <ClipboardCheck size={17} />
                Quality Review
              </span>
              {labCase.qc ? (
                <span className="approval-state">
                  <CheckCircle2 size={16} />
                  Approved
                </span>
              ) : (
                <span className="pending-state">
                  <Clock3 size={16} />
                  {labCase.status === "Quality Review"
                    ? "Ready for review"
                    : "Upcoming"}
                </span>
              )}
            </div>
            {labCase.qc ? (
              <div className="approval-record">
                <ShieldCheck size={22} />
                <span>
                  <strong>
                    {
                      data.staff.find(
                        (item) => item.id === labCase.qc?.approvedBy,
                      )?.name
                    }
                  </strong>
                  <p>
                    {labCase.qc.note || "Final inspection approved."}
                  </p>
                  <small>{formatDateTime(labCase.qc.approvedAt)}</small>
                </span>
              </div>
            ) : labCase.status === "Quality Review" ? (
              <form onSubmit={(event) => onApprove(event, labCase)}>
                <textarea
                 
                  name="qcNote"
                  placeholder="Quality review note..."
                  rows={2}
                />
                <button
                  className="approve-button"
                  type="submit"
                  disabled={!qualityAccess}
                >
                  <ClipboardCheck size={17} />
                  Approve and close case
                </button>
                {!qualityAccess && (
                  <small className="permission-hint">
                    Take the case as a Quality Review specialist first.
                  </small>
                )}
              </form>
            ) : (
              <p className="quality-upcoming">
                The case must complete Glazing before final review.
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function CaseFinanceActions({
  labCase,
  canEdit,
  onInvoice,
  onPayment,
}: {
  labCase: LabCase;
  canEdit: boolean;
  onInvoice: () => void;
  onPayment: () => void;
}) {
  return (
    <div className="case-finance-actions">
      <PaymentBadge labCase={labCase} />
      <button
        className="secondary-button compact"
        type="button"
        onClick={onInvoice}
      >
        <Printer size={15} />
        Invoice
      </button>
      {canEdit && (
        <button
          className="primary-button compact"
          type="button"
          onClick={onPayment}
        >
          <BadgeDollarSign size={15} />
          Update payment
        </button>
      )}
    </div>
  );
}

function CaseQrModal({
  labCase,
  value,
  onClose,
}: {
  labCase: LabCase;
  value: string;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`Case ${labCase.caseNumber} QR`}
      subtitle="Scan this code from an authenticated Ora device to open the case."
      onClose={onClose}
    >
      <div className="case-qr-modal">
        <RoundedQrCode value={value} size={248} />
        <div>
          <strong>Case {labCase.caseNumber}</strong>
          <span>{labCase.patient || "Unnamed patient"}</span>
          <small>Ora staff access required</small>
        </div>
      </div>
      <div className="modal-actions case-qr-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => navigator.clipboard.writeText(value)}
        >
          {" "}
          <Copy size={16} />
          Copy link
        </button>
        <button className="primary-button" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function PaymentEditorModal({
  data,
  labCase,
  onClose,
  onRecord,
}: {
  data: OraData;
  labCase: LabCase;
  onClose: () => void;
  onRecord: (event: FormEvent<HTMLFormElement>, labCase: LabCase) => boolean;
}) {
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  const remaining = Math.max(0, labCase.price - labCase.paid);
  const [amount, setAmount] = useState(
    remaining > 0 ? remaining.toFixed(2) : "",
  );
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Bank">("Cash");
  const [account, setAccount] = useState("Undeposited Funds");
  const [currency, setCurrency] = useState<PaymentCurrency>("USD");
  const [exchangeRate, setExchangeRate] = useState("13000");
  const amountNumber = paymentAmountInUsd(amount, currency, exchangeRate);
  const isFullAmount =
    remaining > 0 && Math.abs(amountNumber - remaining) < 0.001;
  const canSubmit =
    Number.isFinite(amountNumber) &&
    Math.abs(amountNumber) >= 0.001 &&
    amountNumber <= remaining &&
    amountNumber >= -labCase.paid;
  function changeCurrency(nextCurrency: PaymentCurrency) {
    if (nextCurrency === currency) return;
    const usdAmount = paymentAmountInUsd(amount, currency, exchangeRate);
    const rate = Number(exchangeRate) || 13000;
    setAmount(nextCurrency === "SYP" ? String(Math.round(usdAmount * rate)) : usdAmount.toFixed(2));
    setCurrency(nextCurrency);
  }
  const reference = `PAY-${data.payments.length + 281}`;
  const history = data.payments
    .filter((item) => item.caseId === labCase.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <Modal
      title="Record case payment"
      subtitle={`${invoiceNumber(labCase)} · Case ${labCase.caseNumber} · ${doctor?.name ?? "Doctor not recorded"}`}
      onClose={onClose}
      wide
    >
      <div className="case-payment-editor">
        <form
          className="case-payment-form"
          onSubmit={(event) => {
            if (onRecord(event, labCase)) onClose();
          }}
        >
          <section className="case-payment-section">
            <h3>Invoice and amount</h3>
            <div className="case-payment-grid">
              <div className="case-payment-outstanding">
                <small>Outstanding amount</small>
                <strong>{money(remaining, data.currency)}</strong>
                <span>
                  {money(labCase.paid, data.currency)} paid of {money(labCase.price, data.currency)}
                </span>
              </div>
              <label className="field">
                <span>Amount received{currency === "SYP" ? " (SYP)" : " (US$)"}</span>
                <input
                  name="amount"
                  type="number"
                  min={currency === "SYP" ? undefined : -labCase.paid}
                  max={currency === "SYP" ? undefined : remaining}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>
              <button
                className={`case-payment-full ${isFullAmount ? "active" : ""}`}
                type="button"
                onClick={() => setAmount(currency === "SYP" ? String(Math.round(remaining * (Number(exchangeRate) || 13000))) : remaining.toFixed(2))}
                disabled={remaining <= 0}
              >
                <span>Receive full amount</span>
                <strong>{money(remaining, data.currency)}</strong>
              </button>
              <div className="case-payment-status">
                <small>Payment status</small>
                <PaymentBadge labCase={labCase} />
              </div>
            </div>
          </section>

          <section className="case-payment-section">
            <h3>Payment details</h3>
            <div className="case-payment-grid">
              <label className="field">
                <span>Payment date</span>
                <input
                  name="date"
                  type="date"
                  defaultValue={toISODate(new Date())}
                  required
                />
              </label>
              <label className="field">
                <span>Payment #</span>
                <input name="reference" defaultValue={reference} required />
              </label>
              <div className="case-payment-mode">
                <span>Payment mode</span>
                <div>
                  <button
                    className={paymentMode === "Cash" ? "active" : ""}
                    type="button"
                    onClick={() => {
                      setPaymentMode("Cash");
                    }}
                  >
                    <Banknote size={15} />
                    Cash
                  </button>
                  <button
                    className={paymentMode === "Bank" ? "active" : ""}
                    type="button"
                    onClick={() => {
                      setPaymentMode("Bank");
                    }}
                  >
                    <Landmark size={15} />
                    Bank
                  </button>
                </div>
                <input
                  name="method"
                  type="hidden"
                  value={paymentMode === "Cash" ? "Cash" : "Bank transfer"}
                />
              </div>
              <PaymentDepositFields
                account={account}
                currency={currency}
                onAccountChange={setAccount}
                onCurrencyChange={changeCurrency}
              />
              <PaymentExchangeRateFields amount={amount} currency={currency} exchangeRate={exchangeRate} onExchangeRateChange={setExchangeRate} />
              <label className="field span-2">
                <span>Notes</span>
                <textarea
                  name="note"
                  rows={3}
                  placeholder="Optional payment note"
                />
                <small>
                  Enter a negative amount only when correcting a payment
                  recorded by mistake.
                </small>
              </label>
            </div>
          </section>

          <div className="case-payment-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={!canSubmit}>
              <Plus size={16} />
              Record payment
            </button>
          </div>
        </form>

        <section className="case-payment-history">
          <h3>Payment history</h3>
          {history.map((item) => {
            const label =
              item.note === "Paid total adjusted" ||
              item.note === "Marked unpaid" ||
              item.note === "Marked paid in full"
                ? item.amount >= 0
                  ? "Payment received"
                  : "Payment correction"
                : item.note;
            return (
              <div key={item.id}>
                <span>
                  <strong>{label}</strong>
                  <small>
                    {formatDateTime(item.date)} · {item.reference ?? "No reference"} ·{" "}
                    {data.staff.find((member) => member.id === item.staffId)
                      ?.name ?? "Ora staff"}
                  </small>
                </span>
                <b className={item.amount >= 0 ? "positive" : "negative"}>
                  {item.amount >= 0 ? "+" : ""}
                  {money(item.amount, data.currency)}
                </b>
              </div>
            );
          })}
          {!history.length && <p>No payments recorded yet.</p>}
        </section>
      </div>
    </Modal>
  );
}

function InvoiceModal({
  data,
  labCase,
  onClose,
}: {
  data: OraData;
  labCase: LabCase;
  onClose: () => void;
}) {
  const doctor = data.doctors.find((item) => item.id === labCase.doctorId);
  return (
    <Modal
      title={`Invoice ${labCase.caseNumber}`}
      subtitle={invoiceNumber(labCase)}
      onClose={onClose}
      wide
    >
      <div className="document-preview invoice-document">
        <div className="document-head">
          <div className="brand-lockup large">
            <span className="brand-mark">O</span>
            <div>
              <strong>Ora</strong>
              <small>Dental Lab</small>
            </div>
          </div>
          <div>
            <span>Case invoice</span>
            <strong>{invoiceNumber(labCase)}</strong>
          </div>
        </div>
        <div className="invoice-meta">
          <span>
            <small>Doctor account</small>
            <strong>{doctor?.name}</strong>
            <p>{doctor?.clinic}</p>
          </span>
          <span>
            <small>Patient</small>
            <strong>{labCase.patient}</strong>
            <p>{labCase.patientRef}</p>
          </span>
          <span>
            <small>Case</small>
            <strong>{labCase.caseNumber}</strong>
          </span>
          <span>
            <small>Date</small>
            <strong>{formatDate(labCase.receivedDate)}</strong>
            <p>Due {formatDue(labCase)}</p>
          </span>
          <span>
            <small>Status</small>
            <PaymentBadge labCase={labCase} />
          </span>
        </div>
        <div className="invoice-explainer">
          <ReceiptText size={17} />
          <span>
            <strong>This invoice adds a charge to the doctor account.</strong>
            <small>
              Its paid and remaining amounts are shown directly below.
            </small>
          </span>
        </div>
        <button
          type="button"
          aria-disabled="true"
          tabIndex={-1}
          className={`invoice-acceptance ${labCase.invoiceAcceptedAt ? "accepted" : "pending"}`}
        >
          {labCase.invoiceAcceptedAt ? <Check size={16} /> : <Hourglass size={16} />}
          <span>
            <strong>
              {labCase.invoiceAcceptedAt
                ? "Invoice accepted by doctor"
                : "Invoice awaiting doctor acceptance"}
            </strong>
            <small>
              {labCase.invoiceAcceptedAt
                ? formatDate(labCase.invoiceAcceptedAt.slice(0, 10))
                : "The doctor can accept this invoice from their portal."}
            </small>
          </span>
        </button>
        {caseServiceLines(labCase).map((line) => (
          <div className="invoice-line" key={line.id}>
            <span>
              <strong>{line.service}</strong>
              <small>Shade {line.shade}</small>
            </span>
            <span>{line.units} units</span>
            <span>{money(line.unitPrice, data.currency)}</span>
            <strong>{money(line.unitPrice * line.units, data.currency)}</strong>
          </div>
        ))}
        <div className="invoice-totals">
          <span>
            <small>Total</small>
            <strong>{money(labCase.price, data.currency)}</strong>
          </span>
          <span>
            <small>Paid</small>
            <strong>{money(labCase.paid, data.currency)}</strong>
          </span>
          <span className="balance">
            <small>Balance due</small>
            <strong>
              {money(labCase.price - labCase.paid, data.currency)}
            </strong>
          </span>
        </div>
      </div>
      <div className="modal-actions document-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => printInvoiceDocument(data, labCase)}
        >
          <Printer size={16} />
          Print invoice
        </button>
      </div>
    </Modal>
  );
}

function DoctorStatementModal({
  data,
  doctor,
  start,
  period,
  onClose,
}: {
  data: OraData;
  doctor: Doctor;
  start: string;
  period: "day" | "week" | "month" | "year" | "all";
  onClose: () => void;
}) {
  const snapshot = doctorStatementSnapshot(data, doctor, start);
  const periodLabel =
    period === "all"
      ? "All transactions"
      : period === "day"
        ? "Today's transactions"
        : `This ${period}`;
  return (
    <Modal
      title={`${doctor.name} statement`}
      subtitle={`${periodLabel} · ${doctor.clinic}`}
      onClose={onClose}
      wide
    >
      <div className="statement-preview">
        <div className="statement-balance-grid statement-summary-grid">
          <span>
            <small>Opening balance</small>
            <strong>{money(snapshot.openingBalance, data.currency)}</strong>
          </span>
          <span>
            <small>New charges</small>
            <strong>{money(snapshot.charges, data.currency)}</strong>
          </span>
          <span>
            <small>Payments</small>
            <strong>{money(snapshot.payments, data.currency)}</strong>
          </span>
          <span className="balance">
            <small>Ending balance</small>
            <strong>{money(snapshot.endingBalance, data.currency)}</strong>
          </span>
          <span className="overdue">
            <small>Current overdue</small>
            <strong>{money(snapshot.overdue, data.currency)}</strong>
          </span>
        </div>
        <div className="statement-key">
          <span className="invoice">
            <i />
            Invoices add to the balance
          </span>
          <span className="payment">
            <i />
            Payments reduce it; negative payments correct mistakes
          </span>
        </div>
        <div className="invoice-statement">
          <div className="ledger-row doctor-ledger-row head">
            <span>Date</span>
            <span>Transaction</span>
            <span>Patient</span>
            <span>Description</span>
            <span>Charge</span>
            <span>Payment</span>
            <span>Balance</span>
          </div>
          {snapshot.rows.map((item, index) => (
            <div
              className={`ledger-row doctor-ledger-row transaction-${item.type.toLowerCase()}`}
              key={`${item.date}-${item.reference}-${index}`}
            >
              <span>
                {formatDate(item.date, { day: "2-digit", month: "short" })}
              </span>
              <span>
                <strong>
                  <em>{item.type}</em>
                  {item.reference}
                </strong>
              </span>
              <span>
                <strong>{item.patient}</strong>
              </span>
              <span>{item.description}</span>
              <span>{item.debit ? money(item.debit, data.currency) : "—"}</span>
              <span>
                {item.credit ? money(item.credit, data.currency) : "—"}
              </span>
              <span>
                <strong>{money(item.balance, data.currency)}</strong>
              </span>
            </div>
          ))}
          {!snapshot.rows.length && (
            <div className="empty-block">
              <ReceiptText size={22} />
              <p>No invoices or payments in this period.</p>
            </div>
          )}
        </div>
      </div>
      <div className="modal-actions document-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Close
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={() => printDoctorStatement(data, doctor, start, periodLabel)}
        >
          <Printer size={16} />
          Print statement
        </button>
      </div>
    </Modal>
  );
}

function NewCaseModal({
  data,
  onClose,
  onSubmit,
}: {
  data: OraData;
  onAddService: (name: string, defaultPrice: number) => boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const t = (value: string) => value;
  type DraftLine = {
    id: string;
    service: string;
    customService: string;
    units: string;
    shade: string;
    unitPrice: string;
  };
  const [step, setStep] = useState(0);
  const activeDoctors = data.doctors.filter(
    (doctor) => doctor.active !== false,
  );
  const [doctorId, setDoctorId] = useState(activeDoctors[0]?.id ?? "");
  const doctor = activeDoctors.find((item) => item.id === doctorId);
  const prices = doctorPriceList(data, doctor);
  const firstService = data.serviceTypes[0] ?? "__other";
  const makeLine = (): DraftLine => ({
    id: uid("service"),
    service: firstService,
    customService: "",
    units: "1",
    shade: "",
    unitPrice: String(prices[firstService] ?? 0),
  });
  const [lines, setLines] = useState<DraftLine[]>([makeLine()]);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [impressionType, setImpressionType] =
    useState<ImpressionType>("Oral Scan");
  const [selectedTeeth, setSelectedTeeth] = useState<string[]>([]);
  const [toothConnections, setToothConnections] = useState<string[]>([]);
  const [priorityTags, setPriorityTags] = useState<CaseTag[]>([]);
  const [wizardError, setWizardError] = useState("");
  const reviewReached = useRef(false);
  const steps = [
    { title: "Patient", caption: "Client details" },
    { title: "Teeth", caption: "Tooth map and services" },
    { title: "Appointment", caption: "Case targets" },
    { title: "Review", caption: "Intake details" },
  ];
  const submittedLines: CaseServiceLine[] = lines.map((line) => ({
    id: line.id,
    service:
      line.service === "__other" ? line.customService.trim() : line.service,
    units: Math.max(1, Number(line.units) || 1),
    shade: line.shade.trim() || "Not recorded",
    unitPrice: Math.max(0, Number(line.unitPrice) || 0),
  }));
  const total = submittedLines.reduce(
    (sum, line) => sum + line.units * line.unitPrice,
    0,
  );

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }
  function changeDoctor(id: string) {
    setDoctorId(id);
    const nextDoctor = activeDoctors.find((item) => item.id === id);
    const nextPrices = doctorPriceList(data, nextDoctor);
    setLines((current) =>
      current.map((line) =>
        line.service === "__other"
          ? line
          : { ...line, unitPrice: String(nextPrices[line.service] ?? 0) },
      ),
    );
  }
  function toggleTooth(tooth: string) {
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
  }
  function toggleConnection(first: string, second: string) {
    const key = toothConnectionKey(first, second);
    if (!selectedTeeth.includes(first) || !selectedTeeth.includes(second))
      return;
    setToothConnections((current) =>
      current.includes(key)
        ? current.filter((connection) => connection !== key)
        : [...current, key],
    );
  }
  function togglePriorityTag(tag: CaseTag) {
    setPriorityTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }
  const serviceEditor = (
    <>
      <div className="service-line-list">
        {lines.map((line, index) => (
          <div className="service-line-editor" key={line.id}>
            <div className="service-line-head">
              <strong>{t("Service")} {index + 1}</strong>
              {lines.length > 1 && (
                <button
                  className="icon-button danger"
                  type="button"
                  title={t("Remove service")}
                  onClick={() =>
                    setLines((current) =>
                      current.filter((item) => item.id !== line.id),
                    )
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
            <div className="form-grid">
              <label className="field">
                <span>{t("Service type")}</span>
                <select
                  value={line.service}
                  onChange={(event) => {
                    const service = event.target.value;
                    updateLine(line.id, {
                      service,
                      unitPrice:
                        service === "__other"
                          ? line.unitPrice
                          : String(prices[service] ?? 0),
                    });
                  }}
                >
                  {data.serviceTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                  <option value="__other">{t("Other")}</option>
                </select>
              </label>
              <label className="field">
                <span>{t("Teeth / units")}</span>
                <input
                  type="number"
                  min="1"
                  value={line.units}
                  onChange={(event) =>
                    updateLine(line.id, { units: event.target.value })
                  }
                  required
                />
              </label>
              {line.service === "__other" && (
                <label className="field">
                  <span>{t("Other service")}</span>
                  <input
                    value={line.customService}
                    onChange={(event) =>
                      updateLine(line.id, { customService: event.target.value })
                    }
                    placeholder={t("Service name")}
                    required
                  />
                </label>
              )}
              <label className="field">
                <span>{t("Shade")}</span>
                <input
                  value={line.shade}
                  onChange={(event) =>
                    updateLine(line.id, { shade: event.target.value })
                  }
                  placeholder="A2 / BL2"
                  required
                />
              </label>
              <label className="field">
                <span>{t("Price per unit")}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.unitPrice}
                  onChange={(event) =>
                    updateLine(line.id, { unitPrice: event.target.value })
                  }
                  required
                />
              </label>
            </div>
            <div className="line-total">
              <small>{t("Line total")}</small>
              <strong>
                {money(
                  (Number(line.units) || 0) * (Number(line.unitPrice) || 0),
                  data.currency,
                )}
              </strong>
            </div>
          </div>
        ))}
      </div>
      <button
        className="secondary-button add-service-line"
        type="button"
        onClick={() => setLines((current) => [...current, makeLine()])}
      >
        <Plus size={16} />
        {t("Add another service")}
      </button>
      <div className="price-calculation">
        <span>
          <small>
            {submittedLines.length} {t("Service")}{" "}
            {submittedLines.length === 1 ? "" : ""}
          </small>
          <strong>
            {submittedLines.reduce((sum, line) => sum + line.units, 0)} total
            {t("Teeth / units")}
          </strong>
        </span>
        <span>
          <small>{t("Case value")}</small>
          <strong>{money(total, data.currency)}</strong>
        </span>
      </div>
    </>
  );
  function goNext(form: HTMLFormElement) {
    setWizardError("");
    const section = form.querySelector<HTMLElement>(
      `[data-wizard-step="${step}"]`,
    );
    const controls = Array.from(
      section?.querySelectorAll<HTMLElement>("[required]") ?? [],
    ) as Array<HTMLInputElement | HTMLSelectElement>;
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      setWizardError(t("Complete the required fields before continuing."));
      return invalid.reportValidity();
    }
    if (
      step === 1 &&
      submittedLines.some((line) => !line.service || line.units < 1)
    ) {
      setWizardError(t("Add a service and at least one tooth or unit before continuing."));
      return;
    }
    if (step === 2) {
      if (!dueDate || !dueTime || !appointmentDate || !appointmentTime) {
        setWizardError(
          t("Add the date and time."),
        );
        return;
      }
      reviewReached.current = true;
    }
    window.dispatchEvent(
      new CustomEvent("ora-picker-open", { detail: "__close__" }),
    );
    setStep((current) => Math.min(3, current + 1));
  }

  return (
    <Modal title={t("New lab case")} onClose={onClose} wide>
      <form
        className="modal-form case-wizard"
        onSubmit={(event) => {
          event.preventDefault();
          if (step !== 3 || !reviewReached.current) {
            goNext(event.currentTarget);
            return;
          }
          onSubmit(event);
        }}
      >
        <input
          type="hidden"
          name="serviceLines"
          value={JSON.stringify(submittedLines)}
        />
        <input
          type="hidden"
          name="teeth"
          value={JSON.stringify(selectedTeeth)}
        />
        <input
          type="hidden"
          name="toothConnections"
          value={JSON.stringify(toothConnections)}
        />
        <input
          type="hidden"
          name="priorityTags"
          value={JSON.stringify(priorityTags)}
        />
        <div className="case-wizard-progress compact-progress portal-style-progress">
          {steps.map((item, index) => (
            <button
              type="button"
              key={item.title}
              className={index === step ? "active" : index < step ? "done" : ""}
              onClick={() => index < step && setStep(index)}
              disabled={index > step}
            >
              <span>{index < step ? <Check size={12} /> : index + 1}</span>
              <strong>{t(item.title)}</strong>
            </button>
          ))}
        </div>
        <section
          className="wizard-step"
          data-wizard-step="0"
          hidden={step !== 0}
        >
          <header>
            <span>
              <Stethoscope size={18} />
            </span>
            <div>
              <h3>{t("Client and patient")}</h3>
              <p>{t("Connect the case to the correct account and patient.")}</p>
            </div>
          </header>
          <div className="form-grid">
            <label className="field span-2">
              <span>{t("Doctor")}</span>
              <select
                name="doctorId"
                value={doctorId}
                onChange={(event) => changeDoctor(event.target.value)}
                required
              >
                {activeDoctors.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.clinic}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("Patient name / initials")}</span>
              <input
               
                name="patient"
                placeholder="e.g. M. A."
                required
              />
            </label>
            <label className="field">
              <span>{t("Order Number")}</span>
              <input
               
                name="patientRef"
                placeholder="Clinic reference"
                required
              />
            </label>
            <div className="field span-2">
              <span>{t("Impression type")}</span>
              <input
                type="hidden"
                name="impressionType"
                value={impressionType}
              />
              <div
                className={`impression-switch ${impressionType === "Physical Impression" ? "physical" : "oral"}`}
              >
                <i />
                <button
                  className={impressionType === "Oral Scan" ? "active" : ""}
                  type="button"
                  onClick={() => setImpressionType("Oral Scan")}
                >
                  <span>OS</span>{t("Oral Scan")}
                </button>
                <button
                  className={
                    impressionType === "Physical Impression" ? "active" : ""
                  }
                  type="button"
                  onClick={() => setImpressionType("Physical Impression")}
                >
                  <span>PI</span>{t("Physical Impression")}
                </button>
              </div>
            </div>
          </div>
        </section>
        <section
          className="wizard-step tooth-map-step"
          data-wizard-step="1"
          hidden={step !== 1}
        >
          <header>
            <span>
              <ClipboardCheck size={18} />
            </span>
            <div>
              <h3>{t("Teeth and services")}</h3>
              <p>{t("Select the teeth, then set the services and case value.")}</p>
            </div>
          </header>
          <div className="intake-teeth-services">
            <div className="tooth-chart-panel">
              <DentalReferenceChart
                selectedTeeth={selectedTeeth}
                toothConnections={toothConnections}
                onToggleTooth={toggleTooth}
                onToggleConnection={toggleConnection}
              />
            </div>
            <div className="intake-service-panel">{serviceEditor}</div>
          </div>
        </section>
        <section
          className="wizard-step"
          data-wizard-step="2"
          hidden={step !== 2}
        >
          <header>
            <span>
              <Archive size={18} />
            </span>
            <div>
              <h3>{t("Appointments")}</h3>
              <p>
                {t("Set the internal production target and the doctor's appointment.")}
              </p>
            </div>
          </header>
          <div className="appointment-grid">
            <section>
              <h4>{t("Production appointment")}</h4>
              <div className="form-grid">
                <CompactDatePicker
                  name="dueDate"
                  label={t("Date")}
                  value={dueDate}
                  onChange={setDueDate}
                />
                <CompactTimePicker
                  name="dueTime"
                  label={t("Time")}
                  value={dueTime}
                  onChange={setDueTime}
                />
              </div>
            </section>
            <section>
              <h4>{t("Doctor's appointment")}</h4>
              <div className="form-grid">
                <CompactDatePicker
                  name="appointmentDate"
                  label={t("Date")}
                  value={appointmentDate}
                  onChange={setAppointmentDate}
                />
                <CompactTimePicker
                  name="appointmentTime"
                  label={t("Time")}
                  value={appointmentTime}
                  onChange={setAppointmentTime}
                />
              </div>
            </section>
          </div>
          <div className="field case-tags-field">
            <span>{t("Case tags")}</span>
            <div className="case-tag-picker">
              <button
                type="button"
                className={
                  priorityTags.includes("Rush") ? "selected rush" : "rush"
                }
                onClick={() => togglePriorityTag("Rush")}
              >
                {t("Rush")}
              </button>
              <button
                type="button"
                className={
                  priorityTags.includes("Remake") ? "selected remake" : "remake"
                }
                onClick={() => togglePriorityTag("Remake")}
              >
                {t("Remake")}
              </button>
            </div>
          </div>
        </section>
        <section
          className="wizard-step"
          data-wizard-step="3"
          hidden={step !== 3}
        >
          <header>
            <span>
              <ClipboardCheck size={18} />
            </span>
            <div>
              <h3>{t("Review and intake")}</h3>
              <p>{t("The case will be assigned to you when it is created.")}</p>
            </div>
          </header>
          <div className="form-grid">
            <label className="field">
              <span>{t("Priority")}</span>
              <select name="priority">
                <option>Normal</option>
                <option>Rush</option>
              </select>
            </label>
            <label className="field">
              <span>{t("Telegram reference")}</span>
              <input
               
                name="telegramRef"
                placeholder="Message link or reference"
              />
            </label>
            <div className="field span-2 material-intake">
              <span>
                {t("Material used at intake")} <small>{t("Optional")}</small>
              </span>
              <div>
                <select name="materialId" defaultValue="">
                  <option value="">{t("No material yet")}</option>
                  {data.materials.map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.name} · {item.stock} {item.unit}
                    </option>
                  ))}
                </select>
                <input
                  name="materialQty"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t("Quantity")}
                />
              </div>
            </div>
            <label className="field span-2">
              <span>{t("Internal note")}</span>
              <textarea
               
                name="note"
                rows={3}
                placeholder={t("Production note...")}
              />
            </label>
          </div>
          <div className="wizard-review">
            <span>
              <small>Doctor</small>
              <strong>{doctor?.name}</strong>
            </span>
            <span>
              <small>Teeth</small>
              <strong>
                {selectedTeeth.length
                  ? selectedTeeth.join(", ")
                  : t("Not recorded")}
              </strong>
            </span>
            <span>
              <small>Services</small>
              <strong>
                {submittedLines
                  .map((line) => `${line.service} (${line.units})`)
                  .join(", ")}
              </strong>
            </span>
            <span>
              <small>{t("Case value")}</small>
              <strong>{money(total, data.currency)}</strong>
            </span>
          </div>
        </section>
        {wizardError && <p className="form-error wizard-form-error" role="alert">{wizardError}</p>}
        <div className="modal-actions wizard-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}
          >
            {step === 0 ? t("Cancel") : t("Back")}
          </button>
          {step < 3 ? (
            <button
              className="primary-button"
              type="button"
              onClick={(event) => goNext(event.currentTarget.form!)}
            >
              {t("Next")} <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={(event) => {
                if (reviewReached.current && step === 3)
                  event.currentTarget.form?.requestSubmit();
              }}
            >
              <Plus size={17} />
              {t("Create case")}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function ExpenseModal({
  today,
  onClose,
  onSubmit,
}: {
  today: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title="Add expense"
      subtitle="Record an outgoing lab cost."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Description</span>
          <input
           
            name="description"
            placeholder="e.g. Zirconia disc restock"
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Category</span>
            <select name="category">
              <option>Materials</option>
              <option>Utilities</option>
              <option>Payroll</option>
              <option>Maintenance</option>
              <option>Rent</option>
              <option>Other</option>
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input name="date" type="date" defaultValue={today} required />
          </label>
        </div>
        <label className="field">
          <span>Amount</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            required
          />
        </label>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Save expense
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PracticeFields({
  clinics,
  practiceType,
  setPracticeType,
  clinic,
  setClinic,
  onAddClinic,
}: {
  clinics: string[];
  practiceType: PracticeType;
  setPracticeType: (value: PracticeType) => void;
  clinic: string;
  setClinic: (value: string) => void;
  onAddClinic: (name: string) => boolean;
}) {
  const [addingClinic, setAddingClinic] = useState(false);
  const [newClinic, setNewClinic] = useState("");
  return (
    <div className="practice-fields">
      <input type="hidden" name="practiceType" value={practiceType} />
      <input
        type="hidden"
        name="clinic"
        value={practiceType === "individual" ? "Independent practice" : clinic}
      />
      <div className="field">
        <span>Practice type</span>
        <div className="segmented practice-switch">
          <button
            className={practiceType === "individual" ? "active" : ""}
            type="button"
            onClick={() => setPracticeType("individual")}
          >
            Independent doctor
          </button>
          <button
            className={practiceType === "clinic" ? "active" : ""}
            type="button"
            onClick={() => setPracticeType("clinic")}
          >
            Clinic
          </button>
        </div>
      </div>
      {practiceType === "individual" ? (
        <div className="practice-note">
          <Stethoscope size={17} />
          <span>
            <strong>Independent practice</strong>
            <small>This doctor is not attached to a shared clinic.</small>
          </span>
        </div>
      ) : (
        <div className="field">
          <span>Clinic name</span>
          <div className="select-with-add clinic-picker">
            <select
              value={clinic}
              onChange={(event) => setClinic(event.target.value)}
              required
            >
              <option value="" disabled>
                Choose a clinic
              </option>
              {clinics.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              type="button"
              onClick={() => setAddingClinic((value) => !value)}
              aria-label="Create clinic"
              title="Create clinic"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
      {practiceType === "clinic" && addingClinic && (
        <div className="inline-creator clinic-creator">
          <div>
            <strong>Create a clinic</strong>
            <small>It becomes available to other doctors too.</small>
          </div>
          <input
           
            value={newClinic}
            onChange={(event) => setNewClinic(event.target.value)}
            placeholder="Clinic name"
          />
          <button
            className="secondary-button compact"
            type="button"
            onClick={() => {
              const cleanName = newClinic.trim();
              if (onAddClinic(cleanName)) {
                setClinic(cleanName);
                setNewClinic("");
                setAddingClinic(false);
              }
            }}
          >
            Add clinic
          </button>
        </div>
      )}
    </div>
  );
}

function DoctorModal({
  data,
  clinics,
  onAddClinic,
  onClose,
  onSubmit,
}: {
  data: OraData;
  clinics: string[];
  onAddClinic: (name: string) => boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [practiceType, setPracticeType] = useState<PracticeType>("individual");
  const [clinic, setClinic] = useState(clinics[0] ?? "");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const steps = ["Doctor details", "Service prices"];
  return (
    <Modal
      title="Add doctor"
      subtitle="Set up the doctor and their service prices."
      onClose={onClose}
      wide
    >
      <form
        className="modal-form case-wizard"
        onSubmit={(event) => {
          event.preventDefault();
          if (step !== 1) return;
          onSubmit(event);
        }}
      >
        <input type="hidden" name="skipPricing" value="false" />
        <div className="case-wizard-progress compact-progress clinic-create-progress">
          {steps.map((title, index) => (
            <button
              type="button"
              key={title}
              className={index === step ? "active" : index < step ? "done" : ""}
              onClick={() => index < step && setStep(index)}
              disabled={index > step}
            >
              <span>{index < step ? <Check size={12} /> : index + 1}</span>
              <strong>{title}</strong>
            </button>
          ))}
        </div>
        <section className="wizard-step" hidden={step !== 0}>
          <header><span><Stethoscope size={18} /></span><div><h3>Doctor details</h3><p>Record the client details used on cases, invoices, and delivery requests.</p></div></header>
          <div className="form-grid">
            <label className="field span-2"><span>Doctor name</span><input name="name" placeholder="Dr. Name" required /></label>
            <label className="field"><span>Phone</span><input name="phone" placeholder="Phone number" /></label>
            <label className="field"><span>Address</span><input name="address" placeholder="Clinic or practice address" /></label>
          </div>
          <PracticeFields
            clinics={clinics}
            practiceType={practiceType}
            setPracticeType={setPracticeType}
            clinic={clinic}
            setClinic={setClinic}
            onAddClinic={onAddClinic}
          />
        </section>
        <section className="wizard-step" hidden={step !== 1}>
          <header><span><BadgeDollarSign size={18} /></span><div><h3>Service prices</h3><p>{practiceType === "clinic" ? "This doctor uses the selected clinic's shared price list." : "Set an individual price for each service, or skip this step until prices are confirmed."}</p></div></header>
          {practiceType === "individual" ? (
            <div className="price-list-form">
              {data.serviceTypes.map((service) => (
                <label className="field" key={service}>
                  <span>{service}</span>
                  <div className="money-input clinic-money-input"><b>{data.currency}</b><input name={`price-${service}`} type="number" min="0" step="0.01" placeholder="0.00" /></div>
                </label>
              ))}
            </div>
          ) : (
            <div className="info-callout"><BadgeDollarSign size={18} /><p>Shared clinic prices will be applied automatically. You can update them later from the clinic directory.</p></div>
          )}
        </section>
        {error && <p className="form-error wizard-form-error" role="alert">{error}</p>}
        <div className="modal-actions wizard-actions">
          <button className="secondary-button" type="button" onClick={step === 0 ? onClose : () => setStep(0)}>{step === 0 ? "Cancel" : "Back"}</button>
          {step === 0 ? (
            <button className="primary-button" type="button" onClick={(event) => {
              const name = event.currentTarget.form?.querySelector<HTMLInputElement>("[name=name]");
              if (!name?.value.trim()) { setError("Enter the doctor name before continuing."); name?.focus(); return; }
              setError(""); setStep(1);
            }}>Next <ChevronRight size={16} /></button>
          ) : (
            <span className="wizard-action-pair">
              <button className="secondary-button" type="button" onClick={(event) => { const form = event.currentTarget.form; const skip = form?.querySelector<HTMLInputElement>("[name=skipPricing]"); if (skip && form) { skip.value = "true"; form.requestSubmit(); } }}>Skip pricing</button>
              <button className="primary-button" type="submit"><Plus size={16} />Add doctor</button>
            </span>
          )}
        </div>
      </form>
    </Modal>
  );
}

function PriceModal({
  doctor,
  clinics,
  serviceTypes,
  currency,
  onAddClinic,
  onAddService,
  onClose,
  onSubmit,
}: {
  doctor: Doctor;
  clinics: string[];
  serviceTypes: string[];
  currency: OraData["currency"];
  onAddClinic: (name: string) => boolean;
  onAddService: (name: string, defaultPrice: number) => boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [practiceType, setPracticeType] = useState<PracticeType>(
    doctor.practiceType,
  );
  const [clinic, setClinic] = useState(
    doctor.practiceType === "clinic" ? doctor.clinic : (clinics[0] ?? ""),
  );
  return (
    <Modal
      title={`Edit ${doctor.name}`}
      subtitle="Update contact details, practice and prices."
      onClose={onClose}
      wide
    >
      <form className="modal-form" onSubmit={onSubmit}>
        <div className="form-grid doctor-details-grid">
          <label className="field">
            <span>Doctor name</span>
            <input
             
              name="name"
              defaultValue={doctor.name}
              placeholder="Dr. Name"
              required
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
             
              name="phone"
              defaultValue={doctor.phone}
              placeholder="Phone number"
            />
          </label>
          <label className="field span-2">
            <span>Address</span>
            <input
             
              name="address"
              defaultValue={doctor.address}
              placeholder="Clinic or practice address"
            />
          </label>
          <div className="span-2">
            <PracticeFields
              clinics={clinics}
              practiceType={practiceType}
              setPracticeType={setPracticeType}
              clinic={clinic}
              setClinic={setClinic}
              onAddClinic={onAddClinic}
            />
          </div>
        </div>
        {practiceType === "individual" ? (
          <>
            <div className="catalog-modal-head doctor-price-head">
              <span>{serviceTypes.length} service prices</span>
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => setAdding((value) => !value)}
              >
                <Plus size={15} />
                Add service
              </button>
            </div>
            {adding && (
              <div className="inline-creator">
                <input
                 
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Service name"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(Number(event.target.value))}
                  placeholder="Default price"
                />
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() => {
                    if (onAddService(name, price)) {
                      setName("");
                      setPrice(0);
                      setAdding(false);
                    }
                  }}
                >
                  Add option
                </button>
              </div>
            )}
            <div className="price-list-form">
              {serviceTypes.map((service) => (
                <label className="field" key={service}>
                  <span>{service}</span>
                  <div className="money-input">
                    <b>{currency}</b>
                    <input
                      name={service}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={doctor.priceList[service] ?? 0}
                      required
                    />
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="info-callout clinic-price-note">
            <BadgeDollarSign size={18} />
            <p>
              This doctor uses the shared {clinic} price list. Edit that price
              list from Manage clinics.
            </p>
          </div>
        )}
        <div className="info-callout">
          <ShieldCheck size={18} />
          <p>
            Price changes apply to new cases only. Existing case values remain
            locked for accurate statements.
          </p>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Save doctor
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DoctorAccountModal({
  data,
  doctor,
  onDeletePayment,
  onDeleteCase,
  onClose,
}: {
  data: OraData;
  doctor: Doctor;
  onDeletePayment: (paymentId: string) => void;
  onDeleteCase: (caseId: string) => void;
  onClose: () => void;
}) {
  const cases = data.cases
    .filter((item) => item.doctorId === doctor.id)
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
  const payments = data.payments.filter((item) => item.doctorId === doctor.id);
  const invoiced = cases.reduce((sum, item) => sum + item.price, 0);
  const paid = payments.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Modal
      title={`${doctor.name} account records`}
      subtitle="Admin and Accountant controls for historical invoices and payments."
      onClose={onClose}
      wide
    >
      <div className="doctor-account-manager">
        <div className="statement-balance-grid doctor-account-summary">
          <span>
            <small>Invoices</small>
            <strong>{cases.length}</strong>
          </span>
          <span>
            <small>Total invoiced</small>
            <strong>{money(invoiced, data.currency)}</strong>
          </span>
          <span>
            <small>Payments</small>
            <strong>{money(paid, data.currency)}</strong>
          </span>
          <span className="balance">
            <small>Outstanding</small>
            <strong>{money(invoiced - paid, data.currency)}</strong>
          </span>
        </div>
        <div className="account-history-heading">
          <div>
            <h3>Invoice and payment history</h3>
            <p>
              Deleting an entry immediately updates this doctor&apos;s
              statements and balances.
            </p>
          </div>
          <AlertTriangle size={18} />
        </div>
        <div className="doctor-account-cases">
          {cases.map((labCase) => {
            const casePayments = payments
              .filter((payment) => payment.caseId === labCase.id)
              .sort((a, b) => b.date.localeCompare(a.date));
            return (
              <article key={labCase.id}>
                <header>
                  <span>
                    <strong>
                      {invoiceNumber(labCase)} · {labCase.patient}
                    </strong>
                    <small>
                      {formatDate(labCase.receivedDate)} ·{" "}
                      {caseServiceSummary(labCase)}
                    </small>
                  </span>
                  <span className="account-case-values">
                    <strong>{money(labCase.price, data.currency)}</strong>
                    <small>
                      {money(labCase.paid, data.currency)} paid ·{" "}
                      {money(labCase.price - labCase.paid, data.currency)} due
                    </small>
                  </span>
                  <button
                    className="icon-button danger-icon"
                    type="button"
                    onClick={() => onDeleteCase(labCase.id)}
                    aria-label={`Delete case ${labCase.caseNumber}`}
                    title="Delete case and linked records"
                  >
                    <Trash2 size={16} />
                  </button>
                </header>
                <div className="account-payment-list">
                  {casePayments.map((payment) => (
                    <div key={payment.id}>
                      <span
                        className={
                          payment.amount < 0
                            ? "payment-correction"
                            : "payment-credit"
                        }
                      >
                        <ArrowDownRight size={15} />
                      </span>
                      <span>
                        <strong>
                          {payment.note ||
                            (payment.amount < 0
                              ? "Payment correction"
                              : "Payment received")}
                        </strong>
                        <small>
                          {formatDateTime(payment.date)} ·{" "}
                          {data.staff.find(
                            (member) => member.id === payment.staffId,
                          )?.name ?? "Ora staff"}
                        </small>
                      </span>
                      <b
                        className={payment.amount < 0 ? "negative" : "positive"}
                      >
                        {payment.amount > 0 ? "+" : ""}
                        {money(payment.amount, data.currency)}
                      </b>
                      <button
                        className="icon-button danger-icon"
                        type="button"
                        onClick={() => onDeletePayment(payment.id)}
                        aria-label={`Delete payment ${money(payment.amount, data.currency)}`}
                        title="Delete payment"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  {!casePayments.length && (
                    <p>No payment records for this invoice.</p>
                  )}
                </div>
              </article>
            );
          })}
          {!cases.length && (
            <div className="empty-block">
              <ReceiptText size={22} />
              <p>No cases remain in this doctor&apos;s history.</p>
            </div>
          )}
        </div>
      </div>
      <div className="modal-actions document-actions">
        <button className="primary-button" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function DoctorPortalAccountModal({
  doctor,
  onClose,
  onSave,
  onRemove,
}: {
  doctor: Doctor;
  onClose: () => void;
  onSave: (doctorId: string, username: string, password: string) => boolean;
  onRemove: (doctorId: string) => void;
}) {
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const defaultUsername =
    doctor.portalAccount?.username ??
    doctor.name
      .replace(/^Dr\.\s*/i, "")
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "")
      .toLowerCase();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    if (onSave(doctor.id, String(form.get("username") ?? ""), password))
      onClose();
  }
  return (
    <Modal
      title={`${doctor.name} portal login`}
      subtitle="Create login details to share with this doctor manually."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="info-callout">
          <Stethoscope size={18} />
          <p>
            The doctor will only see their own dashboard, cases, delivery
            tracking, and invoices.
          </p>
        </div>
        <label className="field">
          <span>Portal username</span>
          <input
            name="username"
            autoComplete="off"
            defaultValue={defaultUsername}
            placeholder="e.g. dr.rami"
            required
          />
        </label>
        <label className="field">
          <span>Portal password</span>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            name="confirmation"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          Show password while entering
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          {doctor.portalAccount && (
            <button
              className="danger-button"
              type="button"
              onClick={() => {
                onClose();
                onRemove(doctor.id);
              }}
            >
              <Trash2 size={16} />
              Remove access
            </button>
          )}
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            <KeyRound size={16} />
            {doctor.portalAccount ? "Update login" : "Create login"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MaterialModal({
  categories,
  onAddCategory,
  onClose,
  onSubmit,
}: {
  categories: string[];
  onAddCategory: (name: string) => boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const [category, setCategory] = useState(categories[0] ?? "__other");
  const [showCreator, setShowCreator] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  return (
    <Modal
      title="Add inventory material"
      subtitle="Create a stock item with its reorder level and batch."
      onClose={onClose}
      wide
    >
      <form className="modal-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label className="field span-2">
            <span>Material name</span>
            <input
             
              name="name"
              placeholder="Material name"
              required
            />
          </label>
          <div className="field">
            <span>Material type</span>
            <div className="select-with-add">
              <select
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
                <option value="__other">Other...</option>
              </select>
              <button
                className="icon-button"
                type="button"
                onClick={() => setShowCreator((value) => !value)}
                aria-label="Add material type"
                title="Add material type"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <label className="field">
            <span>Unit</span>
            <input
             
              name="unit"
              placeholder="discs, g, L..."
              required
            />
          </label>
          {category === "__other" && (
            <label className="field span-2">
              <span>Other material type</span>
              <input
               
                name="customCategory"
                placeholder="Material type"
                required
              />
            </label>
          )}
          {showCreator && (
            <div className="inline-creator span-2">
              <div>
                <strong>Add a reusable material type</strong>
                <small>It will appear in future material forms.</small>
              </div>
              <input
               
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="Material type"
              />
              <button
                className="secondary-button compact"
                type="button"
                onClick={() => {
                  if (onAddCategory(newCategory)) {
                    setCategory(newCategory.trim());
                    setNewCategory("");
                    setShowCreator(false);
                  }
                }}
              >
                Add option
              </button>
            </div>
          )}
          <label className="field">
            <span>Opening stock</span>
            <input name="stock" type="number" min="0" step="0.01" required />
          </label>
          <label className="field">
            <span>Low-stock level</span>
            <input name="lowStock" type="number" min="0" step="0.01" required />
          </label>
          <label className="field">
            <span>Cost per unit</span>
            <input name="cost" type="number" min="0" step="0.01" required />
          </label>
          <label className="field">
            <span>Batch / lot</span>
            <input name="batch" placeholder="Batch reference" />
          </label>
          <label className="field">
            <span>Supplier</span>
            <input
             
              name="supplier"
              placeholder="Supplier name"
            />
          </label>
          <label className="field">
            <span>Expiry</span>
            <input
              name="expiry"
              type="date"
              defaultValue={toISODate(expiry)}
              required
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            <PackagePlus size={17} />
            Add material
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustStockModal({
  material,
  onClose,
  onSubmit,
}: {
  material: Material;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title={`Adjust ${material.name}`}
      subtitle={`Current stock: ${material.stock} ${material.unit}`}
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={onSubmit}>
        <label className="field">
          <span>Quantity change</span>
          <input
            name="quantity"
            type="number"
            step="0.01"
            placeholder="Use + to add, - to subtract"
            required
          />
        </label>
        <label className="field">
          <span>Reason</span>
          <input
           
            name="note"
            placeholder="Restock, correction, damaged material..."
            required
          />
        </label>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            Update stock
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StaffModal({
  data,
  member,
  canAssignRoles = true,
  onClose,
  onSubmit,
}: {
  data: OraData;
  member?: StaffMember;
  canAssignRoles?: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [photo, setPhoto] = useState(member?.photo ?? "");
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [color, setColor] = useState(member?.color ?? "#155f57");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    () => member?.roleIds.filter((id) => data.roles.some((role) => role.id === id)) ?? [],
  );
  const preview: StaffMember = member ?? {
    id: "preview",
    name: "New member",
    role: "Team member",
    roleIds: [],
    initials: "NM",
    phone: "",
    color,
    photo,
  };
  const managementOrder = [
    "Admin",
    "Input Manager",
    "Quality Review",
    "Accountant",
  ];
  const managementRoles = data.roles
    .filter((role) => managementOrder.includes(role.name))
    .sort(
      (a, b) =>
        managementOrder.indexOf(a.name) - managementOrder.indexOf(b.name),
    );
  const workflowRoles = data.roles
    .filter((role) => !managementOrder.includes(role.name))
    .sort(
      (a, b) =>
        CASE_STATUSES.indexOf(a.specialties[0] ?? "Closed") -
        CASE_STATUSES.indexOf(b.specialties[0] ?? "Closed"),
    );

  function roleOptions(roles: RoleDefinition[]) {
    return (
      <div className="role-picker-options">
        {roles.map((role) => (
          <label key={role.id}>
            <input
              type="checkbox"
              name="roleIds"
              value={role.id}
              checked={selectedRoleIds.includes(role.id)}
              onChange={(event) =>
                setSelectedRoleIds((current) =>
                  event.target.checked
                    ? [...new Set([...current, role.id])]
                    : current.filter((id) => id !== role.id),
                )
              }
            />
            <span style={{ borderLeftColor: role.color }}>
              <strong>{role.name}</strong>
            </span>
          </label>
        ))}
      </div>
    );
  }

  return (
    <>
    <Modal
      title={member ? `Edit ${member.name}` : "Add staff member"}
      subtitle="Profile details, appearance and assigned roles."
      onClose={onClose}
      wide
    >
      <form className="modal-form" onSubmit={onSubmit}>
        <input type="hidden" name="photo" value={photo} />
        <div className="staff-profile-editor">
          <div className="profile-photo-preview">
            <Avatar member={{ ...preview, color, photo }} />
            <label className="secondary-button compact">
              <Upload size={15} />
              Choose picture
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCropSource(String(reader.result));
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {photo && (
              <button
                className="text-button danger-text"
                type="button"
                onClick={() => setPhoto("")}
              >
                Remove picture
              </button>
            )}
          </div>
          <div className="form-grid">
            <label className="field">
              <span>Name</span>
              <input
               
                name="name"
                defaultValue={member?.name}
                placeholder="Staff name"
                required
              />
            </label>
            <label className="field">
              <span>Phone</span>
              <input
               
                name="phone"
                defaultValue={member?.phone}
                placeholder="Phone number"
              />
            </label>
            <label className="field span-2">
              <span>Profile color</span>
              <div className="color-control">
                <input
                  name="color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
                <strong>{color.toUpperCase()}</strong>
              </div>
            </label>
          </div>
        </div>
        {canAssignRoles && (
          <section className="role-picker">
            <div>
              <strong>Assigned roles</strong>
              <small>
                A team member may combine management access and several
                production specialties.
              </small>
            </div>
            <div className="role-picker-groups">
              <section className="role-picker-group">
                <header>
                  <strong>Management roles</strong>
                  <small>Access, intake, review and finance</small>
                </header>
                {roleOptions(managementRoles)}
              </section>
              <section className="role-picker-group">
                <header>
                  <strong>Workflow roles</strong>
                  <small>Hands-on production specialties</small>
                </header>
                {roleOptions(workflowRoles)}
              </section>
            </div>
          </section>
        )}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            <UserRoundCog size={17} />
            {member ? "Save profile" : "Add staff member"}
          </button>
        </div>
      </form>
    </Modal>
    {cropSource && (
      <StaffPhotoCropper
        source={cropSource}
        onClose={() => setCropSource(null)}
        onSave={(nextPhoto) => {
          setPhoto(nextPhoto);
          setCropSource(null);
        }}
      />
    )}
    </>
  );
}

function StaffPhotoCropper({
  source,
  onClose,
  onSave,
}: {
  source: string;
  onClose: () => void;
  onSave: (photo: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);

  function save() {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 480;
      canvas.height = 480;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const base = Math.max(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * base * zoom;
      const height = image.height * base * zoom;
      context.drawImage(image, (canvas.width - width) / 2 + position.x * 2, (canvas.height - height) / 2 + position.y * 2, width, height);
      onSave(canvas.toDataURL("image/png"));
    };
    image.src = source;
  }

  return (
    <Modal title="Position profile picture" subtitle="Drag the image to position it, then adjust the zoom." onClose={onClose}>
      <div className="logo-cropper">
        <div
          className="crop-window"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            setPosition({ x: drag.current.startX + event.clientX - drag.current.x, y: drag.current.startY + event.clientY - drag.current.y });
          }}
          onPointerUp={() => { drag.current = null; }}
        >
          <img src={source} alt="Profile crop preview" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})` }} />
          <span>Drag to position</span>
        </div>
        <label className="field zoom-control">
          <span>Zoom</span>
          <input type="range" min="1" max="2.5" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
      </div>
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
        <button className="primary-button" type="button" onClick={save}>Use picture</button>
      </div>
    </Modal>
  );
}

type StaffAccountSummary = {
  staffId: string;
  staffName: string;
  username: string | null;
  mustChangePassword: boolean | null;
  isOwner: boolean;
  mfaRequired: boolean;
  mfaEnabled: boolean;
  disabled: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
};

function StaffAccountModal({
  member,
  onClose,
}: {
  member: StaffMember;
  onClose: () => void;
}) {
  const [account, setAccount] = useState<StaffAccountSummary>(() => ({
    staffId: member.id,
    staffName: member.name,
    username: null,
    mustChangePassword: null,
    isOwner: member.id === "staff-admin",
    mfaRequired: false,
    mfaEnabled: false,
    disabled: member.active === false,
    lockedUntil: null,
    lastLoginAt: null,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [credential, setCredential] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);
  const [confirmMfaReset, setConfirmMfaReset] = useState(false);

  function issuePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCredential(null);
    const username = String(
      new FormData(event.currentTarget).get("username") || "",
    );
    const nextCredential = {
      username,
      temporaryPassword: `Ora-${Math.random().toString(36).slice(2, 10)}!`,
    };
    setCredential(nextCredential);
    setAccount((current) => ({
      ...current,
      username: nextCredential.username,
      mustChangePassword: true,
    }));
    setBusy(false);
  }

  function resetAuthenticator() {
    setBusy(true);
    setError("");
    setAccount((current) =>
      current ? { ...current, mfaEnabled: false } : current,
    );
    setConfirmMfaReset(false);
    setBusy(false);
  }

  const suggestedUsername =
    member.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9]+/g, ".")
      .replace(/^\.|\.$/g, "")
      .toLowerCase() || "ora.user";
  return (
    <Modal
      title={`${member.name}'s login`}
      subtitle="Personal credentials, password recovery and authenticator status."
      onClose={onClose}
    >
      <div className="staff-account-editor">
        <>
          <div className="account-status-grid">
            <span>
              <small>Account</small>
              <strong>{account?.username ? "Created" : "Not created"}</strong>
            </span>
            <span>
              <small>Password</small>
              <strong>
                {account?.mustChangePassword
                  ? "Change required"
                  : account?.username
                    ? "Active"
                    : "Pending"}
              </strong>
            </span>
            <span>
              <small>Authenticator</small>
              <strong>
                {account?.mfaEnabled
                  ? "Enabled"
                  : account?.mfaRequired
                    ? "Required at login"
                    : "Optional"}
              </strong>
            </span>
          </div>
          <form
            className="modal-form account-password-form"
            onSubmit={issuePassword}
          >
            <label className="field">
              <span>Username</span>
              <input
                autoComplete="off"
                name="username"
                defaultValue={account?.username ?? suggestedUsername}
                required
              />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              <KeyRound size={16} />
              {account?.username
                ? "Issue replacement password"
                : "Create login"}
            </button>
          </form>
          {credential && (
            <section className="temporary-credential">
              <header>
                <ShieldCheck size={18} />
                <span>
                  <strong>One-time credentials</strong>
                  <small>
                    Give these directly to {member.name}. The password will not
                    appear again.
                  </small>
                </span>
              </header>
              <div>
                <span>
                  <small>Username</small>
                  <code>{credential.username}</code>
                </span>
                <span>
                  <small>Temporary password</small>
                  <code>{credential.temporaryPassword}</code>
                </span>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `Username: ${credential.username}\nTemporary password: ${credential.temporaryPassword}`,
                    )
                  }
                  aria-label="Copy temporary credentials"
                  title="Copy credentials"
                >
                  <Copy size={16} />
                </button>
              </div>
            </section>
          )}
          {account?.username && (
            <section className="account-security-actions">
              <div>
                <span>
                  <strong>MFA recovery</strong>
                  <small>
                    Reset only when the employee has lost both their
                    authenticator and recovery codes.
                  </small>
                </span>
                {!confirmMfaReset ? (
                  <button
                    className="danger-button compact"
                    type="button"
                    onClick={() => setConfirmMfaReset(true)}
                  >
                    Reset authenticator
                  </button>
                ) : (
                  <div className="inline-confirm">
                    <button
                      className="secondary-button compact"
                      type="button"
                      onClick={() => setConfirmMfaReset(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="danger-button compact"
                      type="button"
                      disabled={busy}
                      onClick={resetAuthenticator}
                    >
                      Confirm reset
                    </button>
                  </div>
                )}
              </div>
              {account.lastLoginAt && (
                <p>Last signed in {formatDateTime(account.lastLoginAt)}</p>
              )}
            </section>
          )}
          {error && <p className="form-error account-error">{error}</p>}
        </>
      </div>
      <div className="modal-actions document-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function RoleModal({
  role,
  onClose,
  onSubmit,
}: {
  role?: RoleDefinition;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Modal
      title={role ? `Edit ${role.name}` : "Create role"}
      subtitle="Choose exactly what this role can access and which case stages it can perform."
      onClose={onClose}
      wide
    >
      <form className="modal-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label className="field">
            <span>Role name</span>
            <input
             
              name="name"
              defaultValue={role?.name}
              placeholder="e.g. Printing technician"
              required
            />
          </label>
          <label className="field">
            <span>Role color</span>
            <input
              name="color"
              type="color"
              defaultValue={role?.color ?? "#2d668e"}
            />
          </label>
        </div>
        <section className="permission-picker">
          <div>
            <strong>Permissions</strong>
            <small>Controls pages and actions available to this role.</small>
          </div>
          <div>
            {PERMISSIONS.map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  name="permissions"
                  value={key}
                  defaultChecked={role?.permissions.includes(key)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{key.replaceAll("_", " ")}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className="permission-picker specialty-picker">
          <div>
            <strong>Workflow specialties</strong>
            <small>
              Members can only take and complete stages included here.
            </small>
          </div>
          <div>
            {CASE_STATUSES.filter((stage) => stage !== "Closed").map(
              (stage) => (
                <label key={stage}>
                  <input
                    type="checkbox"
                    name="specialties"
                    value={stage}
                    defaultChecked={role?.specialties.includes(stage)}
                  />
                  <span>
                    <strong>{stage}</strong>
                  </span>
                </label>
              ),
            )}
          </div>
        </section>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit">
            <ShieldCheck size={16} />
            Save role
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmationModal({
  title,
  message,
  confirmLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      subtitle="This action needs confirmation."
      onClose={onCancel}
    >
      <div
        className={`confirmation-body ${destructive ? "" : "informational"}`}
      >
        <span>
          {destructive ? (
            <AlertTriangle size={22} />
          ) : (
            <ClipboardCheck size={22} />
          )}
        </span>
        <p>{message}</p>
      </div>
      <div className="modal-actions confirmation-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className={destructive ? "danger-button" : "primary-button"}
          type="button"
          onClick={onConfirm}
        >
          {destructive ? <Trash2 size={16} /> : <CheckCircle2 size={16} />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function ClinicCreateModal({
  data,
  onAdd,
  onSave,
  onClose,
}: {
  data: OraData;
  onAdd: (name: string) => boolean;
  onSave: (
    name: string,
    phone: string,
    address: string,
    notes: string,
    prices: Record<string, number>,
  ) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const steps = ["Clinic details", "Shared prices"];
  return (
    <Modal title="Add clinic" subtitle="Set up a clinic and its shared service pricing." onClose={onClose} wide>
      <form
        className="modal-form case-wizard"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = String(form.get("name") ?? "").trim();
          if (step !== 1) {
            setError("Complete the clinic details before creating it.");
            return;
          }
          if (!name) {
            setError("Enter the clinic name before creating it.");
            return;
          }
          if (!onAdd(name)) return;
          onSave(
            name,
            String(form.get("phone") ?? ""),
            String(form.get("address") ?? ""),
            String(form.get("notes") ?? ""),
            Object.fromEntries(
              data.serviceTypes.map((service) => [
                service,
                Number(form.get(`price-${service}`)) || 0,
              ]),
            ),
          );
          onClose();
        }}
      >
        <div className="case-wizard-progress compact-progress clinic-create-progress">
          {steps.map((title, index) => (
            <button
              type="button"
              key={title}
              className={index === step ? "active" : index < step ? "done" : ""}
              onClick={() => index < step && setStep(index)}
              disabled={index > step}
            >
              <span>{index < step ? <Check size={12} /> : index + 1}</span>
              <strong>{title}</strong>
            </button>
          ))}
        </div>
        <section className="wizard-step" hidden={step !== 0}>
          <header><span><Stethoscope size={18} /></span><div><h3>Clinic details</h3><p>Record the contact details used for pickup and delivery.</p></div></header>
          <div className="form-grid">
            <label className="field span-2"><span>Clinic name</span><input name="name" placeholder="Clinic name" required /></label>
            <label className="field"><span>Phone</span><input name="phone" placeholder="Clinic phone" /></label>
            <label className="field"><span>Address</span><input name="address" placeholder="Clinic address" /></label>
            <label className="field span-2"><span>Notes</span><textarea name="notes" rows={3} placeholder="Optional clinic notes" /></label>
          </div>
        </section>
        <section className="wizard-step" hidden={step !== 1}>
          <header><span><BadgeDollarSign size={18} /></span><div><h3>Shared prices</h3><p>These prices are used by every doctor linked to this clinic.</p></div></header>
          <div className="price-list-form">
            {data.serviceTypes.map((service) => (
              <label className="field" key={service}>
                <span>{service}</span>
                <div className="money-input clinic-money-input"><b>{data.currency}</b><input name={`price-${service}`} type="number" min="0" step="0.01" placeholder="0.00" /></div>
              </label>
            ))}
          </div>
        </section>
        {error && <p className="form-error wizard-form-error" role="alert">{error}</p>}
        <div className="modal-actions wizard-actions">
          <button className="secondary-button" type="button" onClick={step === 0 ? onClose : () => setStep(0)}>{step === 0 ? "Cancel" : "Back"}</button>
          {step === 0 ? (
            <button className="primary-button" type="button" onClick={(event) => {
              const form = event.currentTarget.form;
              const name = form?.querySelector<HTMLInputElement>("[name=name]");
              if (!name?.value.trim()) { setError("Enter the clinic name before continuing."); name?.focus(); return; }
              setError(""); setStep(1);
            }}>Next <ChevronRight size={16} /></button>
          ) : <span className="wizard-action-pair"><button className="secondary-button" type="submit">Skip pricing</button><button className="primary-button" type="submit"><Plus size={16} />Create clinic</button></span>}
        </div>
      </form>
    </Modal>
  );
}

function ClinicManagerModalV2({
  data,
  initialClinic,
  onRename,
  onSave,
  onRemove,
  onClose,
}: {
  data: OraData;
  initialClinic: string | null;
  onRename: (oldName: string, newName: string) => boolean;
  onSave: (
    name: string,
    phone: string,
    address: string,
    notes: string,
    prices: Record<string, number>,
  ) => void;
  onRemove: (name: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(initialClinic);
  const visibleClinics = initialClinic
    ? data.clinics.filter((clinic) => clinic === initialClinic)
    : data.clinics;
  return (
    <Modal
      title={initialClinic ? `Edit ${initialClinic}` : "Clinic directory"}
      subtitle={
        initialClinic
          ? "Update this clinic's details and shared price list."
          : "Manage every clinic, its details, and shared price list."
      }
      onClose={onClose}
      wide
    >
      <div
        className={`clinic-manager ${initialClinic ? "single-clinic-manager" : ""}`}
      >
        {!initialClinic && (
          <p className="clinic-manager-intro">Select a clinic to edit its contact details and shared service prices.</p>
        )}
        <div className="clinic-editor-list">
          {visibleClinics.map((clinic) => {
            const profile = data.clinicProfiles[clinic];
            const doctors = data.doctors.filter(
              (doctor) => doctor.active !== false && doctor.clinic === clinic,
            );
            const open = initialClinic === clinic || editing === clinic;
            return (
              <article className={open ? "expanded" : ""} key={clinic}>
                <header>
                  <div className="clinic-editor-row-label">
                    <span>
                      <strong>{clinic}</strong>
                      <small>
                        {doctors.length} active doctor
                        {doctors.length === 1 ? "" : "s"}
                      </small>
                    </span>
                  </div>
                  {!initialClinic && (
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => setEditing(open ? null : clinic)}
                      aria-label={`Edit ${clinic}`}
                      title={`Edit ${clinic}`}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <button
                    className="icon-button danger-icon"
                    type="button"
                    onClick={() => onRemove(clinic)}
                    aria-label={`Delete ${clinic}`}
                    title="Delete clinic"
                  >
                    <Trash2 size={15} />
                  </button>
                </header>
                <div className="expand-shell">
                  <form
                    className="clinic-profile-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const nextName = String(form.get("name")).trim();
                      if (nextName !== clinic && !onRename(clinic, nextName))
                        return;
                      onSave(
                        nextName,
                        String(form.get("phone")),
                        String(form.get("address")),
                        String(form.get("notes")),
                        Object.fromEntries(
                          data.serviceTypes.map((service) => [
                            service,
                            Number(form.get(service)),
                          ]),
                        ),
                      );
                      if (!initialClinic) setEditing(null);
                    }}
                  >
                    <div className="form-grid">
                      <label className="field">
                        <span>Clinic name</span>
                        <input name="name" defaultValue={clinic} required />
                      </label>
                      <label className="field">
                        <span>Phone</span>
                        <input name="phone" defaultValue={profile?.phone} />
                      </label>
                      <label className="field span-2">
                        <span>Address</span>
                        <input name="address" defaultValue={profile?.address} />
                      </label>
                      <label className="field span-2">
                        <span>Notes</span>
                        <textarea
                          name="notes"
                          defaultValue={profile?.notes}
                          rows={2}
                        />
                      </label>
                    </div>
                    <div className="price-list-form">
                      {data.serviceTypes.map((service) => (
                        <label className="field" key={service}>
                          <span>{service}</span>
                          <div className="money-input clinic-money-input">
                            <b>{data.currency}</b>
                            <input
                              name={service}
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={profile?.priceList[service] ?? 0}
                              required
                            />
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="modal-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={
                          initialClinic ? onClose : () => setEditing(null)
                        }
                      >
                        Cancel
                      </button>
                      <button className="primary-button" type="submit">
                        Save clinic
                      </button>
                    </div>
                  </form>
                </div>
              </article>
            );
          })}
          {!visibleClinics.length && (
            <div className="empty-block">
              <Stethoscope size={22} />
              <p>No clinics have been added yet.</p>
            </div>
          )}
        </div>
      </div>
      <div className="modal-actions document-actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

export function LogView({
  data,
  onOpenCase,
}: {
  data: OraData;
  onOpenCase: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [source, setSource] = useState<"operational" | "verified">(
    "operational",
  );
  const activities = data.activities.filter(
    (activity) =>
      (kind === "all" || activity.entityType === kind) &&
      `${activity.action} ${data.staff.find((member) => member.id === activity.staffId)?.name ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="log-view">
      <section className="panel audit-panel">
        <div className="audit-source-switch" aria-label="Activity log source">
          <button
            className={source === "operational" ? "active" : ""}
            type="button"
            onClick={() => setSource("operational")}
          >
            <Activity size={15} />
            Operational activity
          </button>
          <button
            className={source === "verified" ? "active" : ""}
            type="button"
            onClick={() => setSource("verified")}
          >
            <ShieldCheck size={15} />
            Security events
          </button>
        </div>
        <div className="audit-toolbar">
          <label className="table-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search actions or team members"
            />
          </label>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="all">All activity</option>
            <option value="case">Cases</option>
            <option value="doctor">Doctors</option>
            <option value="payment">Payments and expenses</option>
            <option value="inventory">Inventory</option>
            <option value="team">Team</option>
            <option value="role">Roles</option>
            <option value="staff">Accounts and team</option>
            <option value="clinic">Clinics</option>
            <option value="settings">Settings</option>
            <option value="workspace">Workspace saves</option>
          </select>
        </div>
        <div className="audit-list">
          {source === "operational" ? (
            <>
              {activities.map((activity) => {
                const member = data.staff.find(
                  (item) => item.id === activity.staffId,
                );
                const caseItem =
                  activity.entityType === "case" ||
                  activity.entityType === "payment"
                    ? data.cases.find((item) => item.id === activity.entityId)
                    : undefined;
                return (
                  <button
                    type="button"
                    key={activity.id}
                    disabled={!caseItem}
                    onClick={() => caseItem && onOpenCase(caseItem.id)}
                  >
                    <Avatar member={member} />
                    <span>
                      <strong>{activity.action}</strong>
                      <small>
                        {member?.name ?? "Ora staff"} ·{" "}
                        {formatDateTime(activity.date)}
                      </small>
                    </span>
                    <em>{activity.entityType ?? "general"}</em>
                    {caseItem && <ChevronRight size={16} />}
                  </button>
                );
              })}
              {!activities.length && (
                <div className="empty-block">
                  <History size={22} />
                  <p>No activity matches these filters.</p>
                </div>
              )}
            </>
          ) : (
            <div className="empty-block">
              <ShieldCheck size={22} />
              <p>
                Security events are represented in the workspace activity log.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StaffStatementModal({
  data,
  member,
  onClose,
}: {
  data: OraData;
  member: StaffMember;
  onClose: () => void;
}) {
  const contributions = data.cases
    .flatMap((labCase) =>
      labCase.history
        .filter(
          (entry) =>
            entry.staffId === member.id || entry.toStaffId === member.id,
        )
        .map((entry) => ({ entry, labCase })),
    )
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date));
  const handledCases = [
    ...new Set(contributions.map(({ labCase }) => labCase.id)),
  ];
  const completedSteps = contributions.filter(
    ({ entry }) => entry.action === "status" || entry.action === "quality",
  );
  const closedCases = data.cases.filter(
    (labCase) =>
      handledCases.includes(labCase.id) && labCase.status === "Closed",
  );
  const onTime = closedCases.filter(
    (labCase) =>
      labCase.qc && labCase.qc.approvedAt.slice(0, 10) <= labCase.dueDate,
  ).length;
  const assignments = contributions.filter(
    ({ entry }) => entry.action === "assigned" || entry.action === "taken",
  ).length;
  const notes = data.cases.reduce(
    (sum, labCase) =>
      sum + labCase.notes.filter((note) => note.staffId === member.id).length,
    0,
  );
  const materials = contributions.filter(
    ({ entry }) => entry.action === "material",
  ).length;
  const stageCounts = CASE_STATUSES.map((stage) => ({
    stage,
    count: completedSteps.filter(
      ({ entry }) =>
        entry.fromStatus === stage ||
        (entry.action === "quality" && stage === "Quality Review"),
    ).length,
  })).filter((item) => item.count > 0);
  return (
    <Modal
      title={`${member.name} work statement`}
      subtitle={member.role}
      onClose={onClose}
      wide
    >
      <div className="staff-statement">
        <header>
          <Avatar member={member} />
          <div>
            <strong>{member.name}</strong>
            <small>{member.phone || "No phone recorded"}</small>
          </div>
          <div className="specialty-tags">
            {memberSpecialties(data, member).map((stage) => (
              <StatusBadge key={stage} status={stage} />
            ))}
          </div>
        </header>
        <div className="statement-balance-grid staff-metric-grid">
          <span>
            <small>Cases handled</small>
            <strong>{handledCases.length}</strong>
          </span>
          <span>
            <small>Steps completed</small>
            <strong>{completedSteps.length}</strong>
          </span>
          <span>
            <small>Closed cases</small>
            <strong>{closedCases.length}</strong>
          </span>
          <span className="balance">
            <small>On-time closes</small>
            <strong>
              {onTime} / {closedCases.length}
            </strong>
          </span>
          <span>
            <small>Assignments</small>
            <strong>{assignments}</strong>
          </span>
        </div>
        <section className="staff-analytics-columns">
          <div>
            <h3>Work by specialty</h3>
            {stageCounts.map((item) => (
              <div className="stage-stat" key={item.stage}>
                <StatusBadge status={item.stage} />
                <span>
                  <i
                    style={{
                      width: `${Math.min(100, (item.count / Math.max(1, completedSteps.length)) * 100)}%`,
                    }}
                  />
                </span>
                <strong>{item.count}</strong>
              </div>
            ))}
            {!stageCounts.length && <p>No completed workflow steps yet.</p>}
          </div>
          <div>
            <h3>Recorded collaboration</h3>
            <span>
              <small>Internal notes</small>
              <strong>{notes}</strong>
            </span>
            <span>
              <small>Material entries</small>
              <strong>{materials}</strong>
            </span>
            <span>
              <small>Takeovers and assignments</small>
              <strong>{assignments}</strong>
            </span>
          </div>
        </section>
        <section className="staff-case-history">
          <h3>Case contributions</h3>
          {contributions.slice(0, 30).map(({ entry, labCase }) => (
            <div key={entry.id}>
              <span>
                <strong>
                  Case {labCase.caseNumber} · {entry.label}
                </strong>
                <small>
                  {formatDateTime(entry.date)} · {labCase.patient} ·{" "}
                  {labCase.service}
                </small>
              </span>
              {entry.toStatus && <StatusBadge status={entry.toStatus} />}
            </div>
          ))}
          {!contributions.length && (
            <p>No case activity recorded for this member.</p>
          )}
        </section>
      </div>
      <div className="modal-actions document-actions">
        <button className="primary-button" type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
