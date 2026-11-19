package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

// Which ICD-10 conditions each medicine is used for.
//   - the pharmacy maintains the list on the product screen (PHRM:MANAGE),
//   - the prescriber's "Prescribing for I10" list reads it (PHRM:VIEW, the same access the medicine
//     picker already needs).
// Reading is by ICD-10 code; the stock check still happens in the normal medicine search, so this
// returns what a medicine is, not whether it is on the shelf.
@RestController
public class PharmacyProductIndicationController {

    private static final Pattern ICD10 = Pattern.compile("^[A-Z][0-9]{2}(\\.[0-9A-Z]{1,4})?$");
    private static final int MAX_CODES = 20;

    private final PharmacyProductIndicationRepository indications;
    private final PharmacyProductRepository products;
    private final PharmacyProductService productService;
    private final PermissionService permissionService;

    public PharmacyProductIndicationController(PharmacyProductIndicationRepository indications,
                                               PharmacyProductRepository products,
                                               PharmacyProductService productService,
                                               PermissionService permissionService) {
        this.indications = indications;
        this.products = products;
        this.productService = productService;
        this.permissionService = permissionService;
    }

    public record SetIndicationsRequest(List<String> icd10Codes) {
    }

    public record IndicatedMedicine(UUID productId, String name, String genericName, String strength,
                                    String dosageForm, String atcCode) {
        static IndicatedMedicine from(PharmacyProduct p) {
            return new IndicatedMedicine(p.getId(), p.getDisplayName(), p.getGenericName(), p.getStrength(),
                    p.getDosageForm(), p.getAtcCode());
        }
    }

    @GetMapping("/api/v1/pharmacy/products/{productId}/indications")
    public ResponseEntity<Map<String, Object>> forProduct(@PathVariable UUID productId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        productService.get(productId);
        List<String> codes = indications.findByProductId(productId).stream()
                .map(PharmacyProductIndication::getIcd10Code).sorted().toList();
        return ResponseEntity.ok(Map.of("items", codes));
    }

    // Replaces the whole list for the product. Only the differences are written, so saving an unchanged
    // list changes nothing.
    @PutMapping("/api/v1/pharmacy/products/{productId}/indications")
    @Transactional
    public ResponseEntity<Map<String, Object>> replace(@PathVariable UUID productId,
                                                       @RequestBody SetIndicationsRequest request) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        productService.get(productId);
        Set<String> wanted = normalise(request == null ? null : request.icd10Codes());

        List<PharmacyProductIndication> existing = indications.findByProductId(productId);
        List<PharmacyProductIndication> remove = existing.stream()
                .filter(row -> !wanted.contains(row.getIcd10Code())).toList();
        Set<String> have = existing.stream().map(PharmacyProductIndication::getIcd10Code).collect(Collectors.toSet());
        List<PharmacyProductIndication> add = new ArrayList<>();
        for (String code : wanted) {
            if (!have.contains(code)) add.add(new PharmacyProductIndication(productId, code));
        }
        indications.deleteAll(remove);
        indications.saveAll(add);
        return ResponseEntity.ok(Map.of("items", wanted.stream().sorted().toList()));
    }

    // The medicines recorded for one condition, e.g. everything used for I10. Active products only.
    @GetMapping("/api/v1/prescribing/indications/{icd10}/medicines")
    public ResponseEntity<Map<String, Object>> medicinesFor(@PathVariable String icd10) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        String code = icd10 == null ? "" : icd10.trim().toUpperCase(Locale.ROOT);
        if (!ICD10.matcher(code).matches()) {
            throw new PharmacyValidationException("That is not a valid ICD-10 code.");
        }
        List<UUID> ids = indications.findByIcd10Code(code).stream().map(PharmacyProductIndication::getProductId).toList();
        List<IndicatedMedicine> items = products.findAllById(ids).stream()
                .filter(PharmacyProduct::isActive)
                .sorted(Comparator.comparing(PharmacyProduct::getDisplayName, String.CASE_INSENSITIVE_ORDER))
                .map(IndicatedMedicine::from).toList();
        return ResponseEntity.ok(Map.of("icd10", code, "items", items));
    }

    private static Set<String> normalise(List<String> raw) {
        Set<String> codes = new LinkedHashSet<>();
        if (raw != null) {
            for (String value : raw) {
                String code = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
                if (code.isEmpty()) continue;
                if (!ICD10.matcher(code).matches()) {
                    throw new PharmacyValidationException("\"" + code + "\" is not a valid ICD-10 code. Use a code like I10 or E11.9.");
                }
                codes.add(code);
            }
        }
        if (codes.size() > MAX_CODES) {
            throw new PharmacyValidationException("A medicine can have at most " + MAX_CODES + " ICD-10 codes.");
        }
        return codes;
    }
}
