import { supabase } from '../lib/supabaseClient'

function trimmedOrEmpty(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRecordFields(record) {
  const serviceDate = trimmedOrEmpty(record.service_date)
  if (!serviceDate) {
    throw new Error('A service date is required.')
  }

  const mileage = Number(record.mileage)
  if (!Number.isFinite(mileage) || mileage < 0) {
    throw new Error('Mileage must be a non-negative number.')
  }

  const description = trimmedOrEmpty(record.description)
  if (!description) {
    throw new Error('A service description is required.')
  }

  const replacedParts = trimmedOrEmpty(record.replaced_parts)
  const notes = trimmedOrEmpty(record.notes)

  return {
    service_date: serviceDate,
    mileage,
    description,
    replaced_parts: replacedParts === '' ? null : replacedParts,
    notes: notes === '' ? null : notes,
  }
}

export async function getMaintenanceRecords(vehicleId) {
  if (typeof vehicleId !== 'string' || !vehicleId.trim()) {
    throw new Error('A vehicle ID is required.')
  }

  const { data, error } = await supabase
    .from('maintenance_records')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function createMaintenanceRecord(vehicleId, userId, record) {
  if (typeof vehicleId !== 'string' || !vehicleId.trim()) {
    throw new Error('A vehicle ID is required.')
  }
  if (!userId) {
    throw new Error('createMaintenanceRecord requires an authenticated userId.')
  }

  const fields = normalizeRecordFields(record)

  const payload = {
    user_id: userId,
    vehicle_id: vehicleId,
    ...fields,
  }

  const { data, error } = await supabase.from('maintenance_records').insert(payload).select().single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function updateMaintenanceRecord(recordId, vehicleId, record) {
  if (typeof recordId !== 'string' || !recordId.trim()) {
    throw new Error('A record ID is required.')
  }
  if (typeof vehicleId !== 'string' || !vehicleId.trim()) {
    throw new Error('A vehicle ID is required.')
  }

  const fields = normalizeRecordFields(record)

  const { data, error } = await supabase
    .from('maintenance_records')
    .update(fields)
    .eq('id', recordId)
    .eq('vehicle_id', vehicleId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteMaintenanceRecord(recordId, vehicleId) {
  if (typeof recordId !== 'string' || !recordId.trim()) {
    throw new Error('A record ID is required.')
  }
  if (typeof vehicleId !== 'string' || !vehicleId.trim()) {
    throw new Error('A vehicle ID is required.')
  }

  const { data, error } = await supabase
    .from('maintenance_records')
    .delete()
    .eq('id', recordId)
    .eq('vehicle_id', vehicleId)
    .select('id')

  if (error) {
    throw new Error(error.message)
  }

  if (!data || data.length === 0) {
    throw new Error('Maintenance record was not found or you do not have permission to delete it.')
  }

  return data[0]
}
