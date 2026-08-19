// Deterministic safety-guard logic for the AI symptom diagnostic assistant
// (Online Garage, Day 15 / Issue #37). Pure and side-effect-free by design:
// no Deno.serve, no network calls, no Deno.env access, no Supabase/OpenAI
// imports -- this module only ever transforms strings/objects it's handed,
// so it's safe to import from a unit test without triggering server
// startup (unlike index.ts, which calls Deno.serve(...) at module scope).
//
// This is a safety override layer, not the diagnosis engine: it never sees
// or depends on the AI model's own output when deciding whether a hazard
// was reported, and applySafetyOverride() can only ever make a result MORE
// conservative, never contribute a cause or otherwise influence what the
// model already returned.

// Every list below holds full multi-word phrases, never a bare generic word
// ("hot", "temperature", "coolant", "radiator", "brake", "smell") on its
// own -- that's what keeps this from over-triggering on routine maintenance
// language. Phrases within one category are OR'd together; the category
// functions below are what compose categories with AND where that's what
// actually signals a hazard -- see isOverheatingHazard.

// A rising/high engine temperature signal, in any of the ways an owner
// (not a mechanic) is likely to phrase it -- deliberately does not require
// the literal word "overheat"/"overheating", since a report like "the
// engine temperature keeps climbing" describes the same condition without
// ever using that word.
const TEMPERATURE_SIGNAL_PHRASES = [
  'overheating',
  'overheat',
  'temperature rising',
  'temperature climbing',
  'temperature keeps rising',
  'temperature keeps climbing',
  'temp rising',
  'temp climbing',
  'temperature gauge in red',
  'temp gauge in red',
  'running very hot',
]

// A serious cooling-system symptom -- "steam"/"steaming" alone is included
// here (not just "overheating" + "steam") specifically so a temperature
// signal paired with steam is recognized even without the word "overheat".
const COOLING_SYSTEM_HAZARD_PHRASES = [
  'steam',
  'steaming',
  'coolant boiling',
  'coolant spraying',
  'coolant pouring',
  'coolant leaking heavily',
]

// Engine-bay location phrases -- only ever combined with steam/cooling
// phrases below (isEngineBaySteamReport), never a standalone trigger, so
// merely mentioning "radiator" or "under the hood" does nothing on its own.
const ENGINE_BAY_LOCATION_PHRASES = ['under the hood', 'under hood', 'engine bay', 'from the engine', 'near the radiator', 'from the radiator']

const BRAKING_LOSS_PHRASES = [
  'brake pedal goes to the floor',
  'brake pedal to the floor',
  'brakes are not working',
  'brake is not working',
  'brakes not working',
  'brake not working',
  "brakes aren't working",
  'no brakes',
  'lost braking',
  'lost my brakes',
  'brake failure',
  'brakes failed',
  'barely slowing down',
  'not slowing down',
]

const FIRE_SMOKE_PHRASES = [
  'fire under the hood',
  'flames from engine',
  'flames coming from',
  'flames under the hood',
  'engine is on fire',
  'car is on fire',
  'catching fire',
  'smoke from the engine',
  'smoke coming from the engine',
  'smoke from under the hood',
  'smoke coming from under the hood',
  'heavy smoke',
]

const OIL_PRESSURE_PHRASES = ['oil pressure warning', 'oil pressure light', 'low oil pressure', 'no oil pressure', 'zero oil pressure']

const STEERING_LOSS_PHRASES = [
  'cannot steer',
  "can't steer",
  'lost steering',
  'steering locked',
  'steering is locked',
  'steering wheel is locked',
  "steering wont turn",
  "steering won't turn",
  'no steering control',
]

export const SAFETY_OVERRIDE_ACTIONS = [
  'Stop driving as soon as it is safe to do so.',
  'Arrange towing or professional inspection before driving again.',
]

// lowercase + straight apostrophes + collapsed whitespace, so phrase lists
// only need to spell each phrase one way.
export function normalizeHazardText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function containsAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase))
}

// Combines a temperature-rising signal with a serious cooling-system
// symptom -- this is the AND that an earlier version got wrong by baking
// "overheat"/"overheating" directly into the required terms instead of
// treating it as one of several equivalent temperature signals.
export function isOverheatingTemperatureAndCoolingHazard(text) {
  return containsAny(text, TEMPERATURE_SIGNAL_PHRASES) && containsAny(text, COOLING_SYSTEM_HAZARD_PHRASES)
}

// Catches a strong engine-bay steam report even with no temperature
// language at all (e.g. "steam is pouring out from under the hood").
export function isEngineBaySteamReport(text) {
  const hasSteam = text.includes('steam') || text.includes('steaming')
  return hasSteam && containsAny(text, ENGINE_BAY_LOCATION_PHRASES)
}

export function isOverheatingHazard(text) {
  return isOverheatingTemperatureAndCoolingHazard(text) || isEngineBaySteamReport(text)
}

export function isBrakingLossHazard(text) {
  return containsAny(text, BRAKING_LOSS_PHRASES)
}

export function isFireOrSeriousSmokeHazard(text) {
  return containsAny(text, FIRE_SMOKE_PHRASES)
}

export function isOilPressureHazard(text) {
  return containsAny(text, OIL_PRESSURE_PHRASES)
}

export function isSteeringLossHazard(text) {
  return containsAny(text, STEERING_LOSS_PHRASES)
}

// The single entry point callers use -- combines the symptom description,
// warning-light text, and recent-change text (the caller is responsible for
// joining them) so a hazard reported in any one of those three fields is
// still caught. Matching is entirely deterministic -- it never sees or
// depends on the AI model's own response.
export function isCriticalHazard(reportText) {
  const text = normalizeHazardText(reportText)
  if (!text) return false
  return (
    isOverheatingHazard(text) ||
    isBrakingLossHazard(text) ||
    isFireOrSeriousSmokeHazard(text) ||
    isOilPressureHazard(text) ||
    isSteeringLossHazard(text)
  )
}

// This is a safety override, not the diagnosis engine -- it can only ever
// make the result MORE conservative, never contribute a cause or otherwise
// influence what the model already returned.
export function applySafetyOverride(diagnosis, hazardDetected) {
  if (!hazardDetected) return diagnosis

  const actions = [...SAFETY_OVERRIDE_ACTIONS]
  for (const action of diagnosis.recommended_actions) {
    if (!actions.includes(action)) actions.push(action)
  }

  return {
    ...diagnosis,
    urgency: 'stop_driving',
    safe_to_drive: 'no',
    recommended_actions: actions,
  }
}
