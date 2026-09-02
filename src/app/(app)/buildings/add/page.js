'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGeolocation } from '@/hooks/useGeolocation'
import { getMapProvider } from '@/lib/map-providers'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { uploadFile } from '@/lib/upload'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchStep } from '@/components/buildings/SearchStep'
import { ConfirmLocationStep } from '@/components/buildings/ConfirmLocationStep'
import { DuplicateWarningStep } from '@/components/buildings/DuplicateWarningStep'
import { DetailsForm } from '@/components/buildings/DetailsForm'

const STEPS = [
  { key: 'find', title: 'Find the building' },
  { key: 'confirm', title: 'Confirm location' },
  { key: 'details', title: 'Building details' },
]

/** The duplicate check interrupts the confirm step — shown as a warning state, not a fourth step. */
function stepIndex(step) {
  if (step === 'duplicate') return 1
  return STEPS.findIndex((s) => s.key === step)
}

function Stepper({ step }) {
  const active = stepIndex(step)
  const warning = step === 'duplicate'
  return (
    <div className="mb-6">
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              i < active
                ? 'bg-fiber'
                : i === active
                  ? warning
                    ? 'bg-warn'
                    : 'bg-fiber'
                  : 'bg-line'
            }`}
          />
        ))}
      </div>
      <p className={`mt-2 text-xs font-normal ${warning ? 'text-warn' : 'text-faint'}`}>
        Step {active + 1} of {STEPS.length}
        {warning && ' · Possible duplicate'}
      </p>
    </div>
  )
}

const STEP_TITLES = {
  find: 'Find the building',
  confirm: 'Confirm location',
  duplicate: 'Possible duplicate',
  details: 'Building details',
}

export default function AddBuildingPage() {
  const router = useRouter()
  const geo = useGeolocation()
  const [step, setStep] = useState('find')
  const [manual, setManual] = useState(false)
  const [draft, setDraft] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [duplicates, setDuplicates] = useState([])
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  // Admin-only alternative to GPS capture: typed coordinates win when set.
  const [manualPosition, setManualPosition] = useState(null)
  const position = manualPosition ?? geo.position

  function handleCandidateSelect(candidate) {
    setManual(false)
    // Prefer Google's labeled building name (premise) over the tapped
    // place's display name — surveyors tap the POI they recognize, but the
    // registry wants the building it sits in.
    const premiseName = candidate.premise || ''
    setDraft({
      placeId: candidate.placeId,
      buildingName: premiseName || candidate.name,
      nameSuggested: Boolean(premiseName && premiseName !== candidate.name),
      formattedAddress: candidate.formattedAddress,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    })
    setStep('confirm')
  }

  async function handleManual({ address, suggestedName = '' } = {}) {
    setManual(true)
    // SearchStep already reverse-geocoded the position — reuse it when present.
    let formattedAddress = address
    if (!formattedAddress) {
      try {
        const reverse = await getMapProvider().reverseGeocode(position)
        formattedAddress = reverse.formattedAddress
      } catch {
        formattedAddress = `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`
      }
    }
    setDraft({
      placeId: null,
      buildingName: suggestedName,
      nameSuggested: Boolean(suggestedName),
      formattedAddress,
      latitude: position.latitude,
      longitude: position.longitude,
    })
    setStep('confirm')
  }

  async function handleLocationConfirmed() {
    setCheckingDuplicates(true)
    try {
      const params = {
        latitude: draft.latitude,
        longitude: draft.longitude,
        name: draft.buildingName,
      }
      if (draft.placeId) params.placeId = draft.placeId
      const res = await apiClient.get('/buildings/nearby', { params })
      const found = res.data.data
      if (found.length > 0) {
        setDuplicates(found)
        setStep('duplicate')
      } else {
        setStep('details')
      }
    } catch {
      // Duplicate check is best-effort: the placeId constraint still protects at save.
      setStep('details')
    } finally {
      setCheckingDuplicates(false)
    }
  }

  async function handleSubmit(values, files) {
    setSubmitting(true)
    setServerError(null)
    try {
      const photos = []
      let documentUrl
      if (files.permissionLetter) {
        documentUrl = await uploadFile(files.permissionLetter)
        photos.push({ type: 'PERMISSION_LETTER', url: documentUrl })
      }
      if (files.entrancePhoto) {
        photos.push({ type: 'ENTRANCE', url: await uploadFile(files.entrancePhoto) })
      }
      for (const file of files.additionalPhotos) {
        photos.push({ type: 'ADDITIONAL', url: await uploadFile(file) })
      }

      const { zoneId, amountPaid, isLive, ...details } = values
      const payload = {
        placeId: draft.placeId,
        buildingName: draft.buildingName,
        formattedAddress: draft.formattedAddress,
        latitude: draft.latitude,
        longitude: draft.longitude,
        zoneId,
        isLive,
        details: Object.values(details).some((v) => v !== undefined && v !== '')
          ? details
          : undefined,
        permission:
          amountPaid !== undefined || documentUrl ? { amountPaid, documentUrl } : undefined,
        photos: photos.length ? photos : undefined,
      }

      await apiClient.post('/buildings', payload)
      router.replace('/buildings')
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Could not save the building'))
      setSubmitting(false)
    }
  }

  return (
    <main className="animate-fade-up mx-auto max-w-2xl">
      <PageHeader backHref="/buildings" backLabel="Buildings" title={STEP_TITLES[step]} />
      <Stepper step={step} />

      {step === 'find' && (
        <SearchStep
          position={position}
          geo={geo}
          onSelect={handleCandidateSelect}
          onManual={handleManual}
          onManualPosition={setManualPosition}
        />
      )}
      {step === 'confirm' && (
        <ConfirmLocationStep
          draft={draft}
          onDraftChange={setDraft}
          manual={manual}
          busy={checkingDuplicates}
          onContinue={handleLocationConfirmed}
        />
      )}
      {step === 'duplicate' && (
        <DuplicateWarningStep
          candidates={duplicates}
          onContinue={() => setStep('details')}
          onBack={() => setStep('find')}
        />
      )}
      {step === 'details' && (
        <DetailsForm onSubmit={handleSubmit} submitting={submitting} serverError={serverError} />
      )}
    </main>
  )
}
