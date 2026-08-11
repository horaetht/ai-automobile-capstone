import { supabase } from '../lib/supabaseClient'

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 30
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/

function trimmedOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeUsername(value) {
  return trimmedOrEmpty(value).toLowerCase()
}

export function isValidUsername(value) {
  return USERNAME_PATTERN.test(value)
}

// A profile only counts as complete once the user has supplied every field
// onboarding asks for; used by ProtectedRoute to decide whether to route to
// /profile/setup.
export function isProfileComplete(profile) {
  return Boolean(profile && profile.username && profile.first_name && profile.last_name)
}

function normalizeProfileFields(profile) {
  const firstName = trimmedOrEmpty(profile.first_name)
  if (!firstName) {
    throw new Error('First name is required.')
  }

  const lastName = trimmedOrEmpty(profile.last_name)
  if (!lastName) {
    throw new Error('Last name is required.')
  }

  const username = normalizeUsername(profile.username)
  if (!username) {
    throw new Error('Username is required.')
  }
  if (!isValidUsername(username)) {
    throw new Error(
      `Usernames must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters and contain only lowercase letters, numbers, and underscores.`,
    )
  }

  return {
    username,
    first_name: firstName,
    last_name: lastName,
  }
}

export async function getProfile(userId) {
  if (!userId) {
    throw new Error('getProfile requires a userId.')
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data || null
}

export async function upsertProfile(userId, profile) {
  if (!userId) {
    throw new Error('upsertProfile requires an authenticated userId.')
  }

  const fields = normalizeProfileFields(profile)

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...fields })
    .select()
    .single()

  if (error) {
    // Postgres unique_violation -- almost certainly the username, since it's
    // the only unique constraint on this table.
    if (error.code === '23505') {
      throw new Error('That username is already taken.')
    }
    throw new Error(error.message)
  }

  return data
}

// Lets the signup form (and onboarding) check availability before
// submitting, via a database function that only returns a boolean -- no
// profile row data is exposed by this call.
export async function isUsernameAvailable(username) {
  const normalized = normalizeUsername(username)
  if (!isValidUsername(normalized)) {
    return false
  }

  const { data, error } = await supabase.rpc('is_username_available', { check_username: normalized })

  if (error) {
    throw new Error(error.message)
  }

  return Boolean(data)
}
