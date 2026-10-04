package co.ehealth.platform.pharmacy.dispensing;

import java.time.Instant;
import java.util.UUID;

// Seam between dispensing and the Schedule 5/6 register. Dispensing calls
// this inside its own transaction for every lot drawn from a scheduled
// product, so a register failure rolls the dispense back (the register and
// the stock must never disagree).
//
// The real, append-only register is built separately (agent B4); until the
// integrator provides that implementation as a Spring bean, the
// do-nothing default in DispensingDefaultsConfig applies and no register
// entries are written.
public interface ScheduleRegisterRecorder {

    // Same parameter list as the register's own recordDispense (agent B4), so
    // the integrator can connect them directly. patientIdRef is the patient's
    // id as text.
    void recordDispense(UUID facilityId, UUID productId, String rxSerial, String patientName, String patientIdRef,
                        String prescriberName, String prescriberRegNo, long quantity, String lotNumber,
                        UUID dispensedBy, UUID ledgerTransactionId);

    void recordReturn(ReturnEntry entry);

    record ReturnEntry(UUID facilityId, UUID productId, UUID batchId, String lotNumber, int quantity,
                       String prescriptionSerial, UUID patientId, String patientName, boolean restocked,
                       UUID recordedByUserId, String recordedByName, UUID ledgerTransactionId, Instant recordedAt) {
    }
}
