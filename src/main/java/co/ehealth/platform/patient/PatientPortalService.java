package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.PatientPrincipal;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.visit.ServiceStream;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitRepository;
import co.ehealth.platform.visit.VisitType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Patient-facing reads. Every lookup starts from the signed-in account; no caller-supplied patient ID is accepted. */
@Service
public class PatientPortalService {

    private final PatientAccountRepository accounts;
    private final PatientRepository patients;
    private final VisitRepository visits;
    private final FacilityRepository facilities;

    public PatientPortalService(PatientAccountRepository accounts, PatientRepository patients,
                                VisitRepository visits, FacilityRepository facilities) {
        this.accounts = accounts;
        this.patients = patients;
        this.visits = visits;
        this.facilities = facilities;
    }

    @Transactional(readOnly = true)
    public OwnRecords getOwnRecords(PatientPrincipal principal) {
        PatientAccount account = accounts.findById(principal.patientAccountId())
                .orElseThrow(PatientNotFoundException::new);
        UUID patientId = account.getPatientId();
        if (patientId == null) {
            throw new PatientNotFoundException();
        }

        Patient patient = patients.findById(patientId).orElseThrow(PatientNotFoundException::new);
        List<Visit> patientVisits = visits.findByPatientIdOrderByVisitDateTimeDesc(patientId);
        Set<UUID> facilityIds = patientVisits.stream().map(Visit::getFacilityId).collect(Collectors.toSet());
        Map<UUID, String> facilityNames = facilities.findAllById(facilityIds).stream()
                .collect(Collectors.toMap(Facility::getId, Facility::getName));

        List<VisitSummary> visitSummaries = patientVisits.stream()
                .map(visit -> new VisitSummary(visit.getId(), facilityNames.get(visit.getFacilityId()),
                        visit.getVisitType(), visit.getServiceStream(), visit.getVisitDateTime()))
                .toList();
        return new OwnRecords(patient.getMpiNumber(), patient.getFirstName(), patient.getLastName(),
                patient.getDateOfBirth(), patient.getGender(), patient.getAddress(), patient.getContactNumber(),
                patient.getEmail(), visitSummaries);
    }

    public record OwnRecords(String mpiNumber, String firstName, String lastName, LocalDate dateOfBirth,
                             Gender gender, String address, String contactNumber, String email,
                             List<VisitSummary> visits) { }

    public record VisitSummary(UUID id, String facilityName, VisitType visitType, ServiceStream serviceStream,
                               Instant visitDateTime) { }
}
