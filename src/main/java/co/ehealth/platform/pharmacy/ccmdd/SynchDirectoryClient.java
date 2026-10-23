package co.ehealth.platform.pharmacy.ccmdd;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

/** SYNCH integration contract: an array or {items:[...]} / {pickupPoints:[...]} JSON response.
 * The URL and bearer token are server-side settings, never accepted from a browser request.
 */
@Component
public class SynchDirectoryClient {
    private final String url;
    private final String token;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
    private final ObjectMapper mapper;

    public SynchDirectoryClient(@Value("${app.ccmdd.synch-url:}") String url,
                                @Value("${app.ccmdd.synch-token:}") String token, ObjectMapper mapper) {
        this.url = url.trim(); this.token = token.trim(); this.mapper = mapper;
    }
    public boolean configured() { return !url.isBlank(); }

    public List<Entry> fetch() throws Exception {
        if (!configured()) throw new IllegalStateException("SYNCH endpoint is not configured");
        URI uri = URI.create(url);
        if (!"https".equalsIgnoreCase(uri.getScheme())
                && !("http".equalsIgnoreCase(uri.getScheme()) &&
                     ("localhost".equalsIgnoreCase(uri.getHost()) || "127.0.0.1".equals(uri.getHost())))) {
            throw new IllegalStateException("SYNCH URL must use HTTPS (HTTP allowed only on localhost)");
        }
        var builder = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8))
                .GET().header("Accept", "application/json");
        if (!token.isBlank()) builder.header("Authorization", "Bearer " + token);
        var response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) throw new IllegalStateException("SYNCH HTTP " + response.statusCode());
        JsonNode root = mapper.readTree(response.body());
        JsonNode items = root.isArray() ? root : root.path("items");
        if (!items.isArray()) items = root.path("pickupPoints");
        if (!items.isArray()) items = root.path("data");
        if (!items.isArray()) throw new IllegalStateException("SYNCH JSON does not contain a pick-up point array");
        if (items.isEmpty()) throw new IllegalStateException("SYNCH returned no pick-up points; preserving cache");
        List<Entry> result = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (JsonNode item : items) {
            String id = text(item, "synchId", "pickupPointId", "id", "code");
            String name = text(item, "name", "pickupPointName", "displayName");
            if (id.isBlank() || name.isBlank() || id.length() > 120 || name.length() > 255 || !ids.add(id)) {
                throw new IllegalStateException("SYNCH contains missing, invalid or duplicate pick-up point IDs/names");
            }
            String email = text(item, "contactEmail", "email");
            if (!email.isBlank() && (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$") || email.length() > 255)) {
                email = ""; // do not send to invalid contacts
            }
            result.add(new Entry(id, name, clip(text(item, "province"), 120),
                    clip(text(item, "district", "municipality"), 120),
                    clip(text(item, "area", "suburb", "locality"), 150),
                    clip(text(item, "address", "physicalAddress"), 500), email,
                    !item.has("active") || item.path("active").asBoolean(true)));
        }
        return List.copyOf(result);
    }
    private static String clip(String s, int max) { return s.length() > max ? s.substring(0, max) : s; }
    private static String text(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode value = node.path(key);
            if (value.isTextual() || value.isNumber()) {
                String text = value.asText().trim();
                if (!text.isBlank()) return text;
            }
        }
        return "";
    }
    public record Entry(String id, String name, String province, String district, String area,
                        String address, String email, boolean active) {}
}
