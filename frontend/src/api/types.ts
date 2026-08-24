export type CompanyTier = "day1_mass_recruiter" | "dream" | "regular" | "niche";
export type InterviewStatusValue = "pending" | "scheduled" | "unscheduled" | "cancelled";

export interface Panel {
  id: number;
  label: string;
  active: boolean;
  company_id?: number;
}

export interface Company {
  id: number;
  name: string;
  tier: CompanyTier;
  cgpa_cutoff: number;
  interview_duration_minutes: number;
  scheduled_day: number;
  priority_rank: number;
  arrival_delay_minutes: number;
  panels: Panel[];
  scheduled: number | null;
  unscheduled: number | null;
  total: number | null;
}

export interface Room {
  id: number;
  name: string;
  available: boolean;
}

export interface Student {
  id: number;
  roll_no: string;
  name: string;
  branch: string;
  cgpa: number;
  withdrawn: boolean;
}

export interface InterviewParty {
  id: number;
  name: string;
  roll_no?: string;
  branch?: string;
  cgpa?: number;
  tier?: CompanyTier;
}

export interface Interview {
  id: number;
  student: InterviewParty;
  company: InterviewParty;
  status: InterviewStatusValue;
  day: number | null;
  start_slot: number | null;
  clock: string | null;
  duration_minutes: number;
  room: string | null;
  panel: string | null;
  unscheduled_reason: string | null;
}

export interface StateSummary {
  interviews_by_status: Record<string, number>;
  scheduled_by_day: Record<string, number>;
  unscheduled_by_day: Record<string, number>;
  total_students: number;
  total_companies: number;
  total_rooms: number;
  withdrawn_students: number;
}

export interface ReplanSnapshot {
  day: number | null;
  start_slot: number | null;
  clock: string | null;
  room: string | null;
  panel: string | null;
}

export interface ReplanDiffRow {
  interview_id: number;
  student: string;
  roll_no: string;
  company: string;
  before?: ReplanSnapshot;
  after?: ReplanSnapshot;
  reason?: string;
}

export interface ReplanResult {
  disruption: string;
  moved: ReplanDiffRow[];
  cancelled: ReplanDiffRow[];
  backfilled: ReplanDiffRow[];
  notify: { students: string[]; companies: string[] };
  note?: string;
}
