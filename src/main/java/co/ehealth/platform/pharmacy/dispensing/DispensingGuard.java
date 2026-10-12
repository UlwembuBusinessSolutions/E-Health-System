package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.NotLicensedException;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionNotFoundException;
import co.ehealth.platform.pharmacy.PrescriptionRepository;
import org.springframework.stereotype.Component;

import java.util.UUID;

// The checks every stock-moving pharmacy action starts with, in one place so
// dispensing, collecting and returning cannot drift apart.
@Component
public class DispensingGuard {

    private final PermissionService permissionService;
    private final StaffService staffService;
    private final UserRepository userRepository;
    private final PrescriptionRepository prescriptionRepository;

    public DispensingGuard(PermissionService permissionService, StaffService staffService,
                            UserRepository userRepository, PrescriptionRepository prescriptionRepository) {
        this.permissionService = permissionService;
        this.staffService = staffService;
        this.userRepository = userRepository;
        this.prescriptionRepository = prescriptionRepository;
    }

    // PHRM-US-009's other half: handing medicine over (or taking it back into
    // stock) needs a current SAPC registration, not just stock-management
    // permission (plan section 9, rule 6).
    public DispensingActor requireDispenser(UUID userId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staffService.getLicenseStatus(userId).canDispense()) {
            throw new NotLicensedException("You need a current SAPC registration to dispense.");
        }
        return actorFor(userId);
    }

    // For pharmacy work that changes records but never hands medicine over
    // (confirming a product, recording a prescriber's substitution answer).
    public DispensingActor requireManager(UUID userId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return actorFor(userId);
    }

    public Prescription loadPrescription(UUID prescriptionId) {
        return prescriptionRepository.findById(prescriptionId).orElseThrow(PrescriptionNotFoundException::new);
    }

    private DispensingActor actorFor(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Authenticated staff member no longer exists"));
        return new DispensingActor(userId, user.getFirstName() + " " + user.getLastName());
    }
}
