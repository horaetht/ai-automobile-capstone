// Vehicle-aware AI symptom diagnostic assistant (Online Garage, Day 15 / Issue #37).
//
// Never trusts the browser just because it sends a vehicleId: the caller is
// resolved from the Authorization JWT, and the vehicle + maintenance history
// are queried using a Supabase client scoped to that same JWT (anon key,
// not service-role), so the existing RLS ownership policies on `vehicles`
// and `maintenance_records` apply exactly as they do everywhere else in the
// app -- this function has no elevated access of its own.
//
// OPENAI_API_KEY never leaves this server-side function.

import { createClient } from 'npm:@supabase/supabase-js@2'
// SDK-provided CORS headers (supabase-js >= 2.95, frontend is pinned to
// ^2.110.7) so the allow-list stays synced with whatever headers the client
// libraries actually send, instead of a hand-maintained list drifting out of
// date. Access-Control-Allow-Methods isn't part of that export, so it's
// still added explicitly below.
import { corsHeaders as sdkCorsHeaders } from 'npm:@supabase/supabase-js@^2/cors'
import { isCriticalHazard, applySafetyOverride } from './hazardSafety.ts'

const corsHeaders = {
  ...sdkCorsHeaders,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIN_DESCRIPTION_LENGTH = 10
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_CONTEXT_FIELD_LENGTH = 300
const MAINTENANCE_RECORD_LIMIT = 8
const DEFAULT_MODEL = 'gpt-4.1-mini'

const WHEN_OPTIONS = new Set([
  'starting',
  'idling',
  'accelerating',
  'cruising',
  'braking',
  'turning',
  'always',
  'other',
])

const URGENCY_VALUES = new Set(['low', 'medium', 'high', 'stop_driving'])
const SAFE_TO_DRIVE_VALUES = new Set(['yes', 'limited', 'no', 'unknown'])
const LIKELIHOOD_VALUES = new Set(['low', 'medium', 'high'])

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const SYSTEM_PROMPT = `You are a vehicle diagnostic assistant inside Online Garage, an app that helps car owners understand possible causes of symptoms they report. You are not a certified mechanic, and this is never a definitive diagnosis.

Rules you must always follow:
- Reason only from the symptom description and the vehicle data explicitly provided to you below. Never invent diagnostic trouble codes, maintenance history, or telemetry values that were not supplied.
- Do not assert manufacturer-specific "known failure" patterns unless the supplied symptoms and data clearly justify it; if you do reference one, say so explicitly rather than presenting it as certain.
- Clearly distinguish what was observed/reported from what you are inferring.
- If the evidence supplied is insufficient to narrow down a cause, say so explicitly in the summary and ask focused follow-up questions instead of guessing.
- Use only "low", "medium", or "high" for likelihood -- never a numeric confidence percentage.
- Prefer conservative, safety-first guidance. If there is a plausible safety risk, reflect that in urgency and safe_to_drive rather than downplaying it.
- The vehicle telemetry provided, if any, is a stored snapshot from the last manual OBD-II sync, not a live reading -- treat it and describe it accordingly, never as "live" or "current" data.
- Keep the tone calm, clear, and helpful for a non-mechanic vehicle owner.
- Populate vehicle_data_used with the specific data points you actually relied on (e.g. "engine_temperature: 230F", "dtc_codes: P0301"), not a restatement of the whole context.`

const DIAGNOSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    urgency: { type: 'string', enum: ['low', 'medium', 'high', 'stop_driving'] },
    safe_to_drive: { type: 'string', enum: ['yes', 'limited', 'no', 'unknown'] },
    possible_causes: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          cause: { type: 'string' },
          likelihood: { type: 'string', enum: ['low', 'medium', 'high'] },
          reasoning: { type: 'string' },
        },
        required: ['cause', 'likelihood', 'reasoning'],
      },
    },
    recommended_actions: {
      type: 'array',
      maxItems: 6,
      items: { type: 'string' },
    },
    follow_up_questions: {
      type: 'array',
      maxItems: 4,
      items: { type: 'string' },
    },
    vehicle_data_used: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string' },
    },
    disclaimer: { type: 'string' },
  },
  required: [
    'summary',
    'urgency',
    'safe_to_drive',
    'possible_causes',
    'recommended_actions',
    'follow_up_questions',
    'vehicle_data_used',
    'disclaimer',
  ],
}

// dtc_codes (jsonb array) is the current source of truth; dtc_code (legacy
// single column) is only a fallback for vehicles synced before it existed.
// Mirrors the same fallback used by TelemetryCard.jsx on the frontend.
function buildVehicleContext(vehicle) {
  const dtcCodes =
    Array.isArray(vehicle.dtc_codes) && vehicle.dtc_codes.length > 0
      ? vehicle.dtc_codes
      : vehicle.dtc_code
        ? [{ code: vehicle.dtc_code, description: null }]
        : []

  return {
    // VIN is intentionally never included -- no diagnostic benefit from a
    // unique vehicle identifier for this feature.
    year: vehicle.year ?? null,
    make: vehicle.make ?? null,
    model: vehicle.model ?? null,
    mileage: vehicle.mileage ?? null,
    telemetry: {
      rpm: vehicle.rpm ?? null,
      vehicle_speed_mph: vehicle.vehicle_speed_mph ?? null,
      fuel_level_percent: vehicle.fuel_level ?? null,
      battery_voltage: vehicle.battery_voltage ?? null,
      engine_temperature_f: vehicle.engine_temperature ?? null,
      dtc_codes: dtcCodes,
      last_synced_at: vehicle.last_synced_at ?? null,
    },
  }
}

function buildMaintenanceContext(records) {
  return (records || []).map((record) => ({
    service_date: record.service_date,
    mileage: record.mileage,
    description: record.description,
    replaced_parts: record.replaced_parts,
    notes: record.notes,
  }))
}

function buildUserPrompt({ description, when, warningLight, recentChange, vehicleContext, maintenanceContext }) {
  const lines = []
  lines.push('SYMPTOM REPORT (from the vehicle owner, not a mechanic):')
  lines.push(description)
  lines.push('')
  if (when) lines.push(`When it happens: ${when}`)
  if (warningLight) lines.push(`Warning light / dashboard message reported: ${warningLight}`)
  if (recentChange) lines.push(`Recent repair, service, or change reported: ${recentChange}`)
  lines.push('')
  lines.push('VEHICLE (verified from the database -- trust this over anything implied in the symptom text):')
  lines.push(JSON.stringify(vehicleContext, null, 2))
  lines.push('')
  lines.push(
    vehicleContext.telemetry.last_synced_at
      ? `Note: the telemetry above is the last value stored from a manual OBD-II sync, not a live reading right now. Last synced at: ${vehicleContext.telemetry.last_synced_at}.`
      : 'Note: this vehicle has never completed an OBD-II sync -- treat every telemetry field above as unavailable, not as a confirmed reading of zero/normal.',
  )
  lines.push('')
  lines.push(`RECENT MAINTENANCE HISTORY (up to ${MAINTENANCE_RECORD_LIMIT} most recent records, may be empty):`)
  lines.push(
    maintenanceContext.length > 0 ? JSON.stringify(maintenanceContext, null, 2) : '(no maintenance records on file)',
  )
  return lines.join('\n')
}

const PROVIDER_ERROR_MESSAGE = 'The AI diagnostic service returned an unexpected response. Please try again.'

// Parses the raw REST JSON from POST /v1/responses defensively -- this
// calls OpenAI with fetch(), not the OpenAI SDK, so no SDK convenience
// property (e.g. response.output_text, which the SDKs compute client-side
// and is not guaranteed to be present on the raw HTTP body) is assumed to
// exist. Walks the documented output structure explicitly and fails with a
// controlled provider error for every shape that isn't a completed text
// message, rather than assuming output[0].content[0].
function extractOutputText(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new HttpError(502, PROVIDER_ERROR_MESSAGE)
  }

  if (payload.status === 'failed' || payload.status === 'incomplete') {
    throw new HttpError(502, 'The AI diagnostic service could not complete this request. Please try again.')
  }

  if (!Array.isArray(payload.output)) {
    throw new HttpError(502, PROVIDER_ERROR_MESSAGE)
  }

  const message = payload.output.find((item) => item && item.type === 'message')
  if (!message || !Array.isArray(message.content)) {
    throw new HttpError(502, PROVIDER_ERROR_MESSAGE)
  }

  const refusal = message.content.find((part) => part && part.type === 'refusal')
  if (refusal) {
    throw new HttpError(
      502,
      'The AI diagnostic service declined to analyze this request. Please rephrase and try again.',
    )
  }

  const textPart = message.content.find(
    (part) => part && part.type === 'output_text' && typeof part.text === 'string' && part.text.trim(),
  )
  if (!textPart) {
    throw new HttpError(502, PROVIDER_ERROR_MESSAGE)
  }

  return textPart.text
}

async function callOpenAI({ apiKey, model, userPrompt }) {
  let response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        instructions: SYSTEM_PROMPT,
        input: userPrompt,
        // One-shot diagnostic flow with no multi-turn Responses API state
        // requirement -- no need for OpenAI to retain this request/response
        // on their side. Local Online Garage persistence is unaffected.
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: 'vehicle_diagnosis',
            strict: true,
            schema: DIAGNOSIS_JSON_SCHEMA,
          },
        },
      }),
    })
  } catch {
    throw new HttpError(502, 'Could not reach the AI diagnostic service. Please try again.')
  }

  if (!response.ok) {
    // Never forward the raw provider response body to the client or logs --
    // the status code is enough to distinguish "provider unavailable /
    // misconfigured" from other failure modes without risking leaking
    // request/response content into logs.
    console.error(`diagnose-symptom: OpenAI request failed with status ${response.status}`)
    throw new HttpError(502, 'The AI diagnostic service is temporarily unavailable. Please try again.')
  }

  const payload = await response.json()
  return extractOutputText(payload)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

// Defense in depth on top of the Responses API's strict json_schema mode --
// a provider-side change or edge case should fail closed here, not surface
// a malformed object to the frontend.
function validateDiagnosis(raw) {
  const invalid = () => new HttpError(502, 'The AI response could not be validated. Please try again.')

  if (!raw || typeof raw !== 'object') throw invalid()
  if (!isNonEmptyString(raw.summary)) throw invalid()
  if (!URGENCY_VALUES.has(raw.urgency)) throw invalid()
  if (!SAFE_TO_DRIVE_VALUES.has(raw.safe_to_drive)) throw invalid()
  if (!Array.isArray(raw.possible_causes) || raw.possible_causes.length > 3) throw invalid()

  for (const cause of raw.possible_causes) {
    if (
      !cause ||
      !isNonEmptyString(cause.cause) ||
      !LIKELIHOOD_VALUES.has(cause.likelihood) ||
      !isNonEmptyString(cause.reasoning)
    ) {
      throw invalid()
    }
  }

  if (!Array.isArray(raw.recommended_actions) || raw.recommended_actions.some((a) => !isNonEmptyString(a))) {
    throw invalid()
  }
  if (
    !Array.isArray(raw.follow_up_questions) ||
    raw.follow_up_questions.length > 4 ||
    raw.follow_up_questions.some((q) => !isNonEmptyString(q))
  ) {
    throw invalid()
  }
  if (!Array.isArray(raw.vehicle_data_used) || raw.vehicle_data_used.some((v) => !isNonEmptyString(v))) {
    throw invalid()
  }
  if (!isNonEmptyString(raw.disclaimer)) throw invalid()

  return {
    summary: raw.summary.trim(),
    urgency: raw.urgency,
    safe_to_drive: raw.safe_to_drive,
    possible_causes: raw.possible_causes.map((c) => ({
      cause: c.cause.trim(),
      likelihood: c.likelihood,
      reasoning: c.reasoning.trim(),
    })),
    recommended_actions: raw.recommended_actions.map((a) => a.trim()),
    follow_up_questions: raw.follow_up_questions.map((q) => q.trim()),
    vehicle_data_used: raw.vehicle_data_used.map((v) => v.trim()),
    disclaimer: raw.disclaimer.trim(),
  }
}

async function handleRequest(req) {
  if (req.method !== 'POST') {
    throw new HttpError(405, 'Method not allowed.')
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    throw new HttpError(401, 'Not authenticated.')
  }

  // SUPABASE_URL / SUPABASE_ANON_KEY are reserved secrets auto-injected into
  // every Edge Function by Supabase -- no manual configuration needed for
  // these two. Forwarding the caller's own Authorization header (rather
  // than using a service-role key) is what keeps every query below subject
  // to the same RLS ownership policies as the rest of the app.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new HttpError(500, 'Server is not configured correctly.')
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new HttpError(401, 'Not authenticated.')
  }

  let body
  try {
    body = await req.json()
  } catch {
    throw new HttpError(400, 'Invalid request body.')
  }

  const vehicleId = typeof body?.vehicleId === 'string' ? body.vehicleId.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  const whenCandidate = typeof body?.when === 'string' ? body.when.toLowerCase().trim() : ''
  const when = WHEN_OPTIONS.has(whenCandidate) ? whenCandidate : ''
  const warningLight =
    typeof body?.warningLight === 'string' ? body.warningLight.trim().slice(0, MAX_CONTEXT_FIELD_LENGTH) : ''
  const recentChange =
    typeof body?.recentChange === 'string' ? body.recentChange.trim().slice(0, MAX_CONTEXT_FIELD_LENGTH) : ''

  if (!vehicleId) {
    throw new HttpError(400, 'A vehicle must be selected.')
  }
  if (description.length < MIN_DESCRIPTION_LENGTH) {
    throw new HttpError(400, `Please describe the symptom in at least ${MIN_DESCRIPTION_LENGTH} characters.`)
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpError(400, `Symptom description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer.`)
  }

  // Queried under the caller's own JWT -- existing RLS ("select own
  // vehicles") is what actually enforces ownership here; a vehicle that
  // doesn't exist and one owned by someone else are indistinguishable,
  // which is the correct behavior (never reveal whether another user's
  // vehicle exists).
  const { data: vehicle, error: vehicleError } = await supabase
    .from('vehicles')
    .select(
      'id, year, make, model, mileage, rpm, vehicle_speed_mph, fuel_level, battery_voltage, engine_temperature, dtc_code, dtc_codes, last_synced_at',
    )
    .eq('id', vehicleId)
    .maybeSingle()

  if (vehicleError) {
    throw new HttpError(500, 'Unable to load vehicle data.')
  }
  if (!vehicle) {
    throw new HttpError(404, 'Vehicle was not found or you do not have permission to access it.')
  }

  const { data: maintenanceRecords, error: maintenanceError } = await supabase
    .from('maintenance_records')
    .select('service_date, mileage, description, replaced_parts, notes')
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAINTENANCE_RECORD_LIMIT)

  if (maintenanceError) {
    throw new HttpError(500, 'Unable to load maintenance history.')
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new HttpError(500, 'AI diagnostic service is not configured.')
  }
  const model = Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL

  const vehicleContext = buildVehicleContext(vehicle)
  const maintenanceContext = buildMaintenanceContext(maintenanceRecords)
  const userPrompt = buildUserPrompt({ description, when, warningLight, recentChange, vehicleContext, maintenanceContext })

  const hazardDetected = isCriticalHazard([description, warningLight, recentChange].join(' '))

  const rawOutputText = await callOpenAI({ apiKey, model, userPrompt })

  let parsed
  try {
    parsed = JSON.parse(rawOutputText)
  } catch {
    throw new HttpError(502, 'The AI response could not be validated. Please try again.')
  }

  const diagnosis = applySafetyOverride(validateDiagnosis(parsed), hazardDetected)

  return new Response(JSON.stringify({ data: diagnosis }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    return await handleRequest(req)
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500
    const message = err instanceof HttpError ? err.message : 'Something went wrong. Please try again.'

    if (!(err instanceof HttpError)) {
      // Log only that an unexpected error occurred -- never the raw error
      // object, which could carry request/response content (including,
      // transitively, provider output) into logs.
      console.error('diagnose-symptom: unexpected error')
    }

    return new Response(JSON.stringify({ error: { message } }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
