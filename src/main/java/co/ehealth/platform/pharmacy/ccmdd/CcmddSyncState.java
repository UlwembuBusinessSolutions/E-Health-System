package co.ehealth.platform.pharmacy.ccmdd;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name="ccmdd_synch_state")
public class CcmddSyncState {
    @Id private Short id = 1;
    @Column(name="last_success") private Instant lastSuccess;
    @Column(name="last_attempt") private Instant lastAttempt;
    @Column(name="last_error") private String lastError;
    protected CcmddSyncState() {}
    public CcmddSyncState(short id) { this.id = id; }
    public Instant getLastSuccess() { return lastSuccess; }
    public Instant getLastAttempt() { return lastAttempt; }
    public String getLastError() { return lastError; }
    public void success(Instant now) { lastSuccess = now; lastAttempt = now; lastError = null; }
    public void fail(Instant now, String reason) {
        lastAttempt = now;
        lastError = reason.length() > 500 ? reason.substring(0, 500) : reason;
    }
}
