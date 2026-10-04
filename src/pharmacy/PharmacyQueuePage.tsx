import { DispensingQueuePage } from "./dispensing/DispensingQueuePage";

// The router imports the dispensing screen under this name; the real
// implementation lives in ./dispensing/.
export function PharmacyQueuePage() {
  return <DispensingQueuePage />;
}
