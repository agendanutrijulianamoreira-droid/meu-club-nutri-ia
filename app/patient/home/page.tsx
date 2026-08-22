import { PatientEvolutionSummary } from "@/components/patient/PatientEvolutionSummary"
import { PatientHomeV2 } from "@/components/patient/PatientHomeV2"

export default function PatientHomePage() {
  return (
    <>
      <PatientHomeV2 />
      <PatientEvolutionSummary />
    </>
  )
}
