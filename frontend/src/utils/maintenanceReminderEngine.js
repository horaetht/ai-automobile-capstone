// Pure, deterministic mileage-based maintenance reminder engine.
// No Supabase calls, no React state — accepts plain vehicle + maintenance record data.

export const REMINDER_STATUS = {
  OVERDUE: 'overdue',
  DUE_SOON: 'due-soon',
  UP_TO_DATE: 'up-to-date',
  NO_HISTORY: 'no-history',
}

const STATUS_PRIORITY = {
  [REMINDER_STATUS.OVERDUE]: 0,
  [REMINDER_STATUS.DUE_SOON]: 1,
  [REMINDER_STATUS.NO_HISTORY]: 2,
  [REMINDER_STATUS.UP_TO_DATE]: 3,
}

const STATUS_LABELS = {
  [REMINDER_STATUS.OVERDUE]: 'Overdue',
  [REMINDER_STATUS.DUE_SOON]: 'Due Soon',
  [REMINDER_STATUS.UP_TO_DATE]: 'Up To Date',
  [REMINDER_STATUS.NO_HISTORY]: 'No History',
}

export const MAINTENANCE_DISCLAIMER =
  "Maintenance intervals are general estimates, not manufacturer-specific service recommendations. Follow your vehicle manufacturer's recommended service schedule."

// Conservative, explicit phrase matching, evaluated against `description`
// only. `description` is the field the maintenance form treats as the
// authoritative statement of what service was performed (see the form's own
// placeholder: "e.g., Oil Change, Tire Rotation"). `replaced_parts` and
// `notes` are deliberately excluded: they are supplementary free text that
// can reference unrelated context (e.g. a note mentioning an upcoming oil
// change on a record that is actually a brake job), which would otherwise
// misclassify an unrelated repair as a completed service event.
//
// A standalone oil-filter replacement is NOT treated as proof that an oil
// change occurred — filters are sometimes replaced independently of an oil
// change — so no oil-filter-only pattern exists here. "oil filter" only
// counts when the description also explicitly names an oil change. The
// negative lookahead on the "changed ... oil" pattern excludes "changed oil
// filter" / "changed engine oil filter", which would otherwise match because
// the un-guarded pattern is satisfied as soon as "oil" is reached, before the
// following "filter" is read.
const OIL_CHANGE_PATTERNS = [
  /\boil change\b/,
  /\bchanged (the )?(engine )?oil\b(?! filter)/,
  /\boil (and|&) filter change\b/,
]

const TIRE_ROTATION_PATTERNS = [/\btire rotation\b/, /\brotate(d)? (the )?tires\b/]

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : ''
}

function matchableText(record) {
  return normalizeText(record?.description)
}

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

export function isOilChangeRecord(record) {
  return matchesAnyPattern(matchableText(record), OIL_CHANGE_PATTERNS)
}

export function isTireRotationRecord(record) {
  return matchesAnyPattern(matchableText(record), TIRE_ROTATION_PATTERNS)
}

// Returns a finite, non-negative number, or null if the value is missing/invalid.
function toValidNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num) || num < 0) return null
  return num
}

function findLatestServiceRecord(records, matcher) {
  const candidates = (Array.isArray(records) ? records : [])
    .filter((record) => matcher(record))
    .map((record) => ({ record, mileage: toValidNonNegativeNumber(record.mileage) }))
    .filter(({ mileage }) => mileage !== null)

  if (candidates.length === 0) return null

  return candidates.reduce((best, current) => {
    if (!best) return current
    if (current.mileage > best.mileage) return current
    if (current.mileage < best.mileage) return best
    const bestDate = best.record.service_date || ''
    const currentDate = current.record.service_date || ''
    return currentDate > bestDate ? current : best
  }, null).record
}

function formatMiles(value) {
  return Number(value).toLocaleString()
}

const MAINTENANCE_RULE_DEFINITIONS = [
  {
    key: 'oil_change',
    label: 'Oil Change',
    intervalMiles: 5000,
    dueSoonThresholdMiles: 1000,
    matcher: isOilChangeRecord,
  },
  {
    key: 'tire_rotation',
    label: 'Tire Rotation',
    intervalMiles: 5000,
    dueSoonThresholdMiles: 1000,
    matcher: isTireRotationRecord,
  },
]

function buildBaseReminder(rule, currentMileage) {
  return {
    key: rule.key,
    label: rule.label,
    status: REMINDER_STATUS.NO_HISTORY,
    intervalMiles: rule.intervalMiles,
    currentMileage,
    lastServiceMileage: null,
    lastServiceDate: null,
    nextDueMileage: null,
    milesRemaining: null,
    message: '',
    detailLines: [],
  }
}

function calculateMaintenanceReminder(rule, vehicle, maintenanceRecords) {
  const currentMileage = toValidNonNegativeNumber(vehicle?.mileage)

  if (currentMileage === null) {
    return {
      ...buildBaseReminder(rule, null),
      message: `A valid current mileage is needed to calculate the ${rule.label.toLowerCase()} reminder. Update the vehicle's mileage to see this status.`,
    }
  }

  const latestRecord = findLatestServiceRecord(maintenanceRecords, rule.matcher)

  if (!latestRecord) {
    return {
      ...buildBaseReminder(rule, currentMileage),
      message: `No ${rule.label.toLowerCase()} history is recorded. Check your service history or manufacturer schedule.`,
    }
  }

  const lastServiceMileage = toValidNonNegativeNumber(latestRecord.mileage)
  const lastServiceDate = latestRecord.service_date || null

  if (lastServiceMileage > currentMileage) {
    return {
      ...buildBaseReminder(rule, currentMileage),
      lastServiceMileage,
      lastServiceDate,
      message: `Recorded ${rule.label.toLowerCase()} mileage (${formatMiles(lastServiceMileage)} mi) is higher than the vehicle's current mileage (${formatMiles(currentMileage)} mi). Please review your maintenance and mileage data.`,
    }
  }

  const nextDueMileage = lastServiceMileage + rule.intervalMiles
  const milesRemaining = nextDueMileage - currentMileage

  let status
  if (milesRemaining <= 0) {
    status = REMINDER_STATUS.OVERDUE
  } else if (milesRemaining < rule.dueSoonThresholdMiles) {
    status = REMINDER_STATUS.DUE_SOON
  } else {
    status = REMINDER_STATUS.UP_TO_DATE
  }

  const dueLine = `Estimated due at ${formatMiles(nextDueMileage)} mi`
  const lastServiceLine = `Last recorded service: ${formatMiles(lastServiceMileage)} mi`

  let detailLines
  let message
  if (status === REMINDER_STATUS.OVERDUE) {
    const overdueBy = formatMiles(Math.abs(milesRemaining))
    detailLines = [dueLine, `${overdueBy} miles overdue`, lastServiceLine]
    message = `${rule.label} is overdue by ${overdueBy} miles (estimated due at ${formatMiles(nextDueMileage)} mi). Last recorded service: ${formatMiles(lastServiceMileage)} mi.`
  } else if (status === REMINDER_STATUS.DUE_SOON) {
    detailLines = [dueLine, `${formatMiles(milesRemaining)} miles remaining`]
    message = `${rule.label} is due soon: ${formatMiles(milesRemaining)} miles remaining (estimated due at ${formatMiles(nextDueMileage)} mi).`
  } else {
    detailLines = [dueLine, `${formatMiles(milesRemaining)} miles remaining`]
    message = `${rule.label} is up to date: ${formatMiles(milesRemaining)} miles remaining (estimated due at ${formatMiles(nextDueMileage)} mi).`
  }

  return {
    key: rule.key,
    label: rule.label,
    status,
    intervalMiles: rule.intervalMiles,
    currentMileage,
    lastServiceMileage,
    lastServiceDate,
    nextDueMileage,
    milesRemaining,
    message,
    detailLines,
  }
}

// Accepts a plain vehicle object and an array of maintenance records for that
// vehicle; returns one normalized reminder per supported maintenance rule.
export function getMaintenanceReminders(vehicle, maintenanceRecords) {
  return MAINTENANCE_RULE_DEFINITIONS.map((rule) => calculateMaintenanceReminder(rule, vehicle, maintenanceRecords))
}

export function getReminderStatusLabel(status) {
  return STATUS_LABELS[status] || status
}

// overdue > due-soon > no-history > up-to-date. Within overdue, the most
// overdue reminder sorts first; within due-soon, the fewest miles remaining
// sorts first (both are ascending sorts on milesRemaining).
export function sortRemindersByPriority(reminders) {
  return [...reminders].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
    if (priorityDiff !== 0) return priorityDiff

    if (a.status === REMINDER_STATUS.OVERDUE || a.status === REMINDER_STATUS.DUE_SOON) {
      return (a.milesRemaining ?? 0) - (b.milesRemaining ?? 0)
    }

    return 0
  })
}
