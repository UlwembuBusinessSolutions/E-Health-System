package co.ehealth.platform.visit;

final class QueueApproachPolicy {

    static final int TOKEN_THRESHOLD = 2;
    static final double MINUTES_THRESHOLD = 10.0;
    static final double FALLBACK_MINUTES_PER_TOKEN = 5.0;

    private QueueApproachPolicy() {
    }

    static boolean shouldNotify(int tokensAhead, double averageMinutesPerToken) {
        return tokensAhead > 0 && (tokensAhead <= TOKEN_THRESHOLD
            || tokensAhead * averageMinutesPerToken <= MINUTES_THRESHOLD);
    }
}