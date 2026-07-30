const BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles'
const REQUEST_TIMEOUT_MS = 10000
const MIN_MODEL_YEAR = 1996
const ROAD_VEHICLE_TYPES = ['car', 'truck', 'multipurpose passenger vehicle']

// In-memory only, cleared on page reload. Avoids re-fetching the same
// reference data multiple times during a single session.
let allMakesCache = null
const modelsCache = new Map()
const makesByVehicleTypeCache = new Map()
let commonRoadVehicleMakesCache = null
const modelsByMakeIdCache = new Map()

// Shared request helper: builds the URL, enforces a timeout, and turns
// every failure mode into a plain Error with a safe, generic message.
async function fetchNhtsa(endpoint) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    response = await fetch(`${BASE_URL}${endpoint}?format=json`, {
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The NHTSA vehicle service took too long to respond.', { cause: err })
    }
    throw new Error('Unable to reach the NHTSA vehicle service.', { cause: err })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error('The NHTSA vehicle service returned an unexpected response.')
  }

  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error('The NHTSA vehicle service returned an unexpected response.')
  }

  if (!payload || !Array.isArray(payload.Results)) {
    throw new Error('The NHTSA vehicle service returned an unexpected response.')
  }

  return payload.Results
}

// Normalizes a raw NHTSA row into { id, name }, dropping anything missing
// an id/name. Used for both makes and models since the shape matches.
function normalizeNamedResult(result, idKey, nameKey) {
  const id = result ? result[idKey] : null
  const rawName = result ? result[nameKey] : null
  const name = typeof rawName === 'string' ? rawName.trim() : ''

  if (!id || !name) {
    return null
  }

  return { id, name }
}

function dedupeAndSortByName(items) {
  const seen = new Set()
  const unique = []

  for (const item of items) {
    const key = item.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }

  unique.sort((a, b) => a.name.localeCompare(b.name))
  return unique
}

function dedupeById(items) {
  const seen = new Set()
  const unique = []

  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    unique.push(item)
  }

  return unique
}

export async function getAllMakes() {
  if (allMakesCache) {
    return allMakesCache
  }

  const results = await fetchNhtsa('/GetAllMakes')

  const makes = results
    .map((result) => normalizeNamedResult(result, 'Make_ID', 'Make_Name'))
    .filter((make) => make !== null)

  allMakesCache = dedupeAndSortByName(makes)
  return allMakesCache
}

// GetMakesForVehicleType returns MakeId/MakeName (no underscore) — a
// different shape than GetAllMakes' Make_ID/Make_Name.
export async function getMakesForVehicleType(vehicleType) {
  if (typeof vehicleType !== 'string' || !vehicleType.trim()) {
    throw new Error('A vehicle type is required.')
  }
  const trimmedType = vehicleType.trim()
  const cacheKey = trimmedType.toLowerCase()

  if (makesByVehicleTypeCache.has(cacheKey)) {
    return makesByVehicleTypeCache.get(cacheKey)
  }

  const endpoint = `/GetMakesForVehicleType/${encodeURIComponent(trimmedType)}`
  const results = await fetchNhtsa(endpoint)

  const makes = results
    .map((result) => normalizeNamedResult(result, 'MakeId', 'MakeName'))
    .filter((make) => make !== null)

  const normalizedMakes = dedupeAndSortByName(dedupeById(makes))

  makesByVehicleTypeCache.set(cacheKey, normalizedMakes)
  return normalizedMakes
}

// Combines car/truck/MPV makes so the Garage UI's manufacturer search
// excludes trailers, motorcycles, equipment, and other non-road-vehicle
// manufacturers that GetAllMakes includes.
export async function getCommonRoadVehicleMakes() {
  if (commonRoadVehicleMakesCache) {
    return commonRoadVehicleMakesCache
  }

  const results = await Promise.all(ROAD_VEHICLE_TYPES.map((type) => getMakesForVehicleType(type)))
  const combined = results.flat()

  commonRoadVehicleMakesCache = dedupeAndSortByName(dedupeById(combined))
  return commonRoadVehicleMakesCache
}

// Looking up models by numeric Make ID (rather than make name) avoids
// name-matching misses against NHTSA's registered make spelling.
export async function getModelsForMakeIdYear(makeId, year) {
  const normalizedMakeId = Number(makeId)
  if (!Number.isInteger(normalizedMakeId) || normalizedMakeId <= 0) {
    throw new Error('A valid manufacturer is required.')
  }

  const normalizedYear = Number(year)
  const currentYear = new Date().getFullYear()
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('A valid model year is required.')
  }
  if (normalizedYear < MIN_MODEL_YEAR) {
    throw new Error(`Model year must be ${MIN_MODEL_YEAR} or later.`)
  }
  if (normalizedYear > currentYear + 1) {
    throw new Error(`Model year cannot be later than ${currentYear + 1}.`)
  }

  const cacheKey = `${normalizedMakeId}:${normalizedYear}`
  if (modelsByMakeIdCache.has(cacheKey)) {
    return modelsByMakeIdCache.get(cacheKey)
  }

  const endpoint = `/GetModelsForMakeIdYear/makeId/${normalizedMakeId}/modelyear/${normalizedYear}`
  const results = await fetchNhtsa(endpoint)

  const models = results
    .map((result) => normalizeNamedResult(result, 'Model_ID', 'Model_Name'))
    .filter((model) => model !== null)

  const normalizedModels = dedupeAndSortByName(models)

  modelsByMakeIdCache.set(cacheKey, normalizedModels)
  return normalizedModels
}

export async function getModelsForMakeYear(make, year) {
  if (typeof make !== 'string' || !make.trim()) {
    throw new Error('A vehicle make is required.')
  }
  const normalizedMake = make.trim()

  const normalizedYear = Number(year)
  const currentYear = new Date().getFullYear()
  if (!Number.isInteger(normalizedYear)) {
    throw new Error('A valid model year is required.')
  }
  if (normalizedYear < MIN_MODEL_YEAR) {
    throw new Error(`Model year must be ${MIN_MODEL_YEAR} or later.`)
  }
  if (normalizedYear > currentYear + 1) {
    throw new Error(`Model year cannot be later than ${currentYear + 1}.`)
  }

  const cacheKey = `${normalizedMake.toLowerCase()}:${normalizedYear}`
  if (modelsCache.has(cacheKey)) {
    return modelsCache.get(cacheKey)
  }

  const endpoint = `/GetModelsForMakeYear/make/${encodeURIComponent(normalizedMake)}/modelyear/${normalizedYear}`
  const results = await fetchNhtsa(endpoint)

  const models = results
    .map((result) => normalizeNamedResult(result, 'Model_ID', 'Model_Name'))
    .filter((model) => model !== null)

  const normalizedModels = dedupeAndSortByName(models)

  modelsCache.set(cacheKey, normalizedModels)
  return normalizedModels
}
