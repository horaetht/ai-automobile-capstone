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

// Lowercase phrasing for the compact "N overdue • N due soon ..." summary,
// as distinct from the uppercase badge text in STATUS_LABELS.
const SUMMARY_STATUS_LABELS = {
  [REMINDER_STATUS.OVERDUE]: 'overdue',
  [REMINDER_STATUS.DUE_SOON]: 'due soon',
  [REMINDER_STATUS.NO_HISTORY]: 'without history',
  [REMINDER_STATUS.UP_TO_DATE]: 'up to date',
}

const SUMMARY_STATUS_ORDER = [
  REMINDER_STATUS.OVERDUE,
  REMINDER_STATUS.DUE_SOON,
  REMINDER_STATUS.NO_HISTORY,
  REMINDER_STATUS.UP_TO_DATE,
]

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

// "Brake" is common in unrelated repairs (parking brake cable, brake light),
// so only explicit inspection/pad-service phrasing counts. We cannot infer
// remaining pad thickness from mileage alone — this only resets the
// inspection-interval timer, which is why the rule is labeled "Brake
// Inspection" rather than implying pad wear is being predicted.
const BRAKE_INSPECTION_PATTERNS = [
  /\bbrake inspection\b/,
  /\binspected (the )?brakes\b/,
  /\bbrake service\b/,
  /\bbrake pads? replacement\b/,
  /\breplaced (the )?brake pads\b/,
  /\b(front|rear) brake pads\b/,
]

// Bare "air filter change/replacement" defaults to the engine air filter,
// since that's the far more common maintenance-log usage; an explicit
// "cabin" mention excludes the record entirely so it can't be conflated
// with the (out-of-scope for Day 9) cabin air filter.
const ENGINE_AIR_FILTER_PATTERNS = [/\bengine air filter\b/, /\bair filter (change|replacement|replaced)\b/]

const TRANSMISSION_FLUID_PATTERNS = [/\btransmission fluid\b/, /\btransmission service\b/, /\batf change\b/]

const COOLANT_SERVICE_PATTERNS = [/\bcoolant (change|flush|service)\b/, /\bchanged (the )?coolant\b/]

function normalizeText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : ''
}

function matchableText(record) {
  return normalizeText(record?.description)
}

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

export function isEngineOilRecord(record) {
  return matchesAnyPattern(matchableText(record), OIL_CHANGE_PATTERNS)
}

export function isTireRotationRecord(record) {
  return matchesAnyPattern(matchableText(record), TIRE_ROTATION_PATTERNS)
}

export function isBrakeInspectionRecord(record) {
  return matchesAnyPattern(matchableText(record), BRAKE_INSPECTION_PATTERNS)
}

export function isEngineAirFilterRecord(record) {
  const text = matchableText(record)
  if (/\bcabin\b/.test(text)) return false
  return matchesAnyPattern(text, ENGINE_AIR_FILTER_PATTERNS)
}

export function isTransmissionFluidRecord(record) {
  return matchesAnyPattern(matchableText(record), TRANSMISSION_FLUID_PATTERNS)
}

export function isCoolantServiceRecord(record) {
  return matchesAnyPattern(matchableText(record), COOLANT_SERVICE_PATTERNS)
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
    key: 'engine_oil',
    label: 'Engine Oil',
    intervalMiles: 5000,
    dueSoonThresholdMiles: 1000,
    matcher: isEngineOilRecord,
  },
  {
    key: 'tire_rotation',
    label: 'Tire Rotation',
    intervalMiles: 5000,
    dueSoonThresholdMiles: 1000,
    matcher: isTireRotationRecord,
  },
  {
    key: 'brake_inspection',
    label: 'Brake Inspection',
    intervalMiles: 10000,
    dueSoonThresholdMiles: 2000,
    matcher: isBrakeInspectionRecord,
  },
  {
    key: 'engine_air_filter',
    label: 'Engine Air Filter',
    intervalMiles: 15000,
    dueSoonThresholdMiles: 3000,
    matcher: isEngineAirFilterRecord,
  },
  {
    key: 'transmission_fluid',
    label: 'Transmission Fluid',
    intervalMiles: 30000,
    dueSoonThresholdMiles: 5000,
    matcher: isTransmissionFluidRecord,
  },
  {
    key: 'coolant_service',
    label: 'Coolant Service',
    intervalMiles: 30000,
    dueSoonThresholdMiles: 5000,
    matcher: isCoolantServiceRecord,
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

// Derives status counts directly from an existing reminders array — no
// separate counting state, and only statuses with at least one reminder are
// included, in the same overdue > due-soon > no-history > up-to-date order
// used for sorting.
export function summarizeReminders(reminders) {
  const counts = (Array.isArray(reminders) ? reminders : []).reduce((acc, reminder) => {
    if (Object.prototype.hasOwnProperty.call(acc, reminder.status)) {
      acc[reminder.status] += 1
    }
    return acc
  }, Object.fromEntries(SUMMARY_STATUS_ORDER.map((status) => [status, 0])))

  return SUMMARY_STATUS_ORDER.map((status) => ({ status, label: SUMMARY_STATUS_LABELS[status], count: counts[status] })).filter(
    (entry) => entry.count > 0,
  )
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
