package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Names for the patients and staff on a page of prescriptions, loaded in two
// queries rather than one per row. Reads the repositories directly: the
// calling pharmacy endpoint is already gated by PHRM access, and a
// prescription is unusable without who it is for and who wrote it.
@Component
public class PartyDirectory {

    private final PatientRepository patientRepository;
    private final UserRepository userRepository;

    public PartyDirectory(PatientRepository patientRepository, UserRepository userRepository) {
        this.patientRepository = patientRepository;
        this.userRepository = userRepository;
    }

    public Map<UUID, Patient> patients(Collection<UUID> patientIds) {
        return patientRepository.findAllById(patientIds).stream()
                .collect(Collectors.toMap(Patient::getId, Function.identity()));
    }

    public Map<UUID, User> users(Collection<UUID> userIds) {
        return userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
    }

    public static String fullName(Patient patient) {
        return patient.getFirstName() + " " + patient.getLastName();
    }

    public static String fullName(User user) {
        return user.getFirstName() + " " + user.getLastName();
    }

    // Registration number prefers HPCSA, falling back to SANC — a prescriber
    // may hold only one (PrescriptionService.create()'s canPrescribe() gate
    // accepts either).
    public static String registrationNumber(User prescriber) {
        return prescriber.getHpcsaNumber() != null ? prescriber.getHpcsaNumber() : prescriber.getSancNumber();
    }
}
