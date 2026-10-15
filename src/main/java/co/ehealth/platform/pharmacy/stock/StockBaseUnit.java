package co.ehealth.platform.pharmacy.stock;

// Plan section 4: "Base stock unit: Required: tablet, capsule, bottle,
// vial, sealed pack or each." Frozen per product after its first posted
// movement (PharmacyProductService.update()'s own why-note) — a material
// unit change makes a new product, never a silent reinterpretation of
// quantities already posted under the old one.
public enum StockBaseUnit {
    TABLET, CAPSULE, BOTTLE, VIAL, SEALED_PACK, EACH
}
