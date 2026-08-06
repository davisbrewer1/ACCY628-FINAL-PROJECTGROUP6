export type UserRole =
  | "administrator"
  | "executive"
  | "service_manager"
  | "account_manager"
  | "technician"
  | "billing"
  | "client_admin"
  | "client_user";

export type TicketStatus =
  | "New"
  | "Assigned"
  | "In Progress"
  | "On Hold"
  | "Waiting on Customer"
  | "Waiting on Vendor"
  | "Waiting on Approval"
  | "Escalated"
  | "Completed"
  | "Closed";

export type TicketPriority = "Critical" | "High" | "Medium" | "Low";

export type InvoiceStatus =
  | "Draft"
  | "Pending Approval"
  | "Issued"
  | "Partially Paid"
  | "Paid"
  | "Past Due"
  | "Disputed"
  | "Canceled";

export type SlaStatus =
  | "On Track"
  | "Approaching Deadline"
  | "Overdue"
  | "Completed on Time"
  | "Completed Late";

export type ServiceFamily =
  | "Hardware Procurement & Lifecycle"
  | "Software & Cloud Management"
  | "Managed IT Support"
  | "Cybersecurity Monitoring"
  | "AI Governance"
  | "Deployment & Retirement";

export type HardwareCategory =
  | "laptop"
  | "desktop"
  | "server"
  | "switch"
  | "firewall"
  | "AP"
  | "mobile"
  | "printer"
  | "storage"
  | "conference"
  | "IoT"
  | "security appliance";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  customer_id: string | null;
  active: boolean;
  created_at: string;
  phone: string | null;
  notification_preferences: NotificationPreferences | Record<string, unknown> | null;
  communication_preferences: CommunicationPreferences | Record<string, unknown> | null;
}

export interface NotificationPreferences {
  ticket_updates?: boolean;
  security_alerts?: boolean;
  billing_notices?: boolean;
  announcements?: boolean;
  email_enabled?: boolean;
  sms_enabled?: boolean;
}

export interface CommunicationPreferences {
  preferred_channel?: "email" | "phone" | "sms" | string;
  best_time?: string;
  language?: string;
  marketing_opt_in?: boolean;
}

export interface ClientContact {
  id: string;
  profile_id: string;
  customer_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  preferred_contact: boolean;
  notes: string | null;
  created_at: string;
}

export interface TicketRating {
  id: string;
  ticket_id: string;
  customer_id: string;
  technician_id: string | null;
  rated_by: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractPlanChangeRequest {
  id: string;
  contract_id: string;
  customer_id: string;
  current_plan_id: string | null;
  requested_plan_id: string | null;
  request_type: "plan_change" | "termination" | string;
  requested_by: string;
  status: "Pending" | "Approved" | "Denied" | "Cancelled" | string;
  client_note: string | null;
  manager_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_name: string;
  industry: string | null;
  primary_contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: string | null;
  notes: string | null;
  account_manager_id: string | null;
  technology_health_score: number | null;
  created_at: string;
}

export type PlanPricingModel = "Monthly" | "Yearly" | "Up-front";

export interface ServicePlan {
  id: string;
  name: string;
  description: string | null;
  pricing_model: PlanPricingModel | string;
  base_price: number;
  included_support_hours: number;
  included_asset_budget: number;
  additional_hourly_rate: number;
  additional_asset_rate: number;
  billing_frequency: string;
  payment_terms: string | null;
  invoice_due_days: number | null;
  setup_fee: number;
  /** @deprecated Prefer late_fee_percent + late_fee_period_days */
  late_fee_policy: string | null;
  late_fee_percent: number;
  late_fee_period_days: number;
  revenue_recognition_method: string | null;
  active: boolean;
  created_at: string;
}

export interface Contract {
  id: string;
  customer_id: string;
  plan_id?: string | null;
  contract_name: string;
  contract_status: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  automatic_renewal: boolean | null;
  service_plan_name: string | null;
  monthly_recurring_fee: number | null;
  included_support_hours: number | null;
  included_asset_budget?: number | null;
  additional_hourly_rate: number | null;
  additional_asset_rate?: number | null;
  emergency_support_rate: number | null;
  onsite_support_rate: number | null;
  remote_support_included: boolean | null;
  onsite_support_included: boolean | null;
  preventive_maintenance_frequency: string | null;
  critical_response_target_hours: number | null;
  high_response_target_hours: number | null;
  standard_response_target_hours: number | null;
  resolution_target_hours: number | null;
  support_coverage: string | null;
  billing_frequency: string | null;
  payment_terms: string | null;
  invoice_due_days: number | null;
  setup_fee: number | null;
  /** @deprecated Prefer late_fee_percent + late_fee_period_days */
  late_fee_policy: string | null;
  late_fee_percent?: number | null;
  late_fee_period_days?: number | null;
  pass_through_charges_allowed: boolean | null;
  revenue_recognition_method: string | null;
  contract_owner_id: string | null;
  approval_status: string | null;
  notes: string | null;
  included_services?: string[] | null;
  created_at: string;
}

export interface Technician {
  id: string;
  profile_id: string | null;
  technician_name: string;
  specialty: string | null;
  internal_hourly_cost: number | null;
  hourly_rate?: number | null;
  annual_pto_hours?: number | null;
  active: boolean;
  created_at: string;
}

export interface TechnicianPtoRequest {
  id: string;
  technician_id: string;
  start_date: string;
  end_date: string;
  hours_requested: number;
  reason: string | null;
  status: "Pending" | "Approved" | "Denied" | "Cancelled" | string;
  created_at: string;
}

export interface ServiceTicket {
  id: string;
  ticket_number: string;
  customer_id: string;
  contract_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  priority: TicketPriority | string | null;
  service_method: string | null;
  assigned_technician_id: string | null;
  opened_at: string | null;
  target_response_at: string | null;
  target_resolution_at: string | null;
  responded_at: string | null;
  completed_at: string | null;
  status: TicketStatus | string | null;
  customer_approval_required: boolean | null;
  additional_work_suspected: boolean | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  location: string | null;
  requester_name: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  hardware_asset_id: string | null;
  severity: string | null;
  resolution_notes: string | null;
  ai_involved: boolean | null;
  cybersecurity_incident: boolean | null;
  additional_billable_work: boolean | null;
  approval_status: string | null;
  invoice_status: string | null;
  scheduled_start: string | null;
  scheduled_window: string | null;
}

export interface WorkEntry {
  id: string;
  ticket_id: string;
  customer_id: string;
  contract_id: string | null;
  technician_id: string;
  work_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hours_worked: number | null;
  work_performed: string | null;
  resolution_notes: string | null;
  service_method: string | null;
  parts_cost: number | null;
  software_cost: number | null;
  equipment_cost: number | null;
  travel_cost: number | null;
  other_cost: number | null;
  labor_cost: number | null;
  total_direct_cost: number | null;
  parts_used?: Array<{
    partId: string;
    partName?: string;
    unitCost: number;
    quantity: number;
  }> | null;
  included_in_contract: boolean | null;
  additional_approval_required: boolean | null;
  approval_status: string | null;
  billing_status: string | null;
  invoice_id: string | null;
  approval_notes: string | null;
  created_at: string;
}

export interface WorkNote {
  id: string;
  ticket_id: string;
  technician_id: string | null;
  note: string;
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  technician_id: string | null;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface TicketFlag {
  id: string;
  ticket_id: string;
  technician_id: string | null;
  flag_type: "security" | "ai" | string;
  created_at: string;
}

export type NotificationType =
  | "ticket_assigned"
  | "ticket_status_changed"
  | "sla_at_risk"
  | "emergency_incident"
  | "critical_ticket"
  | "ai_monitoring"
  | "hardware_offline"
  | "customer_reply"
  | "work_approval"
  | "manager_message"
  | "upcoming_task";

export interface AppNotification {
  id: string;
  technician_id: string;
  type: NotificationType | string;
  message: string;
  created_at: string;
  read: boolean;
}

export type KnowledgeBaseCategory =
  | "Service Procedures"
  | "Troubleshooting Guides"
  | "Tools & Software"
  | "Standards & Policies"
  | "Templates & Forms"
  | "Quick Access";

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category: KnowledgeBaseCategory | string;
  tags: string[];
  updated_at: string;
  created_by: string | null;
  created_at?: string;
}

export interface InventoryPart {
  id: string;
  part_name: string;
  sku: string;
  unit_cost: number;
  active: boolean;
  quantity: number;
  low_stock_threshold: number;
  category: string;
  compatible_assets: string;
  updated_at: string;
  last_restocked_at: string | null;
  created_at: string;
}

export interface SoftwareCatalogItem {
  id: string;
  software_name: string;
  license_cost: number;
  active: boolean;
  created_at: string;
}

export interface CostEntry {
  id: string;
  work_entry_id: string | null;
  ticket_id: string | null;
  technician_id: string | null;
  customer_id: string | null;
  contract_id: string | null;
  labor_hours: number;
  miles: number;
  other_category: string | null;
  labor_cost: number;
  travel_cost: number;
  equipment_cost: number;
  software_cost: number;
  other_cost: number;
  total_cost: number;
  billing_status: "Included" | "Billable" | string;
  approval_required: boolean;
  approval_status: string;
  service_key: string | null;
  parts_used: unknown;
  software_installed: unknown;
  overrides: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ExpenseType =
  | "Travel"
  | "Supplies"
  | "Meals"
  | "Parking"
  | "Miscellaneous";

export type ExpenseTag =
  | "Billable to Customer"
  | "Internal Company Expense";

export type ApprovalStatus = "Pending" | "Approved" | "Denied";

export interface TicketExpense {
  id: string;
  ticket_id: string;
  technician_id: string | null;
  type: ExpenseType | string;
  expense_tag: ExpenseTag | string;
  amount: number;
  description: string | null;
  date: string;
  receipt_url: string | null;
  approval_status: ApprovalStatus | string | null;
  created_at: string;
}

export const EXPENSE_TYPES: ExpenseType[] = [
  "Travel",
  "Supplies",
  "Meals",
  "Parking",
  "Miscellaneous",
];

export const EXPENSE_TAGS: ExpenseTag[] = [
  "Internal Company Expense",
  "Billable to Customer",
];

export const DEFAULT_EXPENSE_TAG: ExpenseTag = "Internal Company Expense";

export interface Approval {
  id: string;
  ticket_id: string | null;
  technician_id: string | null;
  manager_id: string | null;
  cost_entry_id: string | null;
  work_entry_id: string | null;
  ticket_expense_id: string | null;
  status: ApprovalStatus | string;
  reason: string | null;
  manager_notes: string | null;
  total_cost: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalAttachment {
  id: string;
  approval_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export type InvoiceSource =
  | "manual"
  | "plan_recurring"
  | "work_entries"
  | "asset_overage";

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  contract_id: string | null;
  invoice_date: string | null;
  due_date: string | null;
  recurring_service_fee: number | null;
  additional_support_charges: number | null;
  software_charges: number | null;
  equipment_charges: number | null;
  other_charges: number | null;
  late_fee_amount?: number | null;
  total_amount: number | null;
  amount_paid: number | null;
  remaining_balance: number | null;
  status: InvoiceStatus | string | null;
  invoice_source?: InvoiceSource | string | null;
  billing_period?: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  customer_id: string;
  payment_date: string | null;
  payment_amount: number | null;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Alert {
  id: string;
  customer_id: string | null;
  contract_id: string | null;
  ticket_id: string | null;
  alert_type: string;
  alert_message: string;
  severity: string | null;
  resolved: boolean;
  created_at: string;
}

export interface ServiceCatalogItem {
  id: string;
  service_name: string;
  service_family: ServiceFamily | string;
  business_problem: string | null;
  includes_hardware: boolean;
  includes_software: boolean;
  includes_labor: boolean;
  includes_support: boolean;
  whats_included: string | null;
  pricing_model: string | null;
  base_price: number | null;
  provider_cost_components: string | null;
  estimated_provider_cost: number | null;
  status: string;
  created_at: string;
}

export interface HardwareAsset {
  id: string;
  asset_number: string;
  customer_id: string;
  quantity: number;
  location: string | null;
  category: HardwareCategory | string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  warranty_expiration: string | null;
  assigned_employee: string | null;
  operating_system: string | null;
  device_status: string;
  lifecycle_stage: string;
  estimated_replacement_date: string | null;
  purchase_cost: number | null;
  current_value: number | null;
  managed_coverage: boolean;
  support_contract: string | null;
  warranty_expiring_soon: boolean;
  nearing_eol: boolean;
  needs_replacement: boolean;
  unsupported_os: boolean;
  missing_security_updates: boolean;
  notes: string | null;
  created_at: string;
  health_score: number | null;
  last_backup_at: string | null;
  asset_tag?: string | null;
  cpu?: string | null;
  ram?: string | null;
  storage?: string | null;
  mac_address?: string | null;
  ip_address?: string | null;
  battery_health?: string | null;
  smart_disk_status?: string | null;
  last_check_in?: string | null;
  online_status?: string | null;
  patch_status?: string | null;
  antivirus_status?: string | null;
  cpu_pct?: number | null;
  ram_pct?: number | null;
  disk_pct?: number | null;
}

export interface AssetSoftware {
  id: string;
  asset_id: string;
  app_name: string;
  version: string | null;
  license_status: string | null;
  update_available: boolean | null;
  created_at: string;
}

export interface AssetMonitoring {
  id: string;
  asset_id: string;
  checked_at: string | null;
  online_status: string | null;
  patch_status: string | null;
  antivirus_status: string | null;
  cpu_pct: number | null;
  ram_pct: number | null;
  disk_pct: number | null;
  alert_summary: string | null;
  created_at: string;
}

export interface AssetIncident {
  id: string;
  asset_id: string;
  title: string;
  description: string | null;
  severity: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AssetRepair {
  id: string;
  asset_id: string;
  note: string | null;
  repaired_by: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AssetAssignment {
  id: string;
  asset_id: string;
  assigned_user: string | null;
  assigned_location: string | null;
  notes: string | null;
  assigned_at: string;
  created_by: string | null;
}

export interface AssetPhoto {
  id: string;
  asset_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export type AssetOrderTicketStatus =
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Needs more information";

export interface AssetOrderTicket {
  id: string;
  ticket_number: string;
  asset_id: string;
  customer_id: string;
  requested_by: string;
  replacement_manufacturer: string;
  replacement_model: string;
  requested_quantity: number;
  priority: "Low" | "Medium" | "High" | "Urgent";
  business_justification: string;
  technical_requirements: string | null;
  preferred_vendor: string | null;
  estimated_unit_cost: number | null;
  needed_by: string | null;
  status: AssetOrderTicketStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InventoryReorderRequestStatus =
  | "Pending"
  | "Approved"
  | "Rejected";

export interface InventoryReorderRequest {
  id: string;
  part_id: string;
  requested_by: string | null;
  requested_quantity: number;
  notes: string | null;
  status: InventoryReorderRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecurityScore {
  id: string;
  customer_id: string;
  health_score: number;
  firewall_status: string | null;
  endpoint_coverage_pct: number | null;
  antivirus_current_pct: number | null;
  patch_compliance_pct: number | null;
  encryption_coverage_pct: number | null;
  mfa_adoption_pct: number | null;
  last_assessed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface SecurityAlert {
  id: string;
  customer_id: string | null;
  alert_type: string;
  title: string;
  description: string | null;
  severity: string;
  why_it_matters: string | null;
  recommended_solution: string | null;
  estimated_impact: string | null;
  status: string;
  detected_at: string;
  resolved_at: string | null;
  created_at: string;
}

export interface AiPlatform {
  id: string;
  customer_id: string;
  platform_name: string;
  vendor: string | null;
  department: string | null;
  licensed_users: number;
  active_users: number;
  inactive_users: number;
  utilization_pct: number | null;
  monthly_subscription_cost: number | null;
  monthly_api_cost: number | null;
  adoption_trend: string | null;
  security_alert_count: number;
  compliance_score: number | null;
  health_score: number | null;
  uptime_pct: number | null;
  status: string;
  license_expires_on: string | null;
  notes: string | null;
  created_at: string;
}

export interface AiPolicy {
  id: string;
  customer_id: string | null;
  policy_name: string;
  policy_type: string;
  description: string | null;
  approved_platforms: string | null;
  restricted_platforms: string | null;
  confidential_data_rules: string | null;
  department_permissions: string | null;
  training_required: boolean;
  status: string;
  created_at: string;
}

export interface AiRisk {
  id: string;
  customer_id: string | null;
  platform_id: string | null;
  risk_type: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  detected_at: string;
  created_at: string;
}

export interface AiUserCompliance {
  id: string;
  customer_id: string;
  employee_name: string;
  department: string | null;
  policy_id: string | null;
  acknowledgment_status: string;
  training_status: string;
  last_acknowledged_at: string | null;
  created_at: string;
}

export interface Recommendation {
  id: string;
  customer_id: string | null;
  contract_id: string | null;
  source_area: string;
  title: string;
  risk_exists: string | null;
  why_it_matters: string | null;
  recommended_solution: string | null;
  estimated_impact: string | null;
  estimated_monthly_savings: number | null;
  estimated_monthly_revenue: number | null;
  priority: string;
  status: string;
  created_by: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  customer_id: string | null;
  title: string;
  body: string;
  audience: string;
  published_at: string;
  active: boolean;
  created_at: string;
}

export const TICKET_CATEGORIES = [
  "Hardware Support",
  "Software Support",
  "Network",
  "Cybersecurity",
  "Cloud",
  "Microsoft 365",
  "AI Assistance",
  "Hardware Deployment",
  "Device Replacement",
  "Project Work",
] as const;

/** Top-level categories for the client Support Ticket form. */
export const SUPPORT_ISSUE_CATEGORIES = [
  "AI Issue",
  "Security Concern",
  "Software/Hardware Issue",
] as const;

export type SupportIssueCategory = (typeof SUPPORT_ISSUE_CATEGORIES)[number];

export const SUPPORT_ISSUE_SUBCATEGORIES: Record<SupportIssueCategory, string[]> = {
  "AI Issue": [
    "General AI Assistance",
    "Chatbot / Copilot not working",
    "Incorrect or unsafe AI output",
    "AI access or license issue",
    "AI policy / governance question",
    "Other AI issue",
  ],
  "Security Concern": [
    "Suspected phishing",
    "Malware or ransomware",
    "Unauthorized access",
    "Lost or stolen device",
    "Data exposure / privacy concern",
    "Other security concern",
  ],
  "Software/Hardware Issue": [
    "Hardware Support",
    "Software Support",
    "Network",
    "Cloud",
    "Microsoft 365",
    "Hardware Deployment",
    "Device Replacement",
    "Project Work",
  ],
};

export const TICKET_STATUSES: TicketStatus[] = [
  "New",
  "Assigned",
  "In Progress",
  "On Hold",
  "Waiting on Customer",
  "Waiting on Vendor",
  "Waiting on Approval",
  "Escalated",
  "Completed",
  "Closed",
];

export const HARDWARE_CATEGORIES: HardwareCategory[] = [
  "laptop",
  "desktop",
  "server",
  "switch",
  "firewall",
  "AP",
  "mobile",
  "printer",
  "storage",
  "conference",
  "IoT",
  "security appliance",
];

export const SERVICE_FAMILIES: ServiceFamily[] = [
  "Hardware Procurement & Lifecycle",
  "Software & Cloud Management",
  "Managed IT Support",
  "Cybersecurity Monitoring",
  "AI Governance",
  "Deployment & Retirement",
];
