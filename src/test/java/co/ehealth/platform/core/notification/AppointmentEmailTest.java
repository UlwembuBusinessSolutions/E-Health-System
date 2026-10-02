package co.ehealth.platform.core.notification;

import co.ehealth.platform.core.tenant.OrganizationMailSettingsService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AppointmentEmailTest {
    @TempDir Path captureDir;

    @Test void confirmationContainsScheduleEscapesHtmlAndOmitsInternalNotes() throws Exception {
        EmailDeliveryWorker delivery = mock(EmailDeliveryWorker.class);
        OrganizationMailSettingsService settings = mock(OrganizationMailSettingsService.class);
        when(settings.resolveForCurrentTenant()).thenReturn(Optional.empty());
        EmailService emails = new EmailService(delivery, settings, "clinic@example.invalid", "http://localhost:5173",
                captureDir.toString(), Clock.systemUTC());

        emails.sendAppointmentConfirmedEmail("patient@example.invalid", "Test <patient>", "Test Organization",
                "Clinic & Partners", "Sunday, 10 January 2027", "09:30 (Africa/Johannesburg, UTC+02:00)", "Dr Example");

        ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class), html = ArgumentCaptor.forClass(String.class);
        verify(delivery).deliver(eq("patient@example.invalid"), eq("Your appointment is confirmed — Test Organization"),
                text.capture(), html.capture(), eq("clinic@example.invalid"), isNull());
        assertTrue(text.getValue().contains("Date: Sunday, 10 January 2027"));
        assertTrue(text.getValue().contains("Time: 09:30 (Africa/Johannesburg, UTC+02:00)"));
        assertTrue(text.getValue().contains("With: Dr Example"));
        assertFalse(text.getValue().contains("Notes:"));
        assertTrue(html.getValue().contains("Test &lt;patient&gt;"));
        assertTrue(html.getValue().contains("Clinic &amp; Partners"));
        try (var files = Files.list(captureDir)) {
            String captured = Files.readString(files.findFirst().orElseThrow());
            assertTrue(captured.contains("patient@example.invalid"));
            assertTrue(captured.contains("Sunday, 10 January 2027"));
        }

        emails.sendAppointmentUpdatedEmail("patient@example.invalid", "Test", "Test Organization",
                "Clinic A", "Monday, 11 January 2027", "10:30 (Africa/Johannesburg, UTC+02:00)", null);
        verify(delivery).deliver(eq("patient@example.invalid"), eq("Your appointment has been updated — Test Organization"),
                contains("has been updated"), contains("Your appointment has been updated"), eq("clinic@example.invalid"), isNull());
    }
}
