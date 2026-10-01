package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.facility.FacilityNotFoundException;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/pharmacy/stock/positions")
public class PharmacyStockPositionController {
    private final PharmacyStockAccountRepository accounts;
    private final PharmacyProductRepository products;
    private final PharmacyBatchRepository batches;
    private final PharmacyStockLocationRepository locations;
    private final PharmacyFacilityProductRepository assortment;
    private final FacilityRepository facilities;
    private final PermissionService permissions;
    private final Clock clock;
    public PharmacyStockPositionController(PharmacyStockAccountRepository accounts, PharmacyProductRepository products,
            PharmacyBatchRepository batches, PharmacyStockLocationRepository locations, PharmacyFacilityProductRepository assortment,
            FacilityRepository facilities, PermissionService permissions, Clock clock) {
        this.accounts=accounts; this.products=products; this.batches=batches; this.locations=locations;
        this.assortment=assortment; this.facilities=facilities; this.permissions=permissions; this.clock=clock;
    }
    public record Position(UUID accountId, UUID productId, String code, String displayName, StockBaseUnit baseUnit,
            Integer packSize, UUID batchId, String lotNumber, LocalDate expiryDate, UUID locationId, String locationName,
            long physical, long available, Integer reorderThreshold, String status) {}

    @GetMapping
    @Transactional(readOnly=true)
    public Map<String,Object> list(@RequestParam UUID facilityId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        var facility=facilities.findById(facilityId).orElseThrow(FacilityNotFoundException::new);
        var today=LocalDate.now(clock.withZone(ZoneId.of(facility.getTimezone())));
        var thresholds=new HashMap<UUID,Integer>();
        var stocked=assortment.findByFacilityIdAndActiveTrue(facilityId);
        stocked.forEach(a -> thresholds.put(a.getProductId(),a.getReorderThreshold()));
        var rows=new ArrayList<Position>();
        var seen=new HashSet<UUID>();
        for(var account:accounts.findAllByFacility(facilityId)) {
            var product=products.findById(account.getProductId()).orElseThrow();
            var batch=batches.findById(account.getBatchId()).orElseThrow();
            var location=locations.findById(account.getLocationId()).orElseThrow();
            var expired=batch.isExpiredAsOf(today);
            long available=product.isActive() && location.isActive() && !expired && account.getBucket()==StockBucket.AVAILABLE ? account.getQuantity() : 0;
            var threshold=thresholds.get(product.getId());
            String status=expired?"Expired":account.getBucket()!=StockBucket.AVAILABLE?"Held":!product.isActive() || !location.isActive()?"Unavailable":
                    available==0?"Out of stock":threshold!=null && available<=threshold?"Low stock":
                    batch.getExpiryDate()!=null && !batch.getExpiryDate().isAfter(today.plusDays(30))?"Expiring soon":"In stock";
            rows.add(new Position(account.getId(),product.getId(),product.getCode(),product.getDisplayName(),product.getBaseUnit(),
                    product.getPackSize(),batch.getId(),batch.getLotNumber(),batch.getExpiryDate(),location.getId(),location.getName(),
                    account.getQuantity(),available,threshold,status));
            seen.add(product.getId());
        }
        for(var entry:stocked) {
            if(seen.contains(entry.getProductId()))continue;
            var product=products.findById(entry.getProductId()).orElseThrow();
            if(product.isActive()) rows.add(new Position(null,product.getId(),product.getCode(),product.getDisplayName(),product.getBaseUnit(),
                    product.getPackSize(),null,null,null,null,null,0,0,entry.getReorderThreshold(),"Out of stock"));
        }
        rows.sort(Comparator.comparing(Position::displayName,String.CASE_INSENSITIVE_ORDER)
                .thenComparing(Position::expiryDate,Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(Position::lotNumber,Comparator.nullsLast(Comparator.naturalOrder())));
        return Map.of("items",rows);
    }
}
