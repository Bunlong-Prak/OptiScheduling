use serde::{Deserialize, Serialize};

pub const DEFAULT_DAYS: [&str; 6] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SolverStrategy {
    /// MRV + Ejection-Chain Constructive + Parallel Simulated Annealing & Ruin-and-Recreate LNS
    Hybrid,
    /// Sub-millisecond MRV + Ejection-Chain Constructive + local polish
    GreedyRepair,
    /// Exact CSP Backtracking with MRV + Forward Checking
    Backtracking,
    /// Multi-start Parallel Simulated Annealing Portfolio
    SimulatedAnnealing,
}

impl Default for SolverStrategy {
    fn default() -> Self {
        Self::Hybrid
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ObjectiveWeights {
    pub unassigned_unit: i64,
    pub same_section_same_day: i64,
    pub online_offline_proximity: i64,
    pub outside_preferred_slot: i64,
    pub part_time_day_scatter: i64,
    pub wrong_specific_classroom: i64,
    pub wrong_classroom_type: i64,
    pub seat_waste_per_seat: i64,
    pub gap_per_minute: i64,
    pub dispersed_combo: i64,
    pub cohort_overlap_per_slot: i64,
    pub major_only_overlap_per_slot: i64,
    pub building_switch: i64,
    pub over_consecutive_hour: i64,
    pub day_load_imbalance: i64,
    pub later_day_tiebreak: i64,
    pub later_slot_tiebreak: i64,
}

impl Default for ObjectiveWeights {
    fn default() -> Self {
        Self {
            unassigned_unit: 1_000_000,
            same_section_same_day: 50_000,
            online_offline_proximity: 800,
            outside_preferred_slot: 600,
            part_time_day_scatter: 120,
            wrong_specific_classroom: 450,
            wrong_classroom_type: 350,
            seat_waste_per_seat: 2,
            gap_per_minute: 15,
            dispersed_combo: 1_200,
            cohort_overlap_per_slot: 500,
            major_only_overlap_per_slot: 40,
            building_switch: 250,
            over_consecutive_hour: 400,
            day_load_imbalance: 25,
            later_day_tiebreak: 8,
            later_slot_tiebreak: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct SolverConfig {
    pub strategy: SolverStrategy,
    pub time_budget_ms: u64,
    pub seed: u64,
    /// 0 means auto-detect min(cores, 4)
    pub threads: usize,
    /// Prioritize part-time / heavily constrained instructors first
    pub prioritize_part_time: bool,
    /// Hard-enforce that split course_hours of the same section land on different days (when <= days.len())
    pub enforce_separate_days: bool,
    /// Hard-enforce minimum transition gap between online & offline classes for same instructor or cohort
    pub enforce_online_offline_gap: bool,
    /// Minimum required gap (minutes) between adjacent online and offline classes
    pub min_online_offline_gap_minutes: u16,
    /// Maximum inter-slot break (minutes) to still classify a combo as adjacent (default: 30m)
    pub max_adjacent_gap_minutes: u16,
    /// Maximum continuous hours for an instructor or single course on a day before penalty
    pub max_consecutive_hours: f64,
    /// Softly avoid overlapping different courses in the same (major, year) cohort
    pub avoid_cohort_overlap: bool,
    /// Penalize back-to-back physical classes for the same instructor across different buildings (`location`)
    pub penalize_building_switches: bool,
    /// Transition threshold in minutes under which building switch penalty applies
    pub max_building_transition_minutes: u16,
    /// Ordered scheduling days
    pub days: Vec<String>,
    /// Multi-objective penalty weights
    pub weights: ObjectiveWeights,
}

impl Default for SolverConfig {
    fn default() -> Self {
        Self {
            strategy: SolverStrategy::Hybrid,
            time_budget_ms: 150,
            seed: 42,
            threads: 0,
            prioritize_part_time: true,
            enforce_separate_days: true,
            enforce_online_offline_gap: false,
            min_online_offline_gap_minutes: 60,
            max_adjacent_gap_minutes: 30,
            max_consecutive_hours: 4.0,
            avoid_cohort_overlap: true,
            penalize_building_switches: true,
            max_building_transition_minutes: 30,
            days: DEFAULT_DAYS.iter().map(|s| (*s).to_string()).collect(),
            weights: ObjectiveWeights::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSlotInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub start_time: String,
    pub end_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClassroomInput {
    pub id: i64,
    pub code: String,
    #[serde(default)]
    pub name: Option<String>,
    pub capacity: i32,
    pub classroom_type_id: i64,
    #[serde(default)]
    pub location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstructorInput {
    pub id: i64,
    #[serde(default)]
    pub first_name: String,
    #[serde(default)]
    pub last_name: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub is_part_time: Option<bool>,
}

impl InstructorInput {
    pub fn display_name(&self) -> String {
        if let Some(n) = &self.name {
            let trimmed = n.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
        let full = format!("{} {}", self.first_name.trim(), self.last_name.trim())
            .trim()
            .to_string();
        if full.is_empty() {
            format!("Instructor #{}", self.id)
        } else {
            full
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeConstraintInput {
    pub instructor_id: i64,
    pub day: String,
    #[serde(default)]
    pub time_slots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockedAssignmentInput {
    pub day: String,
    pub start_time: String,
    pub end_time: String,
    #[serde(default)]
    pub classroom_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnitInput {
    #[serde(default)]
    pub course_hours_id: Option<i64>,
    pub duration: f64,
    #[serde(default)]
    pub prefer_classroom_type_id: Option<i64>,
    #[serde(default)]
    pub prefer_classroom_id: Option<i64>,
    #[serde(default)]
    pub locked: Option<LockedAssignmentInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionInput {
    pub id: i64,
    pub number: String,
    #[serde(default)]
    pub instructor_id: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub is_online: Option<bool>,
    #[serde(default)]
    pub year: Option<u16>,
    #[serde(default)]
    pub units: Vec<UnitInput>,
}

impl SectionInput {
    pub fn is_online_section(&self) -> bool {
        if let Some(online) = self.is_online {
            return online;
        }
        self.status
            .as_deref()
            .map(|s| s.trim().eq_ignore_ascii_case("online"))
            .unwrap_or(false)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CourseInput {
    pub id: i64,
    pub title: String,
    pub code: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub capacity: i32,
    pub duration: f64,
    #[serde(default)]
    pub major_id: Option<i64>,
    #[serde(default)]
    pub major_name: Option<String>,
    #[serde(default)]
    pub year: Option<u16>,
    #[serde(default)]
    pub sections: Vec<SectionInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleRequest {
    #[serde(default)]
    pub schedule_id: Option<i64>,
    pub time_slots: Vec<TimeSlotInput>,
    pub classrooms: Vec<ClassroomInput>,
    pub instructors: Vec<InstructorInput>,
    #[serde(default)]
    pub time_constraints: Vec<TimeConstraintInput>,
    #[serde(default)]
    pub preferred_slots: Vec<TimeConstraintInput>,
    pub courses: Vec<CourseInput>,
    #[serde(default)]
    pub config: SolverConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignmentOutput {
    pub unit_index: usize,
    pub course_id: i64,
    pub section_id: i64,
    pub section_number: String,
    pub course_hours_id: Option<i64>,
    pub course_code: String,
    pub course_title: String,
    pub course_color: Option<String>,
    pub instructor_id: i64,
    pub instructor_name: String,
    pub is_online: bool,
    pub day: String,
    pub start_time: String,
    pub end_time: String,
    pub slot_indices: Vec<usize>,
    pub duration_hours: f64,
    pub classroom_id: i64,
    pub classroom_code: String,
    pub classroom_location: Option<String>,
    pub is_continuous: bool,
    pub satisfied_classroom_preference: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FailedUnitOutput {
    pub unit_index: usize,
    pub section_id: i64,
    pub section_number: String,
    pub course_id: i64,
    pub course_code: String,
    pub course_hours_id: Option<i64>,
    pub duration_hours: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum SchedulingErrorType {
    #[serde(rename = "CAPACITY_CONSTRAINT")]
    CapacityConstraint,
    #[serde(rename = "TIME_CONSTRAINT")]
    TimeConstraint,
    #[serde(rename = "INSTRUCTOR_CONFLICT")]
    InstructorConflict,
    #[serde(rename = "NO_AVAILABLE_SLOTS")]
    NoAvailableSlots,
    #[serde(rename = "NO_CLASSROOM")]
    NoClassroom,
    #[serde(rename = "DURATION_MISMATCH")]
    DurationMismatch,
    #[serde(rename = "UNKNOWN_ERROR")]
    UnknownError,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SchedulingErrorDetails {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_capacity: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_capacity: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicting_course: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicting_instructor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required_duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available_duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempted_day: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempted_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attempted_classroom: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_suitable_classrooms: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulingError {
    pub section_id: i64,
    pub section_number: String,
    pub course_code: String,
    pub course_title: String,
    pub instructor_name: String,
    pub error_type: SchedulingErrorType,
    pub error_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<SchedulingErrorDetails>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ScheduleStats {
    pub total_courses: usize,
    pub total_sections: usize,
    pub total_units: usize,
    pub scheduled_assignments: usize,
    pub constraints_applied: usize,
    pub failed_assignments: usize,
    pub part_time_units_scheduled: usize,
    pub part_time_units_total: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ObjectiveBreakdown {
    pub unassigned_count: usize,
    pub same_section_same_day_violations: usize,
    pub online_offline_proximity_violations: usize,
    pub outside_preferred_slot_violations: usize,
    pub classroom_type_mismatches: usize,
    pub specific_classroom_mismatches: usize,
    pub gapped_assignments: usize,
    pub cohort_overlap_slots: usize,
    pub building_switches: usize,
    pub over_consecutive_violations: usize,
    pub total_seat_waste: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverMetrics {
    pub solve_time_ms: f64,
    pub strategy: SolverStrategy,
    pub objective_score: i64,
    pub hard_violations: usize,
    pub threads_used: usize,
    pub annealing_iterations: u64,
    pub ejection_repairs: usize,
    pub breakdown: ObjectiveBreakdown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleResponse {
    pub success: bool,
    pub message: String,
    pub assignments: Vec<AssignmentOutput>,
    pub failed_units: Vec<FailedUnitOutput>,
    pub errors: Vec<SchedulingError>,
    pub warnings: Vec<String>,
    pub stats: ScheduleStats,
    pub metrics: SolverMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExistingAssignmentInput {
    #[serde(default)]
    pub course_hours_id: Option<i64>,
    pub section_id: i64,
    pub course_id: i64,
    pub course_code: String,
    #[serde(default)]
    pub course_title: String,
    #[serde(default)]
    pub section_number: String,
    #[serde(default)]
    pub capacity: i32,
    #[serde(default)]
    pub major_id: Option<i64>,
    #[serde(default)]
    pub major_name: Option<String>,
    #[serde(default)]
    pub year: Option<u16>,
    #[serde(default)]
    pub instructor_id: Option<i64>,
    #[serde(default)]
    pub instructor_name: Option<String>,
    #[serde(default)]
    pub is_online: bool,
    pub day: String,
    pub start_time: String,
    pub end_time: String,
    #[serde(default)]
    pub classroom_id: Option<i64>,
    #[serde(default)]
    pub classroom_code: Option<String>,
    #[serde(default)]
    pub classroom_location: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictCheckRequest {
    pub candidate: ExistingAssignmentInput,
    #[serde(default)]
    pub existing_assignments: Vec<ExistingAssignmentInput>,
    #[serde(default)]
    pub classrooms: Vec<ClassroomInput>,
    #[serde(default)]
    pub time_constraints: Vec<TimeConstraintInput>,
    #[serde(default)]
    pub config: SolverConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictItem {
    pub severity: String, // "error" | "warning"
    pub kind: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicting_course_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conflicting_section_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictCheckResult {
    pub is_valid: bool,
    pub hard_conflicts: Vec<ConflictItem>,
    pub soft_warnings: Vec<ConflictItem>,
    pub check_time_us: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateScheduleRequest {
    pub assignments: Vec<ExistingAssignmentInput>,
    #[serde(default)]
    pub classrooms: Vec<ClassroomInput>,
    #[serde(default)]
    pub time_constraints: Vec<TimeConstraintInput>,
    #[serde(default)]
    pub time_slots: Vec<TimeSlotInput>,
    #[serde(default)]
    pub config: SolverConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationReport {
    pub is_valid: bool,
    pub hard_conflicts: Vec<ConflictItem>,
    pub soft_warnings: Vec<ConflictItem>,
    pub breakdown: ObjectiveBreakdown,
    pub check_time_ms: f64,
}
