package co.ehealth.platform.pharmacy.stock;

// Plan section 6: "Store full dates where supplied. For month/year labels
// retain precision..." — DAY means the recorded expiry_date is the exact
// printed date; MONTH means only a month/year was printed and
// expiry_date has been normalized to that month's last day (the plan's
// own proposed rule: "usable through the recorded date, blocked from the
// next day's start"), with printed_expiry on the batch preserving what was
// actually on the pack.
public enum ExpiryPrecision {
    DAY, MONTH
}
