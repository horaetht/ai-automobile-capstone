export const vehicles = [
  {
    id: 'bmw_335i',
    year: 2009,
    make: 'BMW',
    model: '335i',
    mileage: 44859,
    vin: '',
    status: 'Active Garage Vehicle',
    battery_voltage: 13.25,
    fuel_level: 23,
    engine_temperature: 194,
    dtc_code: '',
    last_synced_at: '2026-06-03T16:44:32.890646',
  },
  {
    id: 'toyota_camry_2020',
    year: 2020,
    make: 'Toyota',
    model: 'Camry',
    mileage: 32000,
    vin: '4T1BF1FK5CU123456',
    status: 'Active Garage Vehicle',
    battery_voltage: 12.6,
    fuel_level: 72,
    engine_temperature: 185,
    dtc_code: 'P0420',
    last_synced_at: '',
  },
]

export const maintenanceRecords = {
  bmw_335i: [
    {
      Date: '2025-03-15',
      Mileage: 44500,
      Description: 'Oil Change',
      'Replaced Parts': 'Oil Filter - Synthetic',
      Notes: 'Regular maintenance',
    },
    {
      Date: '2024-11-02',
      Mileage: 43120,
      Description: 'Brake Inspection',
      'Replaced Parts': 'None',
      Notes: 'Pads at 60%, no action needed',
    },
  ],
  toyota_camry_2020: [
    {
      Date: '2025-06-20',
      Mileage: 31500,
      Description: 'Tire Rotation',
      'Replaced Parts': 'None',
      Notes: 'Rotated front to back',
    },
  ],
}

export const symptomRules = [
  {
    symptom: 'clicking sound when starting',
    possible_issue: 'Weak battery or starter issue',
    urgency: 'Medium',
    recommended_next_step: 'Check battery voltage and inspect starter',
  },
  {
    symptom: 'engine light on and car shaking',
    possible_issue: 'Engine misfire',
    urgency: 'High',
    recommended_next_step: 'Avoid long driving and inspect immediately',
  },
  {
    symptom: 'brake squeaking at low speed',
    possible_issue: 'Worn brake pads',
    urgency: 'Medium',
    recommended_next_step: 'Inspect brake pads soon',
  },
  {
    symptom: 'car overheating',
    possible_issue: 'Cooling system issue',
    urgency: 'High',
    recommended_next_step: 'Stop driving and check coolant level',
  },
  {
    symptom: 'car pulls to one side',
    possible_issue: 'Wheel alignment or tire issue',
    urgency: 'Medium',
    recommended_next_step: 'Inspect tires and alignment',
  },
]

export function findVehicleById(vehicleId) {
  return vehicles.find((v) => v.id === vehicleId)
}

export function getMaintenanceRecords(vehicleId) {
  return maintenanceRecords[vehicleId] || []
}

export function addVehicle(vehicle) {
  vehicles.push(vehicle)
  return vehicle
}

export function addMaintenanceRecord(vehicleId, record) {
  if (!maintenanceRecords[vehicleId]) {
    maintenanceRecords[vehicleId] = []
  }
  maintenanceRecords[vehicleId].push(record)
  return record
}

export function createVehicleId(make, model, year) {
  const base = `${make}_${model}_${year}`.toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return `${base}_${Date.now()}`
}

export function checkSymptom(userInput) {
  const lower = userInput.trim().toLowerCase()
  const match = symptomRules.find(
    (rule) => lower.includes(rule.symptom) || rule.symptom.includes(lower),
  )
  return (
    match || {
      possible_issue: 'Unknown issue',
      urgency: 'Unknown',
      recommended_next_step: 'Please consult a mechanic for further inspection.',
    }
  )
}

export function mockSyncVehicle(vehicleId) {
  const vehicle = findVehicleById(vehicleId)
  if (!vehicle) return null

  vehicle.mileage = Math.round(vehicle.mileage + Math.random() * 20)
  vehicle.battery_voltage = Number((12.4 + Math.random() * 1.4).toFixed(2))
  vehicle.fuel_level = Math.max(0, Math.round(vehicle.fuel_level - Math.random() * 5))
  vehicle.engine_temperature = Math.round(180 + Math.random() * 20)
  vehicle.last_synced_at = new Date().toISOString()

  return vehicle
}
