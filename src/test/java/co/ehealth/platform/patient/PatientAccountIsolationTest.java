package co.ehealth.platform.patient;

import co.ehealth.platform.identity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class PatientAccountIsolationTest {

    @Test
    void patientPortalCredentialsUseTheirOwnEntityAndTable() {
        assertNotNull(PatientAccount.class.getAnnotation(Entity.class));
        assertEquals("patient_accounts", PatientAccount.class.getAnnotation(Table.class).name());
        assertEquals("users", User.class.getAnnotation(Table.class).name());
        assertFalse(User.class.isAssignableFrom(PatientAccount.class));
        assertNotSame(User.class, PatientAccount.class);
    }

    @Test
    void patientAccountKeepsIdNumberAndMpiLinkAsSeparateFields() throws Exception {
        Column idNumber = PatientAccount.class.getDeclaredField("idNumber").getAnnotation(Column.class);
        Column patientId = PatientAccount.class.getDeclaredField("patientId").getAnnotation(Column.class);

        assertEquals("id_number", idNumber.name());
        assertEquals(13, idNumber.length());
        assertEquals("patient_id", patientId.name());
    }
}
