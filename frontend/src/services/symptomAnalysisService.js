import { supabase } from '../lib/supabaseClient'

export const SYMPTOM_DESCRIPTION_MIN_LENGTH = 10
export const SYMPTOM_DESCRIPTION_MAX_LENGTH = 2000

const FRIENDLY_FALLBACK_MESSAGE = 'Unable to analyze symptoms right now. Please try again.'

const URGENCY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  stop_driving: 'Stop Driving',
}

const SAFE_TO_DRIVE_LABELS = {
  yes: 'Yes',
  limited: 'Limited',
  no: 'No',
  unknown: 'Unknown',
}

export function getUrgencyLabel(urgency) {
  return URGENCY_LABELS[urgency] || 'Unknown'
}

export function getSafeToDriveLabel(safeToDrive) {
  return SAFE_TO_DRIVE_LABELS[safeToDrive] || 'Unknown'
}

// The FunctionsHttpError thrown by supabase.functions.invoke() carries the
// raw Response as `.context`, not a parsed message -- this reads our own
// { error: { message } } body back out of it, falling back to a generic
// message for network failures or anything that doesn't parse.
async function extractInvokeErrorMessage(error) {
  try {
    const response = error?.context
    if (response && typeof response.json === 'function') {
      const body = await response.json()
      if (typeof body?.error?.message === 'string' && body.error.message) {
        return body.error.message
      }
    }
  } catch {
    // Fall through to the generic message below.
  }
  return FRIENDLY_FALLBACK_MESSAGE
}

// Defensive re-validation of shape/enum values on top of what the Edge
// Function already validated -- this is what renders as UI status text and
// color, so an unrecognized value should fall back safely rather than break
// rendering.
function normalizeDiagnosis(raw) {
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    urgency: URGENCY_LABELS[raw.urgency] ? raw.urgency : 'medium',
    safe_to_drive: SAFE_TO_DRIVE_LABELS[raw.safe_to_drive] ? raw.safe_to_drive : 'unknown',
    possible_causes: Array.isArray(raw.possible_causes) ? raw.possible_causes.slice(0, 3) : [],
    recommended_actions: Array.isArray(raw.recommended_actions) ? raw.recommended_actions : [],
    follow_up_questions: Array.isArray(raw.follow_up_questions) ? raw.follow_up_questions.slice(0, 4) : [],
    vehicle_data_used: Array.isArray(raw.vehicle_data_used) ? raw.vehicle_data_used : [],
    disclaimer: typeof raw.disclaimer === 'string' ? raw.disclaimer : '',
  }
}

// Owns the Edge Function call, request shaping, and response
// validation/normalization so SymptomCheckerPage only ever deals with a
// clean request object in and a normalized diagnosis object (or a friendly
// Error) out -- it never touches supabase.functions.invoke() directly.
export async function analyzeSymptom({ vehicleId, description, when, warningLight, recentChange }) {
  if (!vehicleId) {
    throw new Error('Select a vehicle before analyzing symptoms.')
  }

  const trimmedDescription = typeof description === 'string' ? description.trim() : ''
  if (trimmedDescription.length < SYMPTOM_DESCRIPTION_MIN_LENGTH) {
    throw new Error(`Please describe the symptom in at least ${SYMPTOM_DESCRIPTION_MIN_LENGTH} characters.`)
  }

  const { data, error } = await supabase.functions.invoke('diagnose-symptom', {
    body: {
      vehicleId,
      description: trimmedDescription,
      when: when || undefined,
      warningLight: typeof warningLight === 'string' && warningLight.trim() ? warningLight.trim() : undefined,
      recentChange: typeof recentChange === 'string' && recentChange.trim() ? recentChange.trim() : undefined,
    },
  })

  if (error) {
    throw new Error(await extractInvokeErrorMessage(error))
  }

  if (!data || typeof data !== 'object' || !data.data) {
    throw new Error(FRIENDLY_FALLBACK_MESSAGE)
  }

  return normalizeDiagnosis(data.data)
}
