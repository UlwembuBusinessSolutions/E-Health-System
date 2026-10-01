package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.stock.*;
import co.ehealth.platform.identity.UserRepository;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class PrescriptionStockService {
    private final PharmacyProductRepository products;
    private final PharmacyBatchRepository batches;
    private final PharmacyStockLocationRepository locations;
    private final PharmacyStockLedgerService ledger;
    private final UserRepository users;
    private final Clock clock;
    private final co.ehealth.platform.facility.FacilityRepository facilities;

    public PrescriptionStockService(PharmacyProductRepository products, PharmacyBatchRepository batches,
            PharmacyStockLocationRepository locations, PharmacyStockLedgerService ledger, UserRepository users, Clock clock, co.ehealth.platform.facility.FacilityRepository facilities) {
        this.products = products; this.batches = batches; this.locations = locations;
        this.ledger = ledger; this.users = users; this.clock = clock; this.facilities = facilities;
    }

    // Quantity is in whole base units, never packs. A pack of 30 may supply 7 tablets.
    public record DispenseCommand(@NotNull UUID productId, @NotNull UUID batchId,
                                  @NotNull UUID locationId, @Positive int quantity,
                                  @NotNull LocalDate supplyUntil, boolean acknowledgeDuplicateSupply,
                                  List<UUID> acknowledgedSupplyIds) {
        public DispenseCommand {
            acknowledgedSupplyIds = acknowledgedSupplyIds == null ? List.of() : List.copyOf(acknowledgedSupplyIds);
        }
        public DispenseCommand(UUID productId, UUID batchId, UUID locationId, int quantity, LocalDate until, boolean acknowledge) {
            this(productId, batchId, locationId, quantity, until, acknowledge, List.of());
        }
        public DispenseCommand(UUID productId, UUID batchId, UUID locationId, int quantity) {
            this(productId, batchId, locationId, quantity, null, false, List.of());
        }
    }

    public PharmacyProduct requireActiveProduct(UUID id) {
        var product = products.findById(id).orElseThrow(PharmacyProductNotFoundException::new);
        if (!product.isActive()) throw new InvalidDispenseException("Select an active product.");
        return product;
    }

    public PharmacyProduct getProduct(UUID id) {
        return id == null ? null : products.findById(id).orElse(null);
    }

    private String hash(DispenseCommand command) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(command.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void dispense(Prescription prescription, PrescriptionItem item, UUID actor, DispenseCommand command) {
        if (command == null || command.productId() == null || command.batchId() == null || command.locationId() == null)
            throw new InvalidDispenseException("Product, batch and location are required.");
        if (item.getClinicalCheckStatus() != ClinicalCheckStatus.PASSED)
            throw new InvalidDispenseException("Clinical review is required before dispensing.");
        if (!command.productId().equals(item.getProductId()))
            throw new InvalidDispenseException("Selected stock must match the clinically reviewed product.");
        var product = products.findById(command.productId()).orElseThrow(PharmacyProductNotFoundException::new);
        var batch = batches.findById(command.batchId()).orElseThrow(() -> new InvalidDispenseException("Unknown batch."));
        var location = locations.findById(command.locationId()).orElseThrow(() -> new InvalidDispenseException("Unknown stock location."));
        if (!product.isActive() || !location.isActive() || !batch.getProductId().equals(product.getId())
                || !location.getFacilityId().equals(prescription.getFacilityId()))
            throw new InvalidDispenseException("Selected stock must be active, match the product and belong to this clinic.");
        if (batch.isExpiredAsOf(LocalDate.now(clock.withZone(java.time.ZoneId.of(
                facilities.findById(prescription.getFacilityId()).orElseThrow(co.ehealth.platform.facility.FacilityNotFoundException::new).getTimezone())))))
            throw new InvalidDispenseException("Expired stock cannot be dispensed.");
        item.dispenseQuantity(command.quantity());
        var user = users.findById(actor).orElseThrow(() -> new InvalidDispenseException("Unknown dispenser."));
        ledger.postEntries(StockTransactionType.DISPENSE, prescription.getFacilityId(), actor,
                user.getFirstName() + " " + user.getLastName(), null, prescription.getSerialNumber(),
                "dispense:" + item.getId() + ":" + item.getDispensedQuantity(),
                hash(command), List.of(new PharmacyStockLedgerService.EntryRequest(product.getId(), batch.getId(),
                        location.getId(), StockBucket.AVAILABLE, -((long) command.quantity()))));
    }
}
