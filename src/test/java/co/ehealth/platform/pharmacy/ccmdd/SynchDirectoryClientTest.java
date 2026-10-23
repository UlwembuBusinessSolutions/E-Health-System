package co.ehealth.platform.pharmacy.ccmdd;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

import static org.junit.jupiter.api.Assertions.*;

class SynchDirectoryClientTest {
    private HttpServer server;
    @AfterEach void stop() { if (server != null) server.stop(0); }

    private SynchDirectoryClient serve(String body) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/points", exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (var stream = exchange.getResponseBody()) { stream.write(bytes); }
        });
        server.setExecutor(Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "synch-test"); t.setDaemon(true); return t;
        }));
        server.start();
        return new SynchDirectoryClient("http://127.0.0.1:" + server.getAddress().getPort() + "/points",
                "", new ObjectMapper());
    }

    @Test void readsNationalDirectoryWithAreaAndEmail() throws Exception {
        var client = serve("""
                {"items":[{"id":"G100","name":"Clinic Pickup","province":"Gauteng",
                           "district":"Johannesburg","area":"Soweto","contactEmail":"pickup@example.org"}]}
                """);
        var rows = client.fetch();
        assertEquals(1, rows.size());
        assertEquals("G100", rows.getFirst().id());
        assertEquals("Soweto", rows.getFirst().area());
        assertEquals("pickup@example.org", rows.getFirst().email());
    }
    @Test void refusesIncompleteMasterListInsteadOfReplacingCache() throws Exception {
        var client = serve("{\"items\":[{\"id\":\"G100\",\"name\":\"Clinic\"},{\"id\":\"G100\",\"name\":\"Duplicate\"}]}");
        assertThrows(IllegalStateException.class, client::fetch);
    }
    @Test void refusesUnencryptedRemoteDirectory() {
        var client = new SynchDirectoryClient("http://remote.example.org/points", "", new ObjectMapper());
        assertThrows(IllegalStateException.class, client::fetch);
    }
}
