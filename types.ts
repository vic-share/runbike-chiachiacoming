
export type ItemType = 'training' | 'race' | 'config';

export interface LookupItem {
  id: number | string;
  name: string;
  full_name?: string;
  is_default?: boolean;
  birthday?: string;
  is_hidden?: boolean;
  s_url?: string;
  b_url?: string;
  myword?: string;
  role?: 'admin' | 'parent'; // Deprecated but kept for type safety in old code
  roles?: string[]; // New RBAC roles
}

export interface RaceParticipant {
  id: number | string;
  name: string;
  value: string; // 成績
  s_url: string;
  race_group?: string; // 分組/排名
  photo_url?: string; // 選手自傳參賽照片
  note?: string; // 備註
  people_id?: number | string;
  global_honor_expires_at?: number;
  is_personal_honor?: boolean; // 新增：個人榮譽榜狀態 (獨立欄位)
}

export interface RaceEvent {
  id: number | string;
  name: string;
  date: string;
  location?: string;
  url?: string; // 賽事封面
  series_id?: number | string;
  series_name?: string;
  participants: RaceParticipant[];
}

export interface DataRecord {
  id?: number | string; 
  date: string; 
  item: ItemType;
  name: string; 
  person_name: string; 
  value: string; 
  race_group: string; 
  address: string;
  note: string;
  url: string;
  create_at?: string;
  people_id?: number | string;
  training_type_id?: number | string;
  race_id?: number | string;
  event_id?: number | string;
  series_id?: number | string;
}

export interface ClassSession {
  id: string | number;
  date: string;
  start_time: string;
  end_time: string;
  name: string;
  location: string;
  capacity: number;
  enrolled_count: number;
  price?: number;
  category?: 'ROUTINE' | 'GROUP' | 'SPECIAL';
  ticket_type?: 'REGULAR' | 'RACING' | 'GROUP_PRACTICE' | 'NONE';
  students?: { id: string | number; name: string; s_url?: string; status: string; note?: string; roles?: string[] }[];
  status?: 'OPEN' | 'CONFIRMED' | 'CANCELLED'; // Session Status
  note?: string; // Session Note
}

export interface CourseTemplate {
  id?: string | number;
  name: string;
  day_of_week: number; 
  start_time: string;
  end_time: string;
  location: string;
  price: number;
  max_students: number;
  default_student_ids: (string | number)[];
  ticket_type?: 'REGULAR' | 'RACING' | 'GROUP_PRACTICE';
  category?: 'ROUTINE' | 'GROUP' | 'SPECIAL';
  is_auto_scheduled?: boolean;
}

export interface TicketBatch {
  id: string | number;
  type: 'REGULAR' | 'RACING';
  amount: number;
  expiry_date: string;
}

export interface TicketWallet {
  people_id: string | number;
  person_name: string;
  regular_balance: number; // Total Sum
  racing_balance: number; // Total Sum
  batches: TicketBatch[]; // Detailed Batches
}

export interface TeamInfo {
  id: string | number;
  team_name: string;
  team_en_name: string;
}

export interface Enrollment {
  id: string | number;
  session_id: string | number;
  people_id: string | number;
  session_date: string;
  session_time: string;
  session_name: string;
  location: string;
  status: string;
  note?: string; // Exit reason
}

export interface LegendRecord {
  type_name: string;
  name: string;
  best_score: number;
  avatar_url: string;
  date: string;
  ranking?: string;
}

export interface PushTemplates {
  is_enabled: boolean;
  new_race_title: string;
  new_race_body: string;
  reminder_day_before_title: string;
  reminder_day_before_body: string;
  reminder_day_start_title: string;
  reminder_day_start_body: string;
  reminder_day_end_title: string;
  reminder_day_end_body: string;
  // New Record Fields
  new_record_title?: string;
  new_record_body?: string;
  // Course Fields
  course_open_title?: string;
  course_open_body?: string;
  course_cancelled_title?: string;
  course_cancelled_body?: string;
  course_confirm_needed_title?: string;
  course_confirm_needed_body?: string;
  // Share Config
  share_footer_text?: string;
  share_footer_text_course?: string; // New: Course specific footer
  share_footer_text_race?: string;   // New: Race specific footer
}

export interface PricingTier {
  headcount: number;
  price: number;
}

export interface TicketPricing {
  regular_price: number;
  racing_price: number;
  group_practice_price?: number; // New: Group Practice Single Price
  special_tiers?: PricingTier[]; // Dynamic Pricing Rules
}

export interface FinancialRecord {
  id: number;
  transaction_type: 'DEPOSIT' | 'SPEND' | 'REFUND' | 'ADJUST';
  amount_cash: number;
  amount_ticket: number;
  ticket_type: string;
  note: string;
  created_at: string;
}

export interface FinancialReport {
  total_revenue: number;
  tickets_sold: number;
  tickets_used: number;
}