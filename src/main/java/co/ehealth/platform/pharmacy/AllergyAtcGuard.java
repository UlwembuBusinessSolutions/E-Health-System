package co.ehealth.platform.pharmacy;

import co.ehealth.platform.consultation.AllergyStatus;
import co.ehealth.platform.consultation.Consultation;
import co.ehealth.platform.consultation.ConsultationRepository;
import co.ehealth.platform.patient.AllergenType;
import co.ehealth.platform.patient.AllergyRecordStatus;
import co.ehealth.platform.patient.PatientAllergyRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The allergy rule from the story: "If the ATC code of the medicine prescribed contains the same 5
 * characters as a recorded allergy, it cannot be prescribed and a warning is shown."
 *
 * Two sources of "recorded allergy" are checked together, so neither can be bypassed by the other:
 *   1. the allergies written on the consultation being signed (the original source), and
 *   2. the patient's allergy record (Patient Allergy Management story) — every active MEDICATION allergy.
 *
 * The allergy detail is parsed as real JSON, so a name that contains a quote or a brace can no longer
 * defeat the check. The same rule runs in the browser (frontend prescribing/entries.ts) so the doctor sees
 * the warning while writing; this class is the server-side guarantee that signing can never bypass it.
 */
@Component
public class AllergyAtcGuard {

    private static final Pattern ATC = Pattern.compile("^[A-Z][0-9]{2}[A-Z]{2}([A-Z0-9]{1,2})?$");
    // Older consultations stored the allergy as free text; "ATC: N02BE" inside it still counts.
    private static final Pattern LEGACY_ATC = Pattern.compile("(?i)ATC\\s*[:=]\\s*([A-Z][0-9]{2}[A-Z]{2})");

    public record RecordedAllergy(String name, String atcCode) {
        String group() {
            return atcCode.substring(0, 5);
        }
    }

    private final ConsultationRepository consultationRepository;
    private final PharmacyProductRepository productRepository;
    private final ObjectMapper objectMapper;
    private final PatientAllergyRepository patientAllergyRepository;

    @Autowired
    public AllergyAtcGuard(ConsultationRepository consultationRepository, PharmacyProductRepository productRepository,
                           ObjectMapper objectMapper, PatientAllergyRepository patientAllergyRepository) {
        this.consultationRepository = consultationRepository;
        this.productRepository = productRepository;
        this.objectMapper = objectMapper;
        this.patientAllergyRepository = patientAllergyRepository;
    }

    // The constructor from before the patient allergy record existed — only the consultation is checked.
    public AllergyAtcGuard(ConsultationRepository consultationRepository, PharmacyProductRepository productRepository,
                           ObjectMapper objectMapper) {
        this(consultationRepository, productRepository, objectMapper, null);
    }

    /** Consultation-only check, kept for callers that have no patient id. */
    public void requireSafe(UUID consultationId, Collection<UUID> productIds) {
        requireSafe(consultationId, null, productIds);
    }

    /**
     * Throws a PharmacyValidationException (shown to the doctor) when the prescription must not be signed.
     *
     * @param consultationId the consultation being signed, or null
     * @param patientId      the patient being prescribed for; their allergy record is checked too
     * @param productIds     the product behind every line, in any order. A null entry is a line typed by hand
     *                       with no catalogue product, which cannot be checked.
     */
    public void requireSafe(UUID consultationId, UUID patientId, Collection<UUID> productIds) {
        List<RecordedAllergy> allergies = new ArrayList<>();

        Consultation consultation = consultationId == null ? null
                : consultationRepository.findById(consultationId).orElse(null);
        if (consultation != null && consultation.getAllergyStatus() == AllergyStatus.KNOWN) {
            List<RecordedAllergy> fromConsultation = parseAllergies(consultation.getAllergyDetail());
            if (fromConsultation.isEmpty()) {
                throw new PharmacyValidationException(
                        "Known allergies must include a valid ATC code before a prescription can be signed.");
            }
            allergies.addAll(fromConsultation);
        }
        allergies.addAll(registeredAllergies(patientId));

        if (patientId != null && patientAllergyRepository != null && !productIds.isEmpty()) {
            var blockedProductIds = patientAllergyRepository
                    .findByPatientIdAndStatusAndAllergenType(patientId, AllergyRecordStatus.ACTIVE, AllergenType.MEDICATION)
                    .stream().map(a -> a.getCatalogProductId()).filter(java.util.Objects::nonNull)
                    .collect(java.util.stream.Collectors.toSet());
            if (productIds.stream().filter(java.util.Objects::nonNull).anyMatch(blockedProductIds::contains)) {
                throw new PharmacyValidationException("Cannot prescribe a medicine recorded as an allergy for this patient.");
            }
        }

        if (allergies.isEmpty()) return;

        if (productIds.stream().anyMatch(java.util.Objects::isNull)) {
            throw new PharmacyValidationException(
                    "Choose a catalogued medicine with an ATC code so allergy safety can be checked.");
        }
        for (PharmacyProduct product : productRepository.findAllById(productIds.stream().distinct().toList())) {
            String atc = product.getAtcCode();
            if (atc == null || atc.length() < 5) {
                throw new PharmacyValidationException("Add an ATC code to " + product.getDisplayName()
                        + " before prescribing it for a patient with a recorded allergy.");
            }
            String group = atc.substring(0, 5).toUpperCase(Locale.ROOT);
            for (RecordedAllergy allergy : allergies) {
                if (allergy.group().equals(group)) {
                    throw new PharmacyValidationException("Cannot prescribe " + product.getDisplayName()
                            + ": it shares ATC group " + group + " with the recorded allergy to " + allergy.name()
                            + " (" + allergy.atcCode() + "). Choose another medicine.");
                }
            }
        }
    }

    // Active medication allergies on the patient's own allergy record. The table's CHECK constraint
    // guarantees every one carries a valid ATC code; the pattern test is a second line of defence.
    private List<RecordedAllergy> registeredAllergies(UUID patientId) {
        if (patientId == null || patientAllergyRepository == null) return List.of();
        return patientAllergyRepository
                .findByPatientIdAndStatusAndAllergenType(patientId, AllergyRecordStatus.ACTIVE, AllergenType.MEDICATION)
                .stream()
                .filter(a -> a.getAllergyCode() != null
                        && ATC.matcher(a.getAllergyCode().toUpperCase(Locale.ROOT)).matches())
                .map(a -> new RecordedAllergy(a.getAllergyName(), a.getAllergyCode().toUpperCase(Locale.ROOT)))
                .toList();
    }

    List<RecordedAllergy> parseAllergies(String detail) {
        String text = detail == null ? "" : detail.trim();
        List<RecordedAllergy> allergies = new ArrayList<>();
        if (text.startsWith("[")) {
            JsonNode root;
            try {
                root = objectMapper.readTree(text);
            } catch (Exception e) {
                throw new PharmacyValidationException(
                        "The recorded allergies could not be read. Re-enter them before prescribing.");
            }
            for (JsonNode node : root) {
                String name = node.path("name").asText("").trim();
                String code = node.path("atcCode").asText("").trim().toUpperCase(Locale.ROOT);
                if (name.isEmpty() || !ATC.matcher(code).matches()) {
                    throw new PharmacyValidationException(
                            "Complete the allergen name and valid ATC code for every recorded allergy before prescribing.");
                }
                allergies.add(new RecordedAllergy(name, code));
            }
            return allergies;
        }
        Matcher legacy = LEGACY_ATC.matcher(text);
        while (legacy.find()) {
            allergies.add(new RecordedAllergy("a recorded allergy", legacy.group(1).toUpperCase(Locale.ROOT)));
        }
        return allergies;
    }
}
