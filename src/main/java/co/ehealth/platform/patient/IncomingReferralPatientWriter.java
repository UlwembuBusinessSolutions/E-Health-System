package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.FacilityService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Optional;
import java.util.UUID;

@Service
public class IncomingReferralPatientWriter {

    private final PatientRepository patientRepository;
    private final OrganizationRepository organizationRepository;
    private final FacilityService facilityService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public IncomingReferralPatientWriter(PatientRepository patientRepository,
                                         OrganizationRepository organizationRepository,
                                         FacilityService facilityService, AuditLogService auditLogService,
                                         Clock clock) {
        this.patientRepository = patientRepository;
        this.organizationRepository = organizationRepository;
        this.facilityService = facilityService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional
    public IncomingReferralService.PatientReceived store(IncomingReferralService.IncomingPatient incoming,
                                                          UUID facilityId, UUID actorId) {
        facilityService.get(facilityId);
        Optional<Patient> existing = patientRepository.findByIdNumber(incoming.idNumber());
        if (existing.isPresent()) {
            Patient patient = existing.get();
            if (patient.isArchived()) {
                throw new PatientAlreadyExistsAtDestinationException(
                        "This patient has an archived record at this clinic. Reconcile it before accepting the referral.");
            }
            return new IncomingReferralService.PatientReceived(patient.getId(), patient.getMpiNumber(),
                    patient.getFirstName() + " " + patient.getLastName(), true);
        }

        Organization organization = organizationRepository.findBySchemaName(TenantContext.getCurrentTenant())
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"));
        String mpiNumber = MpiNumberFormat.generate(organization.getTenantCode(),
                patientRepository.nextMpiSequenceValue());
        Patient patient = new Patient(mpiNumber, incoming.firstName(), incoming.lastName(), incoming.dateOfBirth(),
                incoming.gender(), incoming.citizenshipStatus(), incoming.idNumber(), incoming.address(),
                incoming.contactNumber(), incoming.email(), incoming.medicalAidProvider(), incoming.medicalAidNumber(),
                incoming.passportNumber(), incoming.passportExpiry(), actorId, clock.instant());
        patientRepository.save(patient);
        auditLogService.append(actorId, facilityId, "PATIENT_RECEIVED_VIA_REFERRAL", "Patient",
                patient.getId().toString(), null,
                "{\"referralId\":\"%s\"}".formatted(incoming.referralId()));
        return new IncomingReferralService.PatientReceived(patient.getId(), patient.getMpiNumber(),
                patient.getFirstName() + " " + patient.getLastName(), false);
    }
}
