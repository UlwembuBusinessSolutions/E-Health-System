package co.ehealth.platform.pharmacy.supplier;

import java.util.UUID;

// The 409 body for a duplicate supplier (contract: {code, existing:{id,name},
// similar}); message is included too so generic error rendering still works.
public record DuplicateSupplierResponse(String code, String message, Existing existing, boolean similar) {

    public static final String CODE = "DUPLICATE_SUPPLIER";

    public record Existing(UUID id, String name) {
    }

    public static DuplicateSupplierResponse from(DuplicateSupplierException ex) {
        return new DuplicateSupplierResponse(CODE, ex.getMessage(),
                new Existing(ex.getExistingId(), ex.getExistingName()), ex.isSimilar());
    }
}
