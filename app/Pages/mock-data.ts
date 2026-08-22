export const CASE_STATUSES = [
  "Received",
  "Approved",
  "Casting",
  "Design",
  "Printing",
  "Production",
  "Finishing",
  "Build Up",
  "Glazing",
  "Quality Review",
  "Closed",
] as const;

export const SERVICE_TYPES = [
  "Zirconia Crown",
  "E.max Crown",
  "PFM Crown",
  "Implant Crown",
  "Temporary Crown",
  "Night Guard",
  "Denture",
] as const;

export const MATERIAL_CATEGORIES = [
  "Discs",
  "Ingots",
  "Ceramics",
  "Resins",
  "Metals",
  "Consumables",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];
export type ServiceType = string;
export type StaffRole = string;
export type PracticeType = "individual" | "clinic";
export type ImpressionType = "Oral Scan" | "Physical Impression";
export type CaseTag = "Rush" | "Remake";
export type CaseIntakeSource = "lab" | "doctor";
export type DeliveryStatus = "awaiting_pickup" | "out_for_pickup" | "picked_up" | "received_at_lab" | "awaiting_scan_approval" | "awaiting_scan" | "out_for_scan" | "scanned" | "ready" | "out_for_delivery" | "delivered";
export type DeliveryTaskType = "pickup" | "delivery" | "oral-scan";
export type DeliveryTaskStatus = "scheduled" | "out" | "collected" | "completed";

export type WorkflowOrder = Record<ImpressionType, CaseStatus[]>;

export const DEFAULT_WORKFLOW_ORDER: WorkflowOrder = {
  "Oral Scan": ["Received", "Approved", "Design", "Production", "Printing", "Finishing", "Build Up", "Glazing", "Quality Review", "Closed"],
  "Physical Impression": ["Received", "Casting", "Approved", "Design", "Production", "Finishing", "Build Up", "Glazing", "Quality Review", "Closed"],
};

export const PERMISSIONS = [
  ["view_dashboard", "View overview"],
  ["view_cases", "View cases"],
  ["view_schedule", "View schedule"],
  ["view_doctors", "View doctors"],
  ["view_accounting", "View accounting"],
  ["view_delivery", "View delivery board"],
  ["view_inventory", "View inventory"],
  ["view_team", "View team analytics"],
  ["view_settings", "View settings"],
  ["audit_view", "View global log"],
  ["case_intake", "Create cases"],
  ["case_workflow", "Work on cases"],
  ["case_assign", "Assign any employee"],
  ["case_qc", "Approve quality review"],
  ["case_edit", "Edit case details"],
  ["case_bulk", "Use bulk case actions"],
  ["case_notes", "Add internal notes"],
  ["material_usage", "Record material usage"],
  ["delivery_manage", "Update delivery status"],
  ["catalog_manage", "Manage catalogs"],
  ["clinic_manage", "Manage clinics"],
  ["payment_manage", "Update payments"],
  ["view_case_value", "View case values"],
  ["view_invoices", "View and print invoices"],
  ["view_payments", "View payment records"],
  ["view_doctor_statements", "View doctor and clinic statements"],
  ["expense_manage", "Manage expenses"],
  ["team_manage", "Manage team members"],
  ["role_manage", "Manage roles and permissions"],
  ["backup_manage", "Manage backups"],
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number][0];

export interface RoleDefinition {
  id: string;
  name: string;
  color: string;
  permissions: PermissionKey[];
  specialties: CaseStatus[];
}

export interface Doctor {
  id: string;
  name: string;
  clinic: string;
  practiceType: PracticeType;
  phone: string;
  address: string;
  priceList: Record<string, number>;
  active?: boolean;
  /** Demo credentials shown by the frontend doctor portal. */
  portalAccount?: {
    username: string;
    password: string;
    createdAt: string;
  };
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  roleIds: string[];
  initials: string;
  phone: string;
  color: string;
  photo: string;
  active?: boolean;
}

export interface CaseHistoryEntry {
  id: string;
  date: string;
  staffId: string;
  action: "created" | "assigned" | "taken" | "status" | "quality" | "note" | "material" | "payment" | "edited" | "delivery";
  label: string;
  fromStatus?: CaseStatus;
  toStatus?: CaseStatus;
  fromStaffId?: string;
  toStaffId?: string;
}

export interface CaseNote {
  id: string;
  staffId: string;
  text: string;
  createdAt: string;
}

export interface DoctorCaseAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface DoctorCaseMessage {
  id: string;
  author: "doctor" | "lab";
  authorName: string;
  text: string;
  createdAt: string;
  attachments: DoctorCaseAttachment[];
}

export interface MaterialUsage {
  id: string;
  materialId: string;
  quantity: number;
  staffId: string;
  createdAt: string;
}

export interface CaseServiceLine {
  id: string;
  service: ServiceType;
  units: number;
  shade: string;
  unitPrice: number;
}

export interface LabCase {
  id: string;
  caseNumber: string;
  doctorId: string;
  patient: string;
  patientRef: string;
  service: ServiceType;
  units: number;
  shade: string;
  serviceLines: CaseServiceLine[];
  /** FDI tooth numbers selected during intake, for example 11 or 36. */
  teeth?: string[];
  /** Adjacent selected teeth linked during intake, stored as sorted `11:12` keys. */
  toothConnections?: string[];
  receivedDate: string;
  dueDate: string;
  dueTime: string;
  appointmentDate?: string;
  appointmentTime?: string;
  /** Whether this case was entered at the lab or submitted through the future doctor portal. */
  intakeSource?: CaseIntakeSource;
  /** Doctor portal cases must be accepted by an Admin or Input Manager before production begins. */
  intakeApprovalPending?: boolean;
  /** Delivery is managed separately from the production workflow. */
  deliveryStatus?: DeliveryStatus;
  /** Saved delivery destination. Clinic addresses are used as the fallback. */
  deliveryLocation?: string;
  deliveryAssigneeId?: string;
  deliveryAssignedAt?: string;
  /** Recorded when the doctor confirms the invoice in the doctor portal. */
  invoiceAcceptedAt?: string;
  invoiceAcceptedBy?: string;
  impressionType: ImpressionType;
  status: CaseStatus;
  priority: "Normal" | "Rush";
  priorityTags?: CaseTag[];
  assignedTo: string;
  telegramRef: string;
  price: number;
  paid: number;
  notes: CaseNote[];
  doctorMessages?: DoctorCaseMessage[];
  materialUsage: MaterialUsage[];
  history: CaseHistoryEntry[];
  archived?: boolean;
  /** Admin-controlled production pause, retained with a short reason for the whole team. */
  onHold?: boolean;
  holdNote?: string;
  holdAt?: string;
  holdBy?: string;
  qc?: {
    approvedBy: string;
    approvedAt: string;
    note: string;
  };
}

export interface Material {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  lowStock: number;
  batch: string;
  supplier: string;
  expiry: string;
  cost: number;
}

export interface InventoryLog {
  id: string;
  date: string;
  materialId: string;
  caseId?: string;
  quantity: number;
  type: "usage" | "restock" | "adjustment";
  note: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface Payment {
  id: string;
  caseId: string;
  doctorId: string;
  date: string;
  amount: number;
  staffId: string;
  note: string;
  method?: string;
  reference?: string;
  account?: string;
  currency?: "USD" | "SYP";
  sourceAmount?: number;
  exchangeRate?: number;
}

export interface Activity {
  id: string;
  date: string;
  staffId: string;
  action: string;
  entityType?: "case" | "doctor" | "payment" | "inventory" | "team" | "role" | "clinic" | "settings" | "delivery";
  entityId?: string;
}

export interface ClinicProfile {
  phone: string;
  address: string;
  notes: string;
  priceList: Record<string, number>;
}

export interface DeliveryTask {
  id: string;
  type: DeliveryTaskType;
  /** Pickup timing selected by the doctor instead of a fixed appointment. */
  isAsap?: boolean;
  address: string;
  doctorId?: string;
  doctorLabel: string;
  contactDetails: string;
  scheduledDate: string;
  scheduledTime: string;
  assignedTo: string;
  assignedAt: string;
  status: DeliveryTaskStatus;
  /** Doctor-submitted trip requests must be reviewed before a driver sees them. */
  approvalPending?: boolean;
  createdAt: string;
  approvedAt?: string;
  outAt?: string;
  collectedAt?: string;
  completedAt?: string;
}

export interface BrandingSettings {
  title: string;
  subtitle: string;
  logo: string;
}

export interface OraData {
  serviceTypes: string[];
  materialCategories: string[];
  clinics: string[];
  clinicProfiles: Record<string, ClinicProfile>;
  roles: RoleDefinition[];
  doctors: Doctor[];
  staff: StaffMember[];
  cases: LabCase[];
  materials: Material[];
  inventoryLogs: InventoryLog[];
  expenses: Expense[];
  payments: Payment[];
  deliveryTasks: DeliveryTask[];
  activities: Activity[];
  currency: "USD" | "SYP" | "EUR";
  theme: "light" | "dark";
  branding: BrandingSettings;
  workflowOrder: WorkflowOrder;
}

export const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const workflowForImpression = (impressionType: ImpressionType, workflowOrder: WorkflowOrder = DEFAULT_WORKFLOW_ORDER): CaseStatus[] =>
  workflowOrder[impressionType] ?? DEFAULT_WORKFLOW_ORDER[impressionType];

export const caseServiceLines = (labCase: LabCase): CaseServiceLine[] =>
  Array.isArray(labCase.serviceLines) && labCase.serviceLines.length
    ? labCase.serviceLines
    : [{ id: `service-${labCase.id}`, service: labCase.service, units: labCase.units, shade: labCase.shade, unitPrice: labCase.price / Math.max(1, labCase.units) }];

export const caseTotalUnits = (labCase: LabCase) =>
  caseServiceLines(labCase).reduce((sum, line) => sum + line.units, 0);

const ISO_CASE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CASE_DUE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const caseDueAt = (labCase: Pick<LabCase, "dueDate" | "dueTime">) => {
  const date = String(labCase.dueDate || "");
  const time = String(labCase.dueTime || "");
  const isValidDate =
    ISO_CASE_DATE.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime());

  // Older demo records with an incomplete due date should sort after valid deadlines.
  const safeDate = isValidDate ? date : "9999-12-31";
  const safeTime = CASE_DUE_TIME.test(time) ? time : "23:59";

  return new Date(`${safeDate}T${safeTime}:00`);
};

export const isCaseOverdue = (labCase: LabCase, now = new Date()) =>
  !labCase.archived && labCase.status !== "Closed" && caseDueAt(labCase).getTime() < now.getTime();

export const caseTags = (labCase: Pick<LabCase, "priority" | "priorityTags">): CaseTag[] => {
  const tags = Array.isArray(labCase.priorityTags) ? labCase.priorityTags.filter((tag): tag is CaseTag => tag === "Rush" || tag === "Remake") : [];
  return Array.from(new Set<CaseTag>(labCase.priority === "Rush" ? ["Rush", ...tags] : tags));
};

export function createInitialData(): OraData {
  const allPermissions = PERMISSIONS.map(([key]) => key);
  const productionPermissions: PermissionKey[] = ["view_dashboard", "view_cases", "view_schedule", "view_inventory", "case_workflow", "case_notes", "material_usage"];
  const roles: RoleDefinition[] = [
    { id: "role-admin", name: "Admin", color: "#155f57", permissions: allPermissions, specialties: [...CASE_STATUSES] },
    { id: "role-input", name: "Input Manager", color: "#8b5d76", permissions: ["view_dashboard", "view_cases", "view_delivery", "view_doctors", "view_inventory", "view_settings", "case_intake", "case_edit", "case_bulk", "case_notes", "catalog_manage", "clinic_manage", "view_case_value"], specialties: ["Received"] },
    { id: "role-approval", name: "Approval", color: "#3f6f88", permissions: productionPermissions, specialties: ["Approved"] },
    { id: "role-casting", name: "Casting", color: "#8a5b2e", permissions: productionPermissions, specialties: ["Casting"] },
    { id: "role-design", name: "Design", color: "#2f6f9f", permissions: productionPermissions, specialties: ["Design"] },
    { id: "role-printing", name: "Printing", color: "#596aa8", permissions: productionPermissions, specialties: ["Printing"] },
    { id: "role-production", name: "Production", color: "#26736b", permissions: productionPermissions, specialties: ["Production"] },
    { id: "role-finishing", name: "Finishing", color: "#9a6417", permissions: productionPermissions, specialties: ["Finishing"] },
    { id: "role-build-up", name: "Build Up", color: "#31746d", permissions: productionPermissions, specialties: ["Build Up"] },
    { id: "role-glazing", name: "Glazing", color: "#8b5d76", permissions: productionPermissions, specialties: ["Glazing"] },
    { id: "role-quality", name: "Quality Review", color: "#75518a", permissions: [...productionPermissions, "case_qc"], specialties: ["Quality Review"] },
    { id: "role-delivery", name: "Delivery", color: "#2f6f9f", permissions: ["view_delivery", "delivery_manage"], specialties: [] },
    { id: "role-accountant", name: "Accountant", color: "#3f6650", permissions: ["view_dashboard", "view_cases", "view_doctors", "view_accounting", "view_settings", "view_case_value", "view_invoices", "view_payments", "view_doctor_statements", "payment_manage", "expense_manage", "backup_manage"], specialties: [] },
  ];
  return {
    serviceTypes: [...SERVICE_TYPES],
    materialCategories: [...MATERIAL_CATEGORIES],
    clinics: [],
    clinicProfiles: {},
    roles,
    doctors: [],
    staff: [],
    materials: [],
    cases: [],
    currency: "USD",
    theme: "light",
    branding: { title: "Ora", subtitle: "Dental Lab", logo: "" },
    workflowOrder: {
      "Oral Scan": [...DEFAULT_WORKFLOW_ORDER["Oral Scan"]],
      "Physical Impression": [...DEFAULT_WORKFLOW_ORDER["Physical Impression"]],
    },
    expenses: [],
    payments: [],
    deliveryTasks: [],
    inventoryLogs: [],
    activities: [],
  };
}

export function migrateOraData(value: Partial<OraData>): OraData {
  const initial = createInitialData();
  const savedRoles = Array.isArray(value.roles) && value.roles.length ? value.roles : initial.roles;
  const roles = [...savedRoles, ...initial.roles.filter((role) => !savedRoles.some((savedRole) => savedRole.id === role.id))].map((role) => {
    const defaultRole = initial.roles.find((item) => item.id === role.id);
    if (role.id === "role-admin") return { ...role, permissions: PERMISSIONS.map(([key]) => key), specialties: [...CASE_STATUSES] };
    if (["role-input", "role-approval", "role-quality", "role-accountant", "role-build-up", "role-delivery"].includes(role.id) && defaultRole) {
      return { ...role, name: defaultRole.name, permissions: [...defaultRole.permissions], specialties: [...defaultRole.specialties] };
    }
    return {
      ...role,
      permissions: role.permissions.filter((permission) => PERMISSIONS.some(([key]) => key === permission)),
      specialties: role.specialties.map((status) => String(status) === "Planning" ? "Approved" as const : status).filter((status) => CASE_STATUSES.includes(status)),
    };
  });
  const serviceTypes = Array.isArray(value.serviceTypes) && value.serviceTypes.length
    ? [...new Set(value.serviceTypes)]
    : [...initial.serviceTypes];
  const materialCategories = Array.isArray(value.materialCategories) && value.materialCategories.length
    ? [...new Set(value.materialCategories)]
    : [...initial.materialCategories];
  const savedStaff = Array.isArray(value.staff) ? value.staff : initial.staff;
  const staff = savedStaff.map((member) => {
    const initialMember = initial.staff.find((item) => item.id === member.id);
    const legacyRole = roles.find((role) => role.name === member.role);
    const storedRoleIds = Array.isArray(member.roleIds) && member.roleIds.length
      ? member.roleIds.filter((id) => roles.some((role) => role.id === id))
      : initialMember?.roleIds ?? (legacyRole ? [legacyRole.id] : []);
    // Older browser saves could associate a single management title with every
    // role. A member labelled with one of these exact titles must retain only
    // that canonical management role; deliberately combined roles still keep
    // their stored selections.
    const roleTitle = String(member.role ?? "").trim();
    const managementRole = roles.find((role) => role.name === roleTitle);
    const roleIds =
      managementRole &&
      ["role-admin", "role-input", "role-accountant"].includes(managementRole.id)
        ? [managementRole.id]
        : storedRoleIds;
    const roleNames = roleIds.map((id) => roles.find((role) => role.id === id)?.name).filter(Boolean);
    return {
      ...member,
      roleIds,
      role: roleNames.join(" + ") || member.role || "Team member",
      phone: typeof member.phone === "string" ? member.phone : "",
      photo: typeof member.photo === "string" ? member.photo : "",
    };
  });
  const savedDoctors = Array.isArray(value.doctors) ? value.doctors : initial.doctors;
  const savedClinicProfiles = value.clinicProfiles && typeof value.clinicProfiles === "object" ? value.clinicProfiles : {};
  const clinics = [...new Set([
    ...(Array.isArray(value.clinics) ? value.clinics : []),
    ...Object.keys(savedClinicProfiles),
    ...savedDoctors.map((doctor) => doctor.clinic),
  ].map((clinic) => String(clinic).trim()).filter((clinic) => clinic && clinic !== "Independent practice"))];
  const doctors = savedDoctors.map((doctor) => ({
    ...doctor,
    address: typeof doctor.address === "string" ? doctor.address.trim() : "",
    practiceType: doctor.practiceType === "individual" ? "individual" as const : "clinic" as const,
    clinic: doctor.practiceType === "individual" ? "Independent practice" : doctor.clinic,
    priceList: Object.fromEntries(serviceTypes.map((service) => [
      service,
      Number(doctor.priceList?.[service] ?? 0),
    ])),
    portalAccount: doctor.portalAccount
      && typeof doctor.portalAccount.username === "string"
      && typeof doctor.portalAccount.password === "string"
      ? {
          username: doctor.portalAccount.username,
          password: doctor.portalAccount.password,
          createdAt: typeof doctor.portalAccount.createdAt === "string" ? doctor.portalAccount.createdAt : new Date().toISOString(),
        }
      : undefined,
  }));
  const clinicProfiles = Object.fromEntries(clinics.map((clinic) => {
    const savedProfile = savedClinicProfiles[clinic];
    const linkedDoctor = doctors.find((doctor) => doctor.clinic === clinic);
    return [clinic, {
      phone: typeof savedProfile?.phone === "string" ? savedProfile.phone : "",
      address: typeof savedProfile?.address === "string" ? savedProfile.address : "",
      notes: typeof savedProfile?.notes === "string" ? savedProfile.notes : "",
      priceList: Object.fromEntries(serviceTypes.map((service) => [service, Number(savedProfile?.priceList?.[service] ?? linkedDoctor?.priceList?.[service] ?? 0)])),
    }];
  }));

  const normalizeStatus = (status: string): CaseStatus => ({
    QC: "Quality Review",
    Ready: "Quality Review",
    Planning: "Approved",
  })[status] as CaseStatus ?? (CASE_STATUSES.includes(status as CaseStatus) ? status as CaseStatus : "Received");
  const cases = (Array.isArray(value.cases) ? value.cases : initial.cases).map((item) => {
    const status = String(item.status) === "Ready" || String(item.status) === "Delivery" ? "Closed" : normalizeStatus(String(item.status));
    const caseNumber = String(item.caseNumber).replace(/^ORA-/i, "");
    const history = Array.isArray(item.history) && item.history.length
      ? item.history.map((entry) => ({ ...entry, fromStatus: entry.fromStatus ? normalizeStatus(String(entry.fromStatus)) : undefined, toStatus: entry.toStatus ? normalizeStatus(String(entry.toStatus)) : undefined, label: entry.label.replaceAll("ORA-", "").replaceAll("Planning", "Approved") }))
      : [
          { id: `history-migrated-created-${item.id}`, date: `${item.receivedDate}T09:00:00`, staffId: "staff-admin", action: "created" as const, label: `Created case ${caseNumber}` },
          ...(item.assignedTo ? [{ id: `history-migrated-assigned-${item.id}`, date: `${item.receivedDate}T09:05:00`, staffId: "staff-admin", action: "assigned" as const, label: "Opening assignment migrated", toStaffId: item.assignedTo }] : []),
          { id: `history-migrated-stage-${item.id}`, date: `${item.receivedDate}T09:10:00`, staffId: item.assignedTo || "staff-admin", action: "status" as const, label: `Current stage: ${status}`, toStatus: status },
        ];
    const legacyLine = { id: `service-${item.id}-1`, service: item.service, units: Math.max(1, Number(item.units) || 1), shade: item.shade || "Not recorded", unitPrice: Number(item.price) / Math.max(1, Number(item.units) || 1) };
    const serviceLines = Array.isArray(item.serviceLines) && item.serviceLines.length
      ? item.serviceLines.map((line, index) => ({
          id: line.id || `service-${item.id}-${index + 1}`,
          service: String(line.service || item.service),
          units: Math.max(1, Number(line.units) || 1),
          shade: String(line.shade || item.shade || "Not recorded"),
          unitPrice: Math.max(0, Number(line.unitPrice) || 0),
        }))
      : [legacyLine];
    const impressionType: ImpressionType = item.impressionType === "Physical Impression"
      || status === "Casting"
      || history.some((entry) => ("fromStatus" in entry && entry.fromStatus === "Casting") || ("toStatus" in entry && entry.toStatus === "Casting"))
      ? "Physical Impression"
      : "Oral Scan";
    const materialUsage = (Array.isArray(item.materialUsage) ? item.materialUsage : []).map((usage, index) => ({
      ...usage,
      id: usage.id || `usage-${item.id}-${index + 1}`,
      staffId: usage.staffId || item.assignedTo || "staff-admin",
      createdAt: usage.createdAt || `${item.receivedDate}T12:00:00`,
    }));
    const teeth = Array.isArray(item.teeth)
      ? [...new Set(item.teeth.map((tooth) => String(tooth)).filter((tooth) => /^\d{2}$/.test(tooth)))]
      : [];
    const toothConnections = Array.isArray(item.toothConnections)
      ? [...new Set(item.toothConnections.map((connection) => String(connection)).filter((connection) => /^\d{2}:\d{2}$/.test(connection)))]
      : [];
    const priorityTags: CaseTag[] = Array.isArray(item.priorityTags)
      ? Array.from(new Set<CaseTag>(item.priorityTags.filter((tag): tag is CaseTag => tag === "Rush" || tag === "Remake")))
      : item.priority === "Rush" ? ["Rush"] as CaseTag[] : [];
    const intakeSource: CaseIntakeSource = item.intakeSource === "doctor" ? "doctor" : "lab";
    const deliveryStatus: DeliveryStatus = ["awaiting_pickup", "out_for_pickup", "picked_up", "received_at_lab", "awaiting_scan_approval", "awaiting_scan", "out_for_scan", "scanned", "ready", "out_for_delivery", "delivered"].includes(String(item.deliveryStatus))
      ? item.deliveryStatus as DeliveryStatus
      : status === "Closed" ? "ready" : intakeSource === "doctor" && impressionType === "Physical Impression" ? "awaiting_pickup" : intakeSource === "doctor" && impressionType === "Oral Scan" ? "awaiting_scan_approval" : "picked_up";
    return {
      ...item,
      caseNumber,
      status,
      history: history.map((entry) => ({ ...entry, fromStatus: "fromStatus" in entry ? (String(entry.fromStatus) === "Delivery" ? "Quality Review" : entry.fromStatus) : undefined, toStatus: "toStatus" in entry ? (String(entry.toStatus) === "Delivery" ? "Closed" : entry.toStatus) : undefined, label: entry.label.replaceAll("Delivery", "Closed") })),
      impressionType,
      dueTime: /^\d{2}:\d{2}$/.test(item.dueTime || "") ? item.dueTime : "17:00",
      appointmentDate: /^\d{4}-\d{2}-\d{2}$/.test(item.appointmentDate || "") ? item.appointmentDate : undefined,
      appointmentTime: /^\d{2}:\d{2}$/.test(item.appointmentTime || "") ? item.appointmentTime : undefined,
      intakeSource,
      intakeApprovalPending: intakeSource === "doctor" && Boolean(item.intakeApprovalPending),
      deliveryStatus,
      deliveryLocation: typeof item.deliveryLocation === "string" ? item.deliveryLocation.trim() : "",
      deliveryAssigneeId: typeof item.deliveryAssigneeId === "string" ? item.deliveryAssigneeId : undefined,
      deliveryAssignedAt: typeof item.deliveryAssignedAt === "string" ? item.deliveryAssignedAt : undefined,
      invoiceAcceptedAt: typeof item.invoiceAcceptedAt === "string" ? item.invoiceAcceptedAt : undefined,
      invoiceAcceptedBy: typeof item.invoiceAcceptedBy === "string" ? item.invoiceAcceptedBy : undefined,
      onHold: Boolean(item.onHold),
      holdNote: typeof item.holdNote === "string" ? item.holdNote.trim() : "",
      holdAt: typeof item.holdAt === "string" ? item.holdAt : undefined,
      holdBy: typeof item.holdBy === "string" ? item.holdBy : undefined,
      serviceLines,
      service: serviceLines[0].service,
      units: serviceLines.reduce((sum, line) => sum + line.units, 0),
      shade: serviceLines.map((line) => line.shade).filter(Boolean).join(" / "),
      materialUsage,
      doctorMessages: Array.isArray(item.doctorMessages) ? item.doctorMessages.map((message, index) => ({
        id: typeof message.id === "string" && message.id ? message.id : `doctor-message-${item.id}-${index + 1}`,
        author: message.author === "lab" ? "lab" as const : "doctor" as const,
        authorName: typeof message.authorName === "string" && message.authorName ? message.authorName : message.author === "lab" ? "Ora team" : "Doctor",
        text: typeof message.text === "string" ? message.text : "",
        createdAt: typeof message.createdAt === "string" ? message.createdAt : `${item.receivedDate}T12:00:00`,
        attachments: Array.isArray(message.attachments) ? message.attachments.map((attachment, attachmentIndex) => ({
          id: typeof attachment.id === "string" && attachment.id ? attachment.id : `attachment-${item.id}-${index + 1}-${attachmentIndex + 1}`,
          name: typeof attachment.name === "string" ? attachment.name : "Attachment",
          type: typeof attachment.type === "string" ? attachment.type : "application/octet-stream",
          size: Number(attachment.size) || 0,
          dataUrl: typeof attachment.dataUrl === "string" ? attachment.dataUrl : "",
        })).filter((attachment) => attachment.dataUrl) : [],
      })) : [],
      teeth,
      toothConnections,
      priority: priorityTags.includes("Rush") ? "Rush" as const : "Normal" as const,
      priorityTags,
    };
  });
  const payments = Array.isArray(value.payments)
    ? value.payments.map((payment) => ({
        ...payment,
        method:
          typeof payment.method === "string" && payment.method.trim()
            ? payment.method.trim()
            : "Cash",
        reference:
          typeof payment.reference === "string" && payment.reference.trim()
            ? payment.reference.trim()
            : `PAY-${String(payment.id).replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase()}`,
        account:
          typeof payment.account === "string" && payment.account.trim()
            ? payment.account.trim()
            : "Petty Cash",
      }))
    : cases.filter((item) => item.paid > 0).map((item) => ({
        id: `payment-migrated-${item.id}`,
        caseId: item.id,
        doctorId: item.doctorId,
        date: `${item.receivedDate}T12:00:00`,
        amount: item.paid,
        staffId: "staff-admin",
        note: "Migrated opening balance",
        method: "Cash",
        reference: `PAY-${item.caseNumber.replace(/^ORA-/i, "")}`,
        account: "Petty Cash",
      }));
  const deliveryTasks = Array.isArray(value.deliveryTasks) ? value.deliveryTasks.map((task, index) => ({
    id: typeof task.id === "string" && task.id ? task.id : `delivery-task-${index + 1}`,
    type: task.type === "pickup" ? "pickup" as const : task.type === "oral-scan" ? "oral-scan" as const : "delivery" as const,
    isAsap: Boolean(task.isAsap),
    address: typeof task.address === "string" ? task.address.trim() : "",
    doctorId: typeof task.doctorId === "string" ? task.doctorId : undefined,
    doctorLabel: typeof task.doctorLabel === "string" && task.doctorLabel.trim() ? task.doctorLabel.trim() : "Other contact",
    contactDetails: typeof task.contactDetails === "string" ? task.contactDetails.trim() : "",
    scheduledDate: /^\d{4}-\d{2}-\d{2}$/.test(task.scheduledDate || "") ? task.scheduledDate : toISODate(new Date()),
    scheduledTime: /^\d{2}:\d{2}$/.test(task.scheduledTime || "") ? task.scheduledTime : "12:00",
    assignedTo: typeof task.assignedTo === "string" ? task.assignedTo : "",
    assignedAt: typeof task.assignedAt === "string" ? task.assignedAt : typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString(),
    status: task.status === "out" || task.status === "collected" || task.status === "completed" ? task.status : "scheduled" as const,
    approvalPending: Boolean(task.approvalPending),
    createdAt: typeof task.createdAt === "string" ? task.createdAt : new Date().toISOString(),
    approvedAt: typeof task.approvedAt === "string" ? task.approvedAt : undefined,
    outAt: typeof task.outAt === "string" ? task.outAt : undefined,
    collectedAt: typeof task.collectedAt === "string" ? task.collectedAt : undefined,
    completedAt: typeof task.completedAt === "string" ? task.completedAt : undefined,
  })) : [];

  const normalizeWorkflow = (impressionType: ImpressionType) => {
    const fallback = DEFAULT_WORKFLOW_ORDER[impressionType];
    const saved = value.workflowOrder?.[impressionType];
    const allowed = new Set(fallback);
    const ordered = Array.isArray(saved)
      ? saved.map((status) => String(status) === "Planning" ? "Approved" : String(status)).filter((status): status is CaseStatus => CASE_STATUSES.includes(status as CaseStatus) && allowed.has(status as CaseStatus))
      : [];
    const complete = [...new Set([...ordered, ...fallback])];
    return ["Received", ...complete.filter((status) => status !== "Received" && status !== "Closed"), "Closed"] as CaseStatus[];
  };
  const workflowOrder: WorkflowOrder = {
    "Oral Scan": normalizeWorkflow("Oral Scan"),
    "Physical Impression": normalizeWorkflow("Physical Impression"),
  };

  return {
    ...initial,
    ...value,
    serviceTypes,
    materialCategories,
    clinics,
    clinicProfiles,
    roles,
    staff,
    doctors,
    cases,
    materials: Array.isArray(value.materials) ? value.materials : initial.materials,
    inventoryLogs: Array.isArray(value.inventoryLogs) ? value.inventoryLogs : initial.inventoryLogs,
    expenses: Array.isArray(value.expenses) ? value.expenses : initial.expenses,
    payments,
    deliveryTasks,
    activities: (Array.isArray(value.activities) ? value.activities : initial.activities).map((activity) => ({ ...activity, action: activity.action.replaceAll("ORA-", "") })),
    workflowOrder,
    theme: value.theme === "dark" ? "dark" : "light",
    branding: {
      title: typeof value.branding?.title === "string" && value.branding.title.trim() ? value.branding.title.trim() : "Ora",
      subtitle: typeof value.branding?.subtitle === "string" && value.branding.subtitle.trim() ? value.branding.subtitle.trim() : "Dental Lab",
      logo: typeof value.branding?.logo === "string" ? value.branding.logo : "",
    },
  };
}

/** Frontend fixture data used by the Ora interface. */
export function createDemoData(): OraData {
  const base = createInitialData();
  const today = new Date();
  const date = (offset: number) => {
    const value = new Date(today);
    value.setDate(value.getDate() + offset);
    return toISODate(value);
  };
  // Keep the initial fixture stable across the server render and browser hydration.
  const now = `${date(0)}T09:00:00.000Z`;
  const staff: StaffMember[] = [
    { id: "staff-admin", name: "Hassan", role: "Admin", roleIds: ["role-admin"], initials: "H", phone: "+963 900 000 001", color: "#17665d", photo: "" },
    { id: "staff-input", name: "Lina", role: "Input Manager", roleIds: ["role-input"], initials: "L", phone: "+963 900 000 002", color: "#2f7eae", photo: "" },
    { id: "staff-design", name: "Omar", role: "Design", roleIds: ["role-design"], initials: "O", phone: "+963 900 000 003", color: "#75518a", photo: "" },
    { id: "staff-production", name: "Maya", role: "Production", roleIds: ["role-production"], initials: "M", phone: "+963 900 000 004", color: "#34756c", photo: "" },
    { id: "staff-quality", name: "Nour", role: "Quality Review", roleIds: ["role-quality"], initials: "N", phone: "+963 900 000 005", color: "#9a6417", photo: "" },
    { id: "staff-delivery", name: "Tariq", role: "Delivery", roleIds: ["role-delivery"], initials: "T", phone: "+963 900 000 006", color: "#2f6f9f", photo: "" },
    { id: "staff-accountant", name: "Rana", role: "Accountant", roleIds: ["role-accountant"], initials: "R", phone: "+963 900 000 007", color: "#3f6650", photo: "" },
  ];
  const serviceTypes = [...base.serviceTypes];
  const clinics = ["Al Noor Dental Center", "Independent practice"];
  const clinicProfiles: Record<string, ClinicProfile> = {
    "Al Noor Dental Center": { phone: "+963 11 555 0101", address: "Damascus, Syria", notes: "Shared clinic pricing.", priceList: Object.fromEntries(serviceTypes.map((service, index) => [service, [58, 72, 50, 90, 30, 38, 120][index] ?? 50])) },
  };
  const doctors: Doctor[] = [
    { id: "doc-noor", name: "Dr. Rami Haddad", clinic: "Al Noor Dental Center", practiceType: "clinic", phone: "+963 11 555 0101", address: "Damascus, Syria", priceList: clinicProfiles["Al Noor Dental Center"].priceList },
    { id: "doc-layla", name: "Dr. Layla Mansour", clinic: "Independent practice", practiceType: "individual", phone: "+963 944 000 010", address: "Damascus, Syria", priceList: Object.fromEntries(serviceTypes.map((service, index) => [service, [62, 76, 54, 94, 32, 40, 128][index] ?? 52])) },
  ];
  const makeCase = (id: string, caseNumber: string, doctorId: string, patient: string, status: CaseStatus, impressionType: ImpressionType, assignedTo: string, receivedOffset: number, dueOffset: number, units: number, unitPrice: number): LabCase => {
    const line: CaseServiceLine = { id: `${id}-line-1`, service: "Zirconia Crown", units, shade: "A2", unitPrice };
    const receivedDate = date(receivedOffset);
    return {
      id, caseNumber, doctorId, patient, patientRef: "P-" + caseNumber, service: line.service, units, shade: line.shade, serviceLines: [line], receivedDate, dueDate: date(dueOffset), dueTime: "17:00", appointmentDate: date(dueOffset + 1), appointmentTime: "11:00", impressionType, status, priority: dueOffset <= 0 ? "Rush" : "Normal", assignedTo, telegramRef: "Telegram intake reference", price: units * unitPrice, paid: 0, notes: [], materialUsage: [],
      history: [{ id: `${id}-history-1`, date: `${receivedDate}T09:00:00`, staffId: "staff-input", action: "created", label: `Created case ${caseNumber}` }, { id: `${id}-history-2`, date: now, staffId: assignedTo || "staff-input", action: "status", label: `Current stage: ${status}`, toStatus: status }],
    };
  };
  const cases = [
    makeCase("case-1060", "1060", "doc-noor", "Khaled A.", "Received", "Physical Impression", "staff-input", -2, 2, 2, 58),
    makeCase("case-1059", "1059", "doc-noor", "Ahmed M.", "Approved", "Oral Scan", "staff-admin", -3, 1, 1, 58),
    makeCase("case-1058", "1058", "doc-layla", "Maya D.", "Production", "Oral Scan", "staff-production", -7, -1, 3, 62),
    makeCase("case-1057", "1057", "doc-noor", "Hesham M.", "Quality Review", "Physical Impression", "staff-quality", -8, 0, 1, 58),
    makeCase("case-1056", "1056", "doc-layla", "Lina K.", "Design", "Oral Scan", "staff-design", -4, 4, 2, 62),
    makeCase("case-1055", "1055", "doc-noor", "Salma R.", "Closed", "Oral Scan", "", -9, 1, 2, 58),
  ];
  const incomingPhysical = cases.find((item) => item.id === "case-1060")!;
  incomingPhysical.intakeSource = "doctor";
  incomingPhysical.deliveryStatus = "awaiting_pickup";
  incomingPhysical.deliveryLocation = "Al Noor Dental Center, Damascus, Syria";
  const pendingOralScan = cases.find((item) => item.id === "case-1059")!;
  pendingOralScan.intakeSource = "doctor";
  pendingOralScan.deliveryStatus = "awaiting_scan_approval";
  pendingOralScan.deliveryLocation = "Al Noor Dental Center, Damascus, Syria";
  const outboundDelivery = cases.find((item) => item.id === "case-1055")!;
  outboundDelivery.deliveryStatus = "ready";
  outboundDelivery.deliveryLocation = "Al Noor Dental Center, Damascus, Syria";
  const payments: Payment[] = [{ id: "payment-1058", caseId: "case-1058", doctorId: "doc-layla", date: now, amount: 62, staffId: "staff-accountant", note: "Payment received" }];
  cases.find((item) => item.id === "case-1058")!.paid = 62;
  const materials: Material[] = [
    { id: "mat-zirconia", name: "Zirconia disc", category: "Discs", stock: 14, unit: "discs", lowStock: 5, batch: "ZD-2026-08", supplier: "Dental Materials Co.", expiry: date(365), cost: 34 },
    { id: "mat-resin", name: "Model resin", category: "Resins", stock: 2.4, unit: "L", lowStock: 3, batch: "MR-2026-06", supplier: "Print Supply", expiry: date(240), cost: 46 },
    { id: "mat-glaze", name: "Glazing ceramic", category: "Ceramics", stock: 8, unit: "packs", lowStock: 2, batch: "GC-2026-07", supplier: "Ceramic Studio", expiry: date(410), cost: 18 },
  ];
  return migrateOraData({ ...base, clinics, clinicProfiles, doctors, staff, cases, payments, materials, expenses: [{ id: "expense-1", date: date(-3), category: "Materials", description: "Monthly zirconia restock", amount: 420 }], activities: cases.slice(0, 4).map((item) => ({ id: `activity-${item.id}`, date: now, staffId: item.assignedTo || "staff-input", action: `Working on case ${item.caseNumber}`, entityType: "case" as const, entityId: item.id })) });
}
