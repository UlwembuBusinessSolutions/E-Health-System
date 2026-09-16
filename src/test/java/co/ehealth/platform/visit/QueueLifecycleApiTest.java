package co.ehealth.platform.visit;

import co.ehealth.platform.core.common.GlobalExceptionHandler;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class QueueLifecycleApiTest {
    @ParameterizedTest
    @ValueSource(strings = {
            "{\"action\":\"CANCEL\"}",
            "{\"action\":\"CANCEL\",\"reasonCode\":null}",
            "{\"action\":\"CANCEL\",\"reasonCode\":\"\"}",
            "{\"action\":\"CANCEL\",\"reasonCode\":\"UNKNOWN\"}",
            "{\"action\":\"UNKNOWN\"}",
            "{}"
    })
    void rejectsInvalidRequestsBeforeMutation(String body) throws Exception {
        QueueService service = mock(QueueService.class);
        MockMvcBuilders.standaloneSetup(new QueueController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build()
                .perform(post("/api/v1/queue/tokens/075dc3f7-afc0-4769-b8a4-ab817e9fa8f1/transition")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
