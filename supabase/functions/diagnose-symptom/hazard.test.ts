// Focused tests for the deterministic safety-guard hazard detection in
// hazardSafety.ts. Run with: deno test supabase/functions/diagnose-symptom
//
// Imports only from hazardSafety.ts, never index.ts -- index.ts is the
// Edge Function entrypoint and calls Deno.serve(...) at module scope, so
// importing it here would trigger that server-startup side effect just to
// run a unit test.
//
// Deliberately uses Deno's built-in test runner and a tiny local assert
// instead of an external std/assert import, so this has zero dependency
// resolution risk beyond Deno itself.
import { isCriticalHazard } from './hazardSafety.ts'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const MUST_TRIGGER: Array<[string, string]> = [
  [
    'overheating temperature + steam (the originally failed case)',
    'The engine temperature keeps climbing and steam is coming from under the hood.',
  ],
  ['steam alone with engine-bay location', 'Steam is pouring out from under the hood.'],
  ['brake pedal to floor + barely slowing', 'The brake pedal goes to the floor and the car is barely slowing down.'],
  ['brakes not working', 'The brakes are not working.'],
  ['flames from engine bay', 'There are flames coming from under the hood.'],
  ['oil pressure warning while running', 'The oil pressure warning is on while the engine is running.'],
  ['sudden loss of steering', 'I suddenly cannot steer the car.'],
]

const MUST_NOT_TRIGGER: Array<[string, string]> = [
  ['routine brake squeak', 'My brakes squeak at low speed.'],
  ['warm AC air', 'My AC is blowing warm air.'],
  ['routine coolant change', 'I think I need a coolant change.'],
  ['steering wheel vibration', 'The steering wheel vibrates at highway speed.'],
  ['slow warm-up', 'The engine takes a while to warm up.'],
]

for (const [label, text] of MUST_TRIGGER) {
  Deno.test(`isCriticalHazard triggers: ${label}`, () => {
    assert(isCriticalHazard(text) === true, `Expected hazard for: "${text}"`)
  })
}

for (const [label, text] of MUST_NOT_TRIGGER) {
  Deno.test(`isCriticalHazard does not trigger: ${label}`, () => {
    assert(isCriticalHazard(text) === false, `Did not expect hazard for: "${text}"`)
  })
}
