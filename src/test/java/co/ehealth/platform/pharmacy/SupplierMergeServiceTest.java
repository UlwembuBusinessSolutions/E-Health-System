package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptRepository;
import co.ehealth.platform.pharmacy.supplier.InvalidSupplierStateException;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierProductRepository;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierRepository;
import co.ehealth.platform.pharmacy.supplier.SupplierMergeService;
import co.ehealth.platform.pharmacy.supplier.SupplierService;
import co.ehealth.platform.pharmacy.supplier.SupplierStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupplierMergeServiceTest {

    @Mock SupplierService supplierService;
    @Mock PharmacySupplierRepository supplierRepository;
    @Mock PharmacySupplierProductRepository supplierProductRepository;
    @Mock PharmacyReceiptRepository receiptRepository;
    @Mock PharmacyProductRepository productRepository;

    private SupplierMergeService mergeService;
    private PharmacySupplier source;
    private PharmacySupplier target;

    @BeforeEach
    void setUp() {
        mergeService = new SupplierMergeService(supplierService, supplierRepository, supplierProductRepository,
                receiptRepository, productRepository, PharmacyTestData.CLOCK);
        source = PharmacyTestData.supplier("Cipla Medpro");
        target = PharmacyTestData.supplier("Cipla Medpro (Pty) Ltd");
    }

    private void bothSuppliersExist() {
        when(supplierService.get(source.getId())).thenReturn(source);
        when(supplierService.get(target.getId())).thenReturn(target);
    }

    @Test
    void repointsReceiptsProductLinksAndPreferredSupplierThenArchivesTheSource() {
        bothSuppliersExist();

        PharmacySupplier survivor = mergeService.merge(source.getId(), target.getId());

        assertEquals(target, survivor);
        InOrder inOrder = inOrder(receiptRepository, supplierProductRepository, productRepository, supplierRepository);
        inOrder.verify(receiptRepository).repointSupplier(source.getId(), target.getId());
        inOrder.verify(supplierProductRepository).copyLinks(source.getId(), target.getId());
        inOrder.verify(supplierProductRepository).deleteAllForSupplier(source.getId());
        inOrder.verify(productRepository).repointPreferredSupplier(source.getId(), target.getId());
        inOrder.verify(supplierRepository).save(source);
    }

    @Test
    void sourceIsArchivedAndRemembersWhereItWentWhileTargetStaysActive() {
        bothSuppliersExist();

        mergeService.merge(source.getId(), target.getId());

        assertEquals(SupplierStatus.ARCHIVED, source.getStatus());
        assertEquals(target.getId(), source.getMergedIntoId());
        assertTrue(target.isActive());
    }

    @Test
    void cannotMergeASupplierIntoItself() {
        assertThrows(InvalidSupplierStateException.class,
                () -> mergeService.merge(source.getId(), source.getId()));

        verifyNoInteractions(receiptRepository, supplierProductRepository, productRepository);
    }

    @Test
    void cannotMergeIntoAnArchivedSupplier() {
        bothSuppliersExist();
        target.archive(PharmacyTestData.CLOCK.instant());

        assertThrows(InvalidSupplierStateException.class, () -> mergeService.merge(source.getId(), target.getId()));

        verify(receiptRepository, never()).repointSupplier(any(), any());
    }

    @Test
    void cannotMergeASupplierThatWasAlreadyMerged() {
        bothSuppliersExist();
        source.archiveAsMergedInto(PharmacyTestData.supplier("Someone Else").getId(), PharmacyTestData.CLOCK.instant());

        assertThrows(InvalidSupplierStateException.class, () -> mergeService.merge(source.getId(), target.getId()));

        verify(receiptRepository, never()).repointSupplier(any(), any());
    }
}
