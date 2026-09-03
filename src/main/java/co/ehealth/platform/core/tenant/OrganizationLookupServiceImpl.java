package co.ehealth.platform.core.tenant;

import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
class OrganizationLookupServiceImpl implements OrganizationLookupService {

    private final OrganizationRepository organizationRepository;

    OrganizationLookupServiceImpl(OrganizationRepository organizationRepository) {
        this.organizationRepository = organizationRepository;
    }

    @Override
    public Optional<Organization> findActiveBySlug(String slug) {
        return organizationRepository.findBySlugAndStatus(slug, OrganizationStatus.ACTIVE);
    }

    @Override
    public Optional<Organization> findBySlug(String slug) {
        return organizationRepository.findBySlug(slug);
    }
}
