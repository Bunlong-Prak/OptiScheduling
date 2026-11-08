use smallvec::SmallVec;
use thiserror::Error;

use crate::model::TimeSlotInput;

pub const MAX_SUPPORTED_SLOTS: usize = 128;

#[derive(Debug, Error)]
pub enum TimeError {
    #[error("Invalid time string: '{0}'")]
    InvalidTime(String),
    #[error("Invalid time range (end <= start): '{0}'")]
    InvalidRange(String),
    #[error("Too many time slots ({0}); maximum supported is {MAX_SUPPORTED_SLOTS}")]
    TooManyTimeSlots(usize),
}

#[derive(Debug, Clone)]
pub struct NormalizedTimeSlot {
    pub id: Option<i64>,
    pub index: usize,
    pub start_min: u16,
    pub end_min: u16,
    pub duration_min: u16,
    pub start_str: String,
    pub end_str: String,
    pub canonical: String,
    /// Bitmask of all slot indices whose intervals overlap this slot (including itself)
    pub overlap_mask: u128,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u8)]
pub enum ComboKind {
    Continuous = 0,
    Adjacent = 1,
    Dispersed = 2,
}

#[derive(Debug, Clone)]
pub struct SlotCombo {
    pub mask: u128,
    pub slot_indices: SmallVec<[u16; 6]>,
    pub first_slot: u16,
    pub start_min: u16,
    pub end_min: u16,
    pub total_minutes: u16,
    pub internal_gap_minutes: u16,
    pub kind: ComboKind,
    pub minute_error: u16,
}

pub fn format_minutes(mins: u16) -> String {
    let h = mins / 60;
    let m = mins % 60;
    format!("{h:02}:{m:02}")
}

pub fn parse_hhmm_minutes(raw: &str) -> Result<u16, TimeError> {
    let s = raw.trim();
    if s.is_empty() {
        return Err(TimeError::InvalidTime(raw.to_string()));
    }

    let upper = s.to_ascii_uppercase();
    let (core, is_am, is_pm) = if let Some(stripped) = upper.strip_suffix("AM") {
        (stripped.trim(), true, false)
    } else if let Some(stripped) = upper.strip_suffix("PM") {
        (stripped.trim(), false, true)
    } else {
        (upper.as_str(), false, false)
    };

    let mut parts = core.split(':');
    let h_str = parts
        .next()
        .ok_or_else(|| TimeError::InvalidTime(raw.to_string()))?
        .trim();
    let m_str = parts.next().unwrap_or("0").trim();
    // Ignore optional :SS seconds part if provided (e.g. "08:00:00")
    let _sec = parts.next();

    let mut hour: u16 = h_str
        .parse()
        .map_err(|_| TimeError::InvalidTime(raw.to_string()))?;
    let minute: u16 = m_str
        .parse()
        .map_err(|_| TimeError::InvalidTime(raw.to_string()))?;

    if minute >= 60 {
        return Err(TimeError::InvalidTime(raw.to_string()));
    }

    if is_am {
        if hour == 12 {
            hour = 0;
        } else if hour > 12 {
            return Err(TimeError::InvalidTime(raw.to_string()));
        }
    } else if is_pm {
        if hour == 0 || hour > 12 {
            return Err(TimeError::InvalidTime(raw.to_string()));
        }
        if hour != 12 {
            hour += 12;
        }
    } else if hour > 24 || (hour == 24 && minute > 0) {
        return Err(TimeError::InvalidTime(raw.to_string()));
    }

    Ok(hour * 60 + minute)
}

pub fn parse_time_range(raw: &str) -> Result<(u16, u16), TimeError> {
    let s = raw.trim();
    // Handle both "HH:MM-HH:MM" and "8:00 AM - 9:00 AM"
    let (left, right) = if let Some(pos) = s.find('-') {
        (&s[..pos], &s[pos + 1..])
    } else {
        // Single start time fallback? Treat as invalid range
        return Err(TimeError::InvalidRange(raw.to_string()));
    };

    let start = parse_hhmm_minutes(left)?;
    let end = parse_hhmm_minutes(right)?;
    if end <= start {
        return Err(TimeError::InvalidRange(raw.to_string()));
    }
    Ok((start, end))
}

pub fn normalize_time_slots(
    inputs: &[TimeSlotInput],
) -> Result<Vec<NormalizedTimeSlot>, TimeError> {
    if inputs.len() > MAX_SUPPORTED_SLOTS {
        return Err(TimeError::TooManyTimeSlots(inputs.len()));
    }

    let mut parsed: Vec<(Option<i64>, u16, u16)> = Vec::with_capacity(inputs.len());
    for slot in inputs {
        let start_min = parse_hhmm_minutes(&slot.start_time)?;
        let end_min = parse_hhmm_minutes(&slot.end_time)?;
        if end_min <= start_min {
            return Err(TimeError::InvalidRange(format!(
                "{}-{}",
                slot.start_time, slot.end_time
            )));
        }
        parsed.push((slot.id, start_min, end_min));
    }

    parsed.sort_by_key(|&(_, s, e)| (s, e));

    let mut out: Vec<NormalizedTimeSlot> = parsed
        .into_iter()
        .enumerate()
        .map(|(index, (id, start_min, end_min))| {
            let start_str = format_minutes(start_min);
            let end_str = format_minutes(end_min);
            let canonical = format!("{start_str}-{end_str}");
            NormalizedTimeSlot {
                id,
                index,
                start_min,
                end_min,
                duration_min: end_min - start_min,
                start_str,
                end_str,
                canonical,
                overlap_mask: 1u128 << index,
            }
        })
        .collect();

    for i in 0..out.len() {
        let mut mask = 0u128;
        for j in 0..out.len() {
            if intervals_overlap(out[i].start_min, out[i].end_min, out[j].start_min, out[j].end_min) {
                mask |= 1u128 << j;
            }
        }
        out[i].overlap_mask = mask;
    }

    Ok(out)
}

#[inline]
pub fn intervals_overlap(a_start: u16, a_end: u16, b_start: u16, b_end: u16) -> bool {
    !(a_end <= b_start || a_start >= b_end)
}

/// Convert constraint string(s) into a slot bitmask.
/// Supports exact slot strings ("08:00-09:00", "8:00 AM - 9:00 AM") AND single-time strings ("08:00").
pub fn constraint_strings_to_mask(
    entries: &[String],
    slots: &[NormalizedTimeSlot],
) -> u128 {
    let mut mask = 0u128;
    for entry in entries {
        let trimmed = entry.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok((c_start, c_end)) = parse_time_range(trimmed) {
            for slot in slots {
                if intervals_overlap(slot.start_min, slot.end_min, c_start, c_end) {
                    mask |= slot.overlap_mask;
                }
            }
        } else if let Ok(point) = parse_hhmm_minutes(trimmed) {
            for slot in slots {
                if slot.start_min == point || (slot.start_min <= point && point < slot.end_min) {
                    mask |= slot.overlap_mask;
                }
            }
        }
    }
    mask
}

/// Precompute valid non-overlapping time slot combinations for `target_duration_hours`
/// without any exponential 2^N subset enumeration.
pub fn find_slot_combinations(
    slots: &[NormalizedTimeSlot],
    target_duration_hours: f64,
    max_adjacent_gap_minutes: u16,
) -> Vec<SlotCombo> {
    if slots.is_empty() || target_duration_hours <= 0.0 {
        return Vec::new();
    }

    let target_min = (target_duration_hours * 60.0).round() as i32;
    if target_min <= 0 {
        return Vec::new();
    }

    // Check if any slot already exceeds target_min + tolerance
    let mut results: Vec<SlotCombo> = Vec::new();
    let mut seen_masks: Vec<u128> = Vec::new();

    // Helper tolerance: 2 minutes per slot (e.g., handles 0.83h = 50m, 1.66h = 100m cleanly)
    let tol_for_len = |len: usize| -> i32 { ((len as i32) * 2).max(2) };

    // Strategy 1: Continuous sequences (0 gap between consecutive slots)
    for start in 0..slots.len() {
        let mut mask = 0u128;
        let mut indices: SmallVec<[u16; 6]> = SmallVec::new();
        let mut sum_min: i32 = 0;

        for idx in start..slots.len() {
            if let Some(&prev_idx) = indices.last() {
                let prev = &slots[prev_idx as usize];
                let curr = &slots[idx];
                if curr.start_min < prev.end_min {
                    // Overlapping slot in schedule table, skip
                    continue;
                }
                if curr.start_min != prev.end_min {
                    // Not strictly continuous
                    break;
                }
            }

            let curr = &slots[idx];
            let new_sum = sum_min + curr.duration_min as i32;
            let tol = tol_for_len(indices.len() + 1);
            if new_sum > target_min + tol {
                break;
            }

            sum_min = new_sum;
            indices.push(idx as u16);
            mask |= curr.overlap_mask;

            let err = (sum_min - target_min).abs();
            if err <= tol {
                push_unique_combo(
                    &mut results,
                    &mut seen_masks,
                    slots,
                    indices.clone(),
                    mask,
                    sum_min as u16,
                    0,
                    ComboKind::Continuous,
                    err as u16,
                );
            }
        }
    }

    // Strategy 2: Adjacent sequences (allowing passing breaks <= max_adjacent_gap_minutes)
    if max_adjacent_gap_minutes > 0 {
        for start in 0..slots.len() {
            let s0 = &slots[start];
            let tol1 = tol_for_len(1);
            if (s0.duration_min as i32) > target_min + tol1 {
                continue;
            }
            let mut indices = SmallVec::<[u16; 6]>::new();
            indices.push(start as u16);
            dfs_adjacent(
                slots,
                start,
                s0.duration_min as i32,
                0,
                s0.overlap_mask,
                &mut indices,
                target_min,
                max_adjacent_gap_minutes,
                &mut results,
                &mut seen_masks,
            );
        }
    }

    // Strategy 3: Bounded Dispersed fallback (only if neither continuous nor adjacent succeeded)
    if results.is_empty() {
        let max_len = slots.len().min(5);
        for target_len in 1..=max_len {
            let mut indices = SmallVec::<[u16; 6]>::with_capacity(target_len);
            dfs_dispersed(
                slots,
                0,
                target_len,
                0,
                0,
                0,
                &mut indices,
                target_min,
                &mut results,
                &mut seen_masks,
            );
            if !results.is_empty() {
                break;
            }
        }
    }

    // Sort by quality: Continuous < Adjacent < Dispersed, exact minute match first, minimal gap, fewer slots, earlier start
    results.sort_by_key(|c| {
        (
            c.kind as u8,
            c.minute_error,
            c.internal_gap_minutes,
            c.slot_indices.len(),
            c.first_slot,
        )
    });

    // Keep bounded top combos if dispersed exploded on weird inputs
    if results.len() > 128 {
        results.truncate(128);
    }

    results
}

#[allow(clippy::too_many_arguments)]
fn dfs_adjacent(
    slots: &[NormalizedTimeSlot],
    last_idx: usize,
    sum_min: i32,
    gap_min: u16,
    mask: u128,
    indices: &mut SmallVec<[u16; 6]>,
    target_min: i32,
    max_gap: u16,
    results: &mut Vec<SlotCombo>,
    seen_masks: &mut Vec<u128>,
) {
    let tol = ((indices.len() as i32) * 2).max(2);
    let err = (sum_min - target_min).abs();
    if err <= tol {
        let kind = if gap_min == 0 {
            ComboKind::Continuous
        } else {
            ComboKind::Adjacent
        };
        push_unique_combo(
            results,
            seen_masks,
            slots,
            indices.clone(),
            mask,
            sum_min as u16,
            gap_min,
            kind,
            err as u16,
        );
        if sum_min >= target_min {
            return;
        }
    }

    if indices.len() >= 8 {
        return;
    }

    let prev_end = slots[last_idx].end_min;
    for next_idx in (last_idx + 1)..slots.len() {
        let next = &slots[next_idx];
        if next.start_min < prev_end {
            continue; // overlapping
        }
        let step_gap = next.start_min - prev_end;
        if step_gap > max_gap {
            break; // slots are sorted chronologically, so all subsequent start even later
        }
        let new_sum = sum_min + next.duration_min as i32;
        let next_tol = (((indices.len() + 1) as i32) * 2).max(2);
        if new_sum > target_min + next_tol {
            continue;
        }
        indices.push(next_idx as u16);
        dfs_adjacent(
            slots,
            next_idx,
            new_sum,
            gap_min + step_gap,
            mask | next.overlap_mask,
            indices,
            target_min,
            max_gap,
            results,
            seen_masks,
        );
        indices.pop();
    }
}

#[allow(clippy::too_many_arguments)]
fn dfs_dispersed(
    slots: &[NormalizedTimeSlot],
    start_idx: usize,
    target_len: usize,
    sum_min: i32,
    gap_min: u16,
    mask: u128,
    indices: &mut SmallVec<[u16; 6]>,
    target_min: i32,
    results: &mut Vec<SlotCombo>,
    seen_masks: &mut Vec<u128>,
) {
    if results.len() >= 128 {
        return;
    }
    if indices.len() == target_len {
        let tol = ((target_len as i32) * 2).max(2);
        let err = (sum_min - target_min).abs();
        if err <= tol {
            push_unique_combo(
                results,
                seen_masks,
                slots,
                indices.clone(),
                mask,
                sum_min as u16,
                gap_min,
                ComboKind::Dispersed,
                err as u16,
            );
        }
        return;
    }

    let need = target_len - indices.len();
    if start_idx + need > slots.len() {
        return;
    }

    let tol_final = ((target_len as i32) * 2).max(2);

    for idx in start_idx..=(slots.len() - need) {
        let s = &slots[idx];
        let step_gap = if let Some(&prev_idx) = indices.last() {
            let prev = &slots[prev_idx as usize];
            if s.start_min < prev.end_min {
                continue;
            }
            s.start_min - prev.end_min
        } else {
            0
        };

        let new_sum = sum_min + s.duration_min as i32;
        if new_sum > target_min + tol_final {
            continue;
        }

        indices.push(idx as u16);
        dfs_dispersed(
            slots,
            idx + 1,
            target_len,
            new_sum,
            gap_min + step_gap,
            mask | s.overlap_mask,
            indices,
            target_min,
            results,
            seen_masks,
        );
        indices.pop();
    }
}

#[allow(clippy::too_many_arguments)]
fn push_unique_combo(
    results: &mut Vec<SlotCombo>,
    seen_masks: &mut Vec<u128>,
    slots: &[NormalizedTimeSlot],
    indices: SmallVec<[u16; 6]>,
    mask: u128,
    total_minutes: u16,
    internal_gap_minutes: u16,
    kind: ComboKind,
    minute_error: u16,
) {
    // Compare exact slot-selection mask (without overlap expansion) to deduplicate
    let exact_mask = indices.iter().fold(0u128, |acc, &i| acc | (1u128 << i));
    if seen_masks.contains(&exact_mask) {
        return;
    }
    seen_masks.push(exact_mask);

    let first_slot = indices[0];
    let last_slot = *indices.last().unwrap_or(&first_slot);
    let start_min = slots[first_slot as usize].start_min;
    let end_min = slots[last_slot as usize].end_min;

    results.push(SlotCombo {
        mask,
        slot_indices: indices,
        first_slot,
        start_min,
        end_min,
        total_minutes,
        internal_gap_minutes,
        kind,
        minute_error,
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_12h_and_24h_times() {
        assert_eq!(parse_hhmm_minutes("8:00 AM").unwrap(), 480);
        assert_eq!(parse_hhmm_minutes("12:00 PM").unwrap(), 720);
        assert_eq!(parse_hhmm_minutes("12:30 AM").unwrap(), 30);
        assert_eq!(parse_hhmm_minutes("1:15 PM").unwrap(), 795);
        assert_eq!(parse_hhmm_minutes("08:50").unwrap(), 530);
        assert_eq!(parse_hhmm_minutes("17:00:00").unwrap(), 1020);
        assert_eq!(parse_time_range("8:00 AM - 9:00 AM").unwrap(), (480, 540));
    }

    #[test]
    fn handles_50_min_slots_for_1_66h_course() {
        let raw_slots = vec![
            TimeSlotInput { id: Some(1), start_time: "08:00".into(), end_time: "08:50".into() },
            TimeSlotInput { id: Some(2), start_time: "09:00".into(), end_time: "09:50".into() },
            TimeSlotInput { id: Some(3), start_time: "10:00".into(), end_time: "10:50".into() },
        ];
        let slots = normalize_time_slots(&raw_slots).unwrap();
        let combos = find_slot_combinations(&slots, 1.66, 30);
        assert_eq!(combos.len(), 2);
        assert_eq!(combos[0].kind, ComboKind::Adjacent);
        assert_eq!(combos[0].total_minutes, 100);
        assert_eq!(combos[0].internal_gap_minutes, 10);
    }

    #[test]
    fn prefers_continuous_over_adjacent() {
        let raw_slots = vec![
            TimeSlotInput { id: Some(1), start_time: "08:00".into(), end_time: "09:00".into() },
            TimeSlotInput { id: Some(2), start_time: "09:00".into(), end_time: "10:00".into() },
            TimeSlotInput { id: Some(3), start_time: "10:15".into(), end_time: "11:15".into() },
        ];
        let slots = normalize_time_slots(&raw_slots).unwrap();
        let combos = find_slot_combinations(&slots, 2.0, 30);
        assert!(!combos.is_empty());
        assert_eq!(combos[0].kind, ComboKind::Continuous);
        assert_eq!(combos[0].start_min, 480);
        assert_eq!(combos[0].end_min, 600);
    }
}
