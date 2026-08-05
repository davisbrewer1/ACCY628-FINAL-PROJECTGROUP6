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

export interface Contract {
  id: string;
  customer_id: string;
  contract_name: string;
  contract_status: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_date: string | null;
  automatic_renewal: boolean | null;
  service_plan_name: string | null;
  monthly_recurring_fee: number | null;
  included_support_hours: number | null;
  additional_hourly_rate: number | null;
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
  late_fee_policy: string | null;
  pass_through_charges_allowed: boolean | null;
  revenue_recognition_method: string | null;
  contract_owner_id: string | null;
  approval_status: string | null;
  notes: string | null;
  created_at: string;
}

export interface Technician {
  id: string;
  profile_id: string | null;
  technician_name: string;
  specialty: string | null;
  internal_hourly_cost: number | null;
  active: boolean;
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
  severity: string | null;
  resolution_notes: string | null;
  ai_involved: boolean | null;
  cybersecurity_incident: boolean | null;
  additional_billable_work: boolean | null;
  approval_status: string | null;
  invoice_status: string | null;
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
  included_in_contract: boolean | null;
  additional_approval_required: boolean | null;
  approval_status: string | null;
  billing_status: string | null;
  invoice_id: string | null;
  created_at: string;
}

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
  total_amount: number | null;
  amount_paid: number | null;
  remaining_balance: number | null;
  status: InvoiceStatus | string | null;
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

export const TICKET_STATUSES: TicketStatus[] = [
  "New",
  "Assigned",
  "In Progress",
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
