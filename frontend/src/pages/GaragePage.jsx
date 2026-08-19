import { useEffect, useRef, useState } from 'react'
import AppShell from '../components/AppShell'
import PageHeader from '../components/PageHeader'
import VehicleCard from '../components/VehicleCard'
import { useAuth } from '../context/useAuth'
import { createVehicle, deleteVehicle, getVehicles } from '../services/vehicleService'
import { getCommonRoadVehicleMakes, getModelsForMakeIdYear, decodeVin } from '../services/nhtsaVehicleService'

const emptyForm = { year: '', make: '', model: '', mileage: '', vin: '' }
const MIN_DATABASE_YEAR = 1996
const MIN_MANUAL_YEAR = 1886

// NHTSA returns make names in ALL CAPS. These are kept as-is rather than
// title-cased because they are proper acronyms/initialisms, not words.
const ACRONYM_MAKES = new Set(['BMW', 'GMC', 'RAM', 'MINI', 'FIAT'])

function toTitleCaseWord(word) {
  if (!word) return word
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

function formatMakeDisplayName(rawName) {
  const trimmed = (rawName || '').trim()
  if (!trimmed) return ''

  if (ACRONYM_MAKES.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase()
  }

  return trimmed
    .split(' ')
    .map((word) => word.split('-').map(toTitleCaseWord).join('-'))
    .join(' ')
}

function GaragePage() {
  const { user } = useAuth()
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [deletingVehicleId, setDeletingVehicleId] = useState(null)
  const isMounted = useRef(true)

  const [manualEntry, setManualEntry] = useState(false)
  const [makes, setMakes] = useState([])
  const [makesLoading, setMakesLoading] = useState(false)
  const [selectedMakeId, setSelectedMakeId] = useState(null)
  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsLoadFailed, setModelsLoadFailed] = useState(false)
  const [vehicleDataError, setVehicleDataError] = useState(null)

  const [isMakeFocused, setIsMakeFocused] = useState(false)
  const [suggestionsDismissed, setSuggestionsDismissed] = useState(false)
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1)
  const makeInputRef = useRef(null)

  const [vinDecoding, setVinDecoding] = useState(false)
  const [vinDecodeError, setVinDecodeError] = useState(null)
  const [decodedVehicle, setDecodedVehicle] = useState(null)

  const currentYear = new Date().getFullYear()
  const maxYear = currentYear + 1

  const yearOptions = []
  for (let year = maxYear; year >= MIN_DATABASE_YEAR; year -= 1) {
    yearOptions.push(year)
  }

  const trimmedMakeQuery = form.make.trim()
  const makeSuggestions =
    trimmedMakeQuery.length >= 2
      ? makes
          .filter((make) => make.name.toLowerCase().includes(trimmedMakeQuery.toLowerCase()))
          .slice(0, 10)
      : []

  const showMakeSuggestions =
    !manualEntry && Boolean(form.year) && isMakeFocused && !suggestionsDismissed && trimmedMakeQuery.length >= 2

  const modelSelectLabel = (() => {
    if (!form.year || !selectedMakeId) return 'Select a year and make first'
    if (modelsLoading) return 'Loading models...'
    if (modelsLoadFailed) return 'Unable to load models'
    if (models.length === 0) return 'No models found'
    return 'Select model'
  })()

  const decodedEngineSummary = (() => {
    if (!decodedVehicle) return ''
    const parts = []
    if (decodedVehicle.engineCylinders) {
      parts.push(`${decodedVehicle.engineCylinders} cylinders`)
    }
    if (decodedVehicle.displacementLiters) {
      const displacementNumber = Number(decodedVehicle.displacementLiters)
      const displacementText = Number.isFinite(displacementNumber)
        ? displacementNumber.toFixed(1)
        : decodedVehicle.displacementLiters
      parts.push(`${displacementText} L`)
    }
    return parts.join(', ')
  })()

  useEffect(() => {
    isMounted.current = true

    const loadVehicles = async () => {
      setLoading(true)
      try {
        const data = await getVehicles()
        if (!isMounted.current) return
        setVehicles(data)
      } catch (err) {
        if (!isMounted.current) return
        setError(err.message || 'Failed to load vehicles.')
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    loadVehicles()

    return () => {
      isMounted.current = false
    }
  }, [])

  // Loads the combined car/truck/MPV make list only once a year is picked
  // in database mode, and only if it has not already been loaded this session.
  useEffect(() => {
    let cancelled = false

    const syncMakes = async () => {
      if (manualEntry || !form.year || makes.length > 0) {
        setMakesLoading(false)
        return
      }

      setMakesLoading(true)
      setVehicleDataError(null)
      try {
        const data = await getCommonRoadVehicleMakes()
        if (cancelled) return
        setMakes(data)
      } catch (err) {
        if (cancelled) return
        setVehicleDataError(
          err instanceof Error
            ? err.message
            : 'Unable to load vehicle makes. You can still add this vehicle manually.',
        )
      } finally {
        if (!cancelled) {
          setMakesLoading(false)
        }
      }
    }

    syncMakes()

    return () => {
      cancelled = true
    }
  }, [manualEntry, form.year, makes.length])

  // Loads models only once a manufacturer has been selected from the
  // suggestion list (selectedMakeId set). The `cancelled` flag ignores a
  // request's result once year/make change again before it resolves, so an
  // older, slower request can never overwrite newer models.
  useEffect(() => {
    let cancelled = false

    const syncModels = async () => {
      if (manualEntry || !form.year || !selectedMakeId) {
        setModels([])
        setModelsLoading(false)
        setModelsLoadFailed(false)
        return
      }

      setModelsLoading(true)
      setModels([])
      setModelsLoadFailed(false)
      setVehicleDataError(null)

      try {
        const data = await getModelsForMakeIdYear(selectedMakeId, form.year)
        if (cancelled) return
        setModels(data)
      } catch (err) {
        if (cancelled) return
        setModels([])
        setModelsLoadFailed(true)
        setVehicleDataError(
          err instanceof Error
            ? err.message
            : 'Unable to load vehicle models. You can still add this vehicle manually.',
        )
      } finally {
        if (!cancelled) {
          setModelsLoading(false)
        }
      }
    }

    syncModels()

    return () => {
      cancelled = true
    }
  }, [manualEntry, form.year, selectedMakeId])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleYearSelectChange = (e) => {
    const newYear = e.target.value
    setForm((prev) => ({ ...prev, year: newYear, make: '', model: '' }))
    setSelectedMakeId(null)
    setModels([])
    setModelsLoadFailed(false)
    setVehicleDataError(null)
    setSuggestionsDismissed(false)
    setHighlightedSuggestionIndex(-1)
  }

  const handleMakeInputChange = (e) => {
    const newMake = e.target.value
    setForm((prev) => ({ ...prev, make: newMake, model: '' }))
    setSelectedMakeId(null)
    setModels([])
    setModelsLoadFailed(false)
    setVehicleDataError(null)
    setHighlightedSuggestionIndex(-1)
    setSuggestionsDismissed(false)
  }

  const handleMakeInputFocus = () => {
    setIsMakeFocused(true)
  }

  const handleMakeInputBlur = () => {
    setIsMakeFocused(false)
    setHighlightedSuggestionIndex(-1)
  }

  const handleSelectMakeSuggestion = (make) => {
    setForm((prev) => ({ ...prev, make: formatMakeDisplayName(make.name), model: '' }))
    setSelectedMakeId(make.id)
    setModels([])
    setModelsLoadFailed(false)
    setVehicleDataError(null)
    setSuggestionsDismissed(true)
    setHighlightedSuggestionIndex(-1)
    makeInputRef.current?.focus()
  }

  const handleMakeInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setSuggestionsDismissed(true)
      setHighlightedSuggestionIndex(-1)
      return
    }

    if (!showMakeSuggestions || makeSuggestions.length === 0) {
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedSuggestionIndex((prev) => (prev + 1) % makeSuggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedSuggestionIndex((prev) => (prev <= 0 ? makeSuggestions.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      if (highlightedSuggestionIndex >= 0 && highlightedSuggestionIndex < makeSuggestions.length) {
        e.preventDefault()
        handleSelectMakeSuggestion(makeSuggestions[highlightedSuggestionIndex])
      }
    }
  }

  const handleModelSelectChange = (e) => {
    setForm((prev) => ({ ...prev, model: e.target.value }))
    setVehicleDataError(null)
  }

  const handleVinChange = (e) => {
    const newVin = e.target.value.toUpperCase()
    setForm((prev) => ({ ...prev, vin: newVin }))
    setVinDecodeError(null)
    setDecodedVehicle(null)
  }

  const handleDecodeVin = async () => {
    if (vinDecoding) return

    setVinDecodeError(null)
    setDecodedVehicle(null)
    setVinDecoding(true)

    try {
      const result = await decodeVin(form.vin)
      if (!isMounted.current) return
      setDecodedVehicle(result)

      if (result.hasCoreVehicleData) {
        setManualEntry(true)
        setForm((prev) => ({
          ...prev,
          vin: result.vin,
          year: result.year,
          make: formatMakeDisplayName(result.make),
          model: result.model,
        }))
        setSelectedMakeId(null)
        setModels([])
        setModelsLoadFailed(false)
        setVehicleDataError(null)
        setSuggestionsDismissed(false)
        setHighlightedSuggestionIndex(-1)
      }
    } catch (err) {
      if (!isMounted.current) return
      setVinDecodeError(
        err instanceof Error ? err.message : 'Unable to decode this VIN.',
      )
    } finally {
      if (isMounted.current) {
        setVinDecoding(false)
      }
    }
  }

  const handleToggleEntryMode = () => {
    setVehicleDataError(null)
    setModels([])
    setModelsLoadFailed(false)
    setSelectedMakeId(null)
    setSuggestionsDismissed(false)
    setHighlightedSuggestionIndex(-1)
    setDecodedVehicle(null)
    setVinDecodeError(null)

    setForm((prev) => {
      const next = { ...prev, make: '', model: '' }

      // Switching FROM manual mode back TO database mode: the database
      // year range starts at 1996, so drop a preserved year older than that.
      if (manualEntry && prev.year && Number(prev.year) < MIN_DATABASE_YEAR) {
        next.year = ''
      }

      return next
    })

    setManualEntry((prev) => !prev)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!form.year || !form.mileage) {
      setError('Please fill in all required fields.')
      return
    }

    if (!user?.id) {
      setError('You must be signed in to add a vehicle.')
      return
    }

    let vehiclePayload

    if (manualEntry) {
      const trimmedMake = form.make.trim()
      const trimmedModel = form.model.trim()
      if (!trimmedMake || !trimmedModel) {
        setError('Please fill in all required fields.')
        return
      }
      vehiclePayload = { ...form, make: trimmedMake, model: trimmedModel }
    } else {
      if (!selectedMakeId) {
        setVehicleDataError('Please select a manufacturer from the vehicle database.')
        return
      }
      const matchedModel = models.find(
        (model) => model.name.toLowerCase() === form.model.trim().toLowerCase(),
      )
      if (!matchedModel) {
        setVehicleDataError('Please select a model from the vehicle database.')
        return
      }
      vehiclePayload = { ...form, make: form.make.trim(), model: matchedModel.name }
    }

    setError(null)
    setVehicleDataError(null)
    setSubmitting(true)
    try {
      const newVehicle = await createVehicle(vehiclePayload, user.id)
      setVehicles((currentVehicles) => [newVehicle, ...currentVehicles])
      setForm(emptyForm)
      setManualEntry(false)
      setModels([])
      setModelsLoadFailed(false)
      setVehicleDataError(null)
      setSelectedMakeId(null)
      setSuggestionsDismissed(false)
      setDecodedVehicle(null)
      setVinDecodeError(null)
    } catch (err) {
      setError(err.message || 'Failed to add vehicle.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteVehicle = async (vehicle) => {
    if (deletingVehicleId) return

    const confirmed = window.confirm(
      `Delete ${vehicle.year} ${vehicle.make} ${vehicle.model}? This action cannot be undone.`,
    )
    if (!confirmed) return

    setError(null)
    setDeletingVehicleId(vehicle.id)
    try {
      await deleteVehicle(vehicle.id)
      setVehicles((currentVehicles) =>
        currentVehicles.filter((currentVehicle) => currentVehicle.id !== vehicle.id),
      )
    } catch (err) {
      setError(`Unable to delete vehicle: ${err.message || 'Unknown error.'}`)
    } finally {
      setDeletingVehicleId(null)
    }
  }

  return (
    <AppShell>
      <PageHeader title="My Garage" subtitle="Select a vehicle or add a new one" />
      <section className="card">
        <h2 className="card-title">Select a Vehicle</h2>
          <p style={{ color: '#666', fontSize: 14, marginTop: 0 }}>
            Choose a vehicle to view its dashboard and maintenance history.
          </p>
          {loading ? (
            <p className="empty-state">Loading vehicles...</p>
          ) : vehicles.length > 0 ? (
            <div className="vehicle-list">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  onDelete={() => handleDeleteVehicle(vehicle)}
                  isDeleting={deletingVehicleId === vehicle.id}
                  deleteDisabled={deletingVehicleId !== null}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">No vehicles yet. Add your first vehicle using the form below.</p>
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Add New Vehicle</h2>
          {error && (
            <p
              style={{
                color: '#d32f2f',
                background: '#ffebee',
                padding: '10px 14px',
                borderRadius: 6,
                borderLeft: '4px solid #f44336',
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={handleToggleEntryMode}
            disabled={submitting}
            style={{ marginBottom: 16 }}
          >
            {manualEntry ? 'Use vehicle database' : 'Cannot find your vehicle? Enter manually'}
          </button>
          <form className="maintenance-form" onSubmit={handleSubmit}>
            <div className="vin-decode-panel">
              <div className="form-group">
                <label htmlFor="vin">
                  VIN <span style={{ fontWeight: 'normal', color: '#999' }}>(optional)</span>
                </label>
                <div className="vin-decode-actions">
                  <input
                    type="text"
                    id="vin"
                    name="vin"
                    placeholder="e.g., 1HGBH41JXMN109186"
                    value={form.vin}
                    onChange={handleVinChange}
                    maxLength={17}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={handleDecodeVin}
                    disabled={vinDecoding || submitting}
                  >
                    {vinDecoding ? 'Decoding VIN...' : 'Decode VIN'}
                  </button>
                </div>
              </div>

              {vinDecodeError && (
                <p className="form-error" role="alert">
                  {vinDecodeError}
                </p>
              )}

              {decodedVehicle && (
                <div className="vin-decode-summary">
                  <p className={decodedVehicle.isClean && decodedVehicle.hasCoreVehicleData ? 'vin-decode-status' : 'vin-decode-warning'}>
                    {!decodedVehicle.hasCoreVehicleData
                      ? 'No complete vehicle match was found. Use the vehicle database or manual entry instead.'
                      : !decodedVehicle.isClean
                        ? 'NHTSA could not fully verify this VIN. Review the decoded details before adding the vehicle.'
                        : 'VIN decoded successfully. Review the details below before adding the vehicle.'}
                  </p>
                  <div className="vin-decode-details">
                    {decodedVehicle.year && (
                      <p>
                        <span className="label">Year</span> <span className="value">{decodedVehicle.year}</span>
                      </p>
                    )}
                    {decodedVehicle.make && (
                      <p>
                        <span className="label">Make</span>{' '}
                        <span className="value">{formatMakeDisplayName(decodedVehicle.make)}</span>
                      </p>
                    )}
                    {decodedVehicle.model && (
                      <p>
                        <span className="label">Model</span> <span className="value">{decodedVehicle.model}</span>
                      </p>
                    )}
                    {decodedVehicle.series && (
                      <p>
                        <span className="label">Series</span> <span className="value">{decodedVehicle.series}</span>
                      </p>
                    )}
                    {decodedVehicle.trim && (
                      <p>
                        <span className="label">Trim</span> <span className="value">{decodedVehicle.trim}</span>
                      </p>
                    )}
                    {decodedEngineSummary && (
                      <p>
                        <span className="label">Engine</span> <span className="value">{decodedEngineSummary}</span>
                      </p>
                    )}
                    {decodedVehicle.fuelType && (
                      <p>
                        <span className="label">Fuel Type</span> <span className="value">{decodedVehicle.fuelType}</span>
                      </p>
                    )}
                    {decodedVehicle.driveType && (
                      <p>
                        <span className="label">Drive Type</span> <span className="value">{decodedVehicle.driveType}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {vehicleDataError && (
              <p className="form-error" role="alert">
                {vehicleDataError}
              </p>
            )}

            {manualEntry ? (
              <>
                <div className="form-group">
                  <label htmlFor="year">Year *</label>
                  <input
                    type="number"
                    id="year"
                    name="year"
                    placeholder="e.g., 2020"
                    min={MIN_MANUAL_YEAR}
                    max={maxYear}
                    value={form.year}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="make">Make *</label>
                  <input
                    type="text"
                    id="make"
                    name="make"
                    placeholder="e.g., Toyota"
                    value={form.make}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="model">Model *</label>
                  <input
                    type="text"
                    id="model"
                    name="model"
                    placeholder="e.g., Camry"
                    value={form.model}
                    onChange={handleChange}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="year">Year *</label>
                  <select id="year" name="year" value={form.year} onChange={handleYearSelectChange} required>
                    <option value="">Select year</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="make">Make *</label>
                  <div className="make-combobox">
                    <input
                      ref={makeInputRef}
                      type="text"
                      id="make"
                      name="make"
                      role="combobox"
                      aria-expanded={showMakeSuggestions}
                      aria-controls="make-suggestions-listbox"
                      aria-autocomplete="list"
                      aria-activedescendant={
                        showMakeSuggestions && highlightedSuggestionIndex >= 0
                          ? `make-option-${makeSuggestions[highlightedSuggestionIndex]?.id}`
                          : undefined
                      }
                      aria-describedby="make-helper-text"
                      placeholder={form.year ? 'Start typing a manufacturer' : 'Select a year first'}
                      value={form.make}
                      onChange={handleMakeInputChange}
                      onFocus={handleMakeInputFocus}
                      onBlur={handleMakeInputBlur}
                      onKeyDown={handleMakeInputKeyDown}
                      disabled={!form.year || makesLoading}
                      autoComplete="off"
                      required
                    />
                    {showMakeSuggestions && (
                      <div className="make-combobox-suggestions" role="listbox" id="make-suggestions-listbox">
                        {makeSuggestions.length > 0 ? (
                          makeSuggestions.map((make, index) => (
                            <button
                              key={make.id}
                              type="button"
                              id={`make-option-${make.id}`}
                              role="option"
                              tabIndex={-1}
                              aria-selected={index === highlightedSuggestionIndex}
                              className={`make-suggestion-option${
                                index === highlightedSuggestionIndex ? ' is-highlighted' : ''
                              }`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectMakeSuggestion(make)}
                            >
                              {formatMakeDisplayName(make.name)}
                            </button>
                          ))
                        ) : (
                          <p className="make-combobox-empty">No matching manufacturers.</p>
                        )}
                      </div>
                    )}
                  </div>
                  {makesLoading && <p className="empty-state">Loading vehicle makes...</p>}
                  <p className="password-hint" id="make-helper-text">
                    Type at least two letters, then select a matching manufacturer.
                  </p>
                </div>
                <div className="form-group">
                  <label htmlFor="model">Model *</label>
                  <select
                    id="model"
                    name="model"
                    value={form.model}
                    onChange={handleModelSelectChange}
                    disabled={!form.year || !selectedMakeId || modelsLoading || modelsLoadFailed || models.length === 0}
                    required
                  >
                    <option value="">{modelSelectLabel}</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.name}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <p className="password-hint">
                    Specific trims and variants will be supported through VIN decoding.
                  </p>
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="mileage">Mileage (miles) *</label>
              <input
                type="number"
                id="mileage"
                name="mileage"
                placeholder="e.g., 32000"
                min="0"
                value={form.mileage}
                onChange={handleChange}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Adding Vehicle...' : 'Add Vehicle'}
            </button>
          </form>
        </section>
    </AppShell>
  )
}

export default GaragePage
