package co.ehealth.platform.pharmacy;

// Why a medicine is on the prescription as "patient buys this" instead of
// "pharmacy dispenses this". Decided by the server from the stock at the time,
// never taken from the client, so the printed prescription cannot claim "out
// of stock" for something that was on the shelf.
public enum PurchaseReason {
    // The pharmacy carries it but had none when the prescription was written.
    OUT_OF_STOCK,
    // The pharmacy had some, but fewer than prescribed; this is the remainder.
    SHORT_STOCK,
    // Not a product the pharmacy carries at all.
    NOT_STOCKED
}
