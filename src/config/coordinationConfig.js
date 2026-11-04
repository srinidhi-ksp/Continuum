/**
 * Coordination and Strain Engine configuration.
 *
 * Configurable weights and thresholds for the Care Coordination Score.
 * Formula: Care Coordination Score = 100 - Strain Index
 */

export const STRAIN_WEIGHTS = {
  missed_tasks: 0.25,        // Missed / overdue tasks: 25%
  care_workload: 0.20,       // Care workload: 20%
  night_interruptions: 0.15, // Night interruptions: 15%
  sleep_disruption: 0.15,    // Sleep disruption: 15%
  task_imbalance: 0.15,      // Task imbalance: 15%
  late_logging: 0.10,        // Late logging: 10%
};

export const COORDINATION_THRESHOLDS = {
  optimal: 80,
  good: 65,
  moderate: 45,
};

export function getCoordinationLevel(score) {
  const s = Number(score) || 0;
  if (s >= COORDINATION_THRESHOLDS.optimal) {
    return {
      label: "Optimal Coordination",
      level: "optimal",
      color: "#16a34a",
      bg: "#dcfce7",
      description: "Care activities, routines, and task sharing are operating smoothly across the care circle.",
    };
  }
  if (s >= COORDINATION_THRESHOLDS.good) {
    return {
      label: "Good Coordination",
      level: "good",
      color: "#5b57d9",
      bg: "#eeedff",
      description: "Care is well coordinated with minor opportunities to streamline tasks and routines.",
    };
  }
  if (s >= COORDINATION_THRESHOLDS.moderate) {
    return {
      label: "Moderate Attention",
      level: "moderate",
      color: "#d97706",
      bg: "#fef3c7",
      description: "Some tasks or care routines need attention. Review recommended actions below.",
    };
  }
  return {
    label: "High Attention Needed",
    level: "elevated",
    color: "#dc2626",
    bg: "#fee2e2",
    description: "Multiple overdue tasks, high caregiver workload, or irregular logs require immediate circle coordination.",
  };
}
