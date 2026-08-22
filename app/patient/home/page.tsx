import { PatientEvolutionSummary } from "@/components/patient/PatientEvolutionSummary"
import { PatientHomeDataProvider } from "@/components/patient/PatientHomeDataProvider"
import { PatientHomeV2 } from "@/components/patient/PatientHomeV2"
import { PatientRescueMode } from "@/components/patient/PatientRescueMode"

export default function PatientHomePage() {
  return (
    <PatientHomeDataProvider>
      <PatientRescueMode />
      <PatientHomeV2 />
      <PatientEvolutionSummary />
    </PatientHomeDataProvider>
  )
}
