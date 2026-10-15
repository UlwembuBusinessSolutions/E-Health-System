package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.common.GlobalExceptionHandler;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.*;
import org.junit.jupiter.api.*;
import org.springframework.http.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StockControlControllerTest {
    final PharmacyStockControlService service = mock(PharmacyStockControlService.class);
    final PermissionService permissions = mock(PermissionService.class);
    final UserRepository users = mock(UserRepository.class);
    final UUID facility = UUID.randomUUID(), product = UUID.randomUUID(), account = UUID.randomUUID(), actor = UUID.randomUUID();
    MockMvc mvc;
    @BeforeEach void setup() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(actor, "test"), null));
        var user = mock(User.class); when(user.getFirstName()).thenReturn("Test"); when(user.getLastName()).thenReturn("Counter");
        when(users.findById(actor)).thenReturn(Optional.of(user));
        mvc = MockMvcBuilders.standaloneSetup(new PharmacyStockControlController(service,
                mock(PharmacyStockAccountRepository.class), mock(PharmacyBatchRepository.class),
                mock(PharmacyStockQueryService.class), permissions, users))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    String body(String count, String reason) {
        return "{\"facilityId\":\"" + facility + "\",\"productId\":\"" + product + "\",\"accountId\":\"" + account
                + "\",\"expectedQuantity\":10,\"countedQuantity\":" + count + ",\"reason\":\"" + reason + "\"}";
    }
    @Test void rejectsMissingNegativeFractionalAndOversizedCounts() throws Exception {
        for (String count : List.of("null", "-1", "1.5", "9223372036854775808")) {
            mvc.perform(post("/api/v1/pharmacy/stock/counts").header("Idempotency-Key", UUID.randomUUID())
                    .contentType(MediaType.APPLICATION_JSON).content(body(count, "Count"))).andExpect(status().isBadRequest());
        }
        mvc.perform(post("/api/v1/pharmacy/stock/counts").header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content(body("1", ""))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/pharmacy/stock/counts").contentType(MediaType.APPLICATION_JSON)
                .content(body("1", "Count"))).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void viewOnlyStaffCannotAdjustStock() throws Exception {
        doThrow(new NotAuthorizedException(ModuleCode.PHRM, PermissionLevel.MANAGE)).when(permissions)
                .requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        mvc.perform(post("/api/v1/pharmacy/stock/counts").header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content(body("1", "Count"))).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void staleCountReturnsActionableConflict() throws Exception {
        when(service.count(any(), any(), any(), any())).thenThrow(new ResponseStatusException(HttpStatus.CONFLICT, "Refresh and recount."));
        mvc.perform(post("/api/v1/pharmacy/stock/counts").header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON).content(body("1", "Count"))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Refresh and recount."));
    }
    @Test void reorderLevelsMustBeWholeAndNonNegative() throws Exception {
        for (String value : List.of("-1", "1.5", "2147483648")) {
            mvc.perform(patch("/api/v1/pharmacy/stock/reorder-level").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"facilityId\":\"" + facility + "\",\"productId\":\"" + product + "\",\"reorderThreshold\":" + value + "}"))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
}
