import { PatientHomeDataProvider } from "@/components/patient/PatientHomeDataProvider"
import { PatientHomeSurface } from "@/components/patient/PatientHomeSurface"

export default function PatientHomePage() {
  return (
    <PatientHomeDataProvider>
      <PatientHomeSurface />
    </PatientHomeDataProvider>
  )
}
