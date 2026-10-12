package co.ehealth.platform.pharmacy.register;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

// Who can be asked to witness a Schedule 6 entry at a facility: active
// pharmacy staff other than the person asking, since a witness must be a
// second person. Exposes only an id and a display name.
@Service
public class RegisterWitnessDirectory {

    public record WitnessOption(UUID id, String name) {
    }

    private final RegisterWitnessRepository witnessRepository;

    public RegisterWitnessDirectory(RegisterWitnessRepository witnessRepository) {
        this.witnessRepository = witnessRepository;
    }

    @Transactional(readOnly = true)
    public List<WitnessOption> witnessesFor(UUID facilityId, UUID actorUserId) {
        return witnessRepository.findPharmacyStaff(facilityId, actorUserId).stream()
                .map(row -> new WitnessOption(row.getId(), row.getFirstName() + " " + row.getLastName()))
                .toList();
    }
}
