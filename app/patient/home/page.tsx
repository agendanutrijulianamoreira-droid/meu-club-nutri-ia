import { PatientEvolutionSummary } from "@/components/patient/PatientEvolutionSummary"
import { PatientHomeV2 } from "@/components/patient/PatientHomeV2"
import { PatientRescueMode } from "@/components/patient/PatientRescueMode"

export default function PatientHomePage() {
  return (
    <>
      <PatientRescueMode />
      <PatientHomeV2 />
      <PatientEvolutionSummary />
    </>
  )
}
