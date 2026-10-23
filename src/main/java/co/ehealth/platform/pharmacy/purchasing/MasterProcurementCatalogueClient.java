package co.ehealth.platform.pharmacy.purchasing;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.UUID;

/** Adapter for a tenant-approved MPC HTTP gateway; endpoint and credentials must be supplied externally. */
@Component
public class MasterProcurementCatalogueClient {
    private final String ordersUrl;
    private final String apiKey;
    private final RestClient client;

    public record CatalogueLine(String productCode, int packs, int packSize, int quantity) { }
    public record CatalogueOrder(String orderNumber, UUID facilityId, UUID supplierId,
                                 List<CatalogueLine> lines) { }
    public record CatalogueAcknowledgement(String reference, String status) { }

    public MasterProcurementCatalogueClient(
            @Value("${pharmacy.procurement.orders-url:}") String ordersUrl,
            @Value("${pharmacy.procurement.api-key:}") String apiKey,
            RestClient.Builder restClientBuilder) {
        this.ordersUrl = ordersUrl;
        this.apiKey = apiKey;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(10000);
        this.client = restClientBuilder.requestFactory(requestFactory).build();
    }

    public boolean isConfigured() {
        return ordersUrl != null && ordersUrl.startsWith("https://")
                && apiKey != null && !apiKey.isBlank();
    }

    public String transmit(CatalogueOrder order) {
        if (ordersUrl == null || ordersUrl.isBlank() || !ordersUrl.startsWith("https://")) {
            throw new IllegalStateException("Master Procurement Catalogue HTTPS orders URL is not configured");
        }
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("Master Procurement Catalogue credentials are not configured");
        }
        try {
            CatalogueAcknowledgement ack = client.post().uri(ordersUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                    .header("Idempotency-Key", order.orderNumber())
                    .body(order)
                    .retrieve().body(CatalogueAcknowledgement.class);
            if (ack == null || ack.reference() == null || ack.reference().isBlank()
                    || !"ACCEPTED".equalsIgnoreCase(ack.status())) {
                throw new IllegalStateException("Catalogue did not acknowledge acceptance of the order");
            }
            return ack.reference();
        } catch (RestClientException error) {
            throw new IllegalStateException("Master Procurement Catalogue transmission failed. Retry after checking the gateway.");
        }
    }
}
