package co.ehealth.platform.diagnosis;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

// Finds diagnoses as the clinician types and keeps the catalogue growing: a diagnosis that is not there
// yet is added the moment it is recorded, so nothing typed is ever left as free text that cannot be counted.
@Service
public class DiagnosisCatalogueService {

    static final int MAX_RESULTS = 15;
    static final int MIN_QUERY_LENGTH = 2;

    private final DiagnosisRepository repository;
    private final Clock clock;

    public DiagnosisCatalogueService(DiagnosisRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Diagnosis> search(String query) {
        String text = Diagnosis.keyOf(query).replaceAll("[%_\\\\]", "");
        if (text.length() < MIN_QUERY_LENGTH) {
            return List.of();
        }
        return repository.search("%" + text + "%", text + "%", text.toLowerCase(Locale.ROOT) + "%", text, MAX_RESULTS);
    }

    @Transactional(readOnly = true)
    public Optional<Diagnosis> find(UUID id) {
        return repository.findById(id);
    }

    /**
     * The catalogue entry for a diagnosis typed by name: the existing one if the name matches (ignoring
     * case and spacing), otherwise a new CUSTOM entry. Two doctors typing the same new name get one entry.
     */
    @Transactional
    public Diagnosis findOrAdd(String name, UUID staffUserId) {
        String key = Diagnosis.keyOf(name);
        return repository.findByNameKey(key)
                .orElseGet(() -> repository.save(Diagnosis.custom(name, staffUserId, clock.instant())));
    }

    @Transactional(readOnly = true)
    public List<DiagnosisRepository.Count> counts(Instant from, Instant to) {
        return repository.countsBetween(from, to);
    }
}
