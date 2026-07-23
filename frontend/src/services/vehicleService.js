import { supabase } from '../lib/supabaseClient'

export async function getVehicles() {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data || []
}

export async function getVehicleById(vehicleId) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data || null
}

export async function createVehicle(vehicle, userId) {
  if (!userId) {
    throw new Error('createVehicle requires an authenticated userId.')
  }

  const vin = vehicle.vin ? vehicle.vin.trim() : ''

  const payload = {
    user_id: userId,
    year: Number(vehicle.year),
    make: vehicle.make.trim(),
    model: vehicle.model.trim(),
    mileage: Number(vehicle.mileage),
    vin: vin === '' ? null : vin,
    status: 'Active Garage Vehicle',
  }

  const { data, error } = await supabase.from('vehicles').insert(payload).select().single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteVehicle(vehicleId) {
  const { error } = await supabase.from('vehicles').delete().eq('id', vehicleId)

  if (error) {
    throw new Error(error.message)
  }
}
