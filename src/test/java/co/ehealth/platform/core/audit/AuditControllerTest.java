package co.ehealth.platform.core.audit;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuditControllerTest {

    @Test
    void listsAuditSnapshotsInDescendingCreatedAtPages() throws Exception {
        AuditLogRepository repository = mock(AuditLogRepository.class);
        MockMvc api = MockMvcBuilders.standaloneSetup(new AuditController(repository)).build();
        AuditLog entry = new AuditLog(UUID.randomUUID(), null, "LOGIN", "User", "user-42", null, null,
                "203.0.113.7", Instant.parse("2026-08-18T09:00:00Z"));
        when(repository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(entry), PageRequest.of(1, 10), 11));

        api.perform(get("/api/v1/audit-snapshots?page=1&size=10").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].action", is("LOGIN")))
                .andExpect(jsonPath("$.content[0].ipAddress", is("203.0.113.7")));

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(pageable.capture());
        assertEquals(1, pageable.getValue().getPageNumber());
        assertEquals(10, pageable.getValue().getPageSize());
        assertTrue(pageable.getValue().getSort().getOrderFor("createdAt").isDescending());
    }

    @Test
    void filtersSnapshotsByEntity() throws Exception {
        AuditLogRepository repository = mock(AuditLogRepository.class);
        MockMvc api = MockMvcBuilders.standaloneSetup(new AuditController(repository)).build();
        when(repository.findByEntityTypeAndEntityId(eq("User"), eq("user-42"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));

        api.perform(get("/api/v1/audit-snapshots/entity/User/user-42"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()", is(0)));
    }

    @Test
    void returnsNotFoundForUnknownSnapshot() throws Exception {
        AuditLogRepository repository = mock(AuditLogRepository.class);
        MockMvc api = MockMvcBuilders.standaloneSetup(new AuditController(repository)).build();
        UUID auditId = UUID.randomUUID();
        when(repository.findById(auditId)).thenReturn(java.util.Optional.empty());

        api.perform(get("/api/v1/audit-snapshots/{auditId}", auditId))
                .andExpect(status().isNotFound());
    }
}
