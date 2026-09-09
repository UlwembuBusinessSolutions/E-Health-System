package co.ehealth.platform.core.clinic;

import java.util.UUID;

public final class ClinicContext {
    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private ClinicContext() { }

    public static UUID get() { return CURRENT.get(); }
    public static void set(UUID clinicId) { CURRENT.set(clinicId); }
    public static void clear() { CURRENT.remove(); }

    public static UUID require() {
        UUID clinicId = get();
        if (clinicId == null) {
            throw new ClinicAccessDeniedException("Select an assigned clinic using X-Clinic-ID.");
        }
        return clinicId;
    }

    public static void requireFacility(UUID facilityId) {
        if (!require().equals(facilityId)) {
            throw new ClinicAccessDeniedException("The facility is outside the active clinic context.");
        }
    }
}
