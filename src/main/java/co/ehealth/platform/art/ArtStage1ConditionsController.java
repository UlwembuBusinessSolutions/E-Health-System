package co.ehealth.platform.art;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class ArtStage1ConditionsController {
    private final ArtStage1ConditionsService service;
    private final StaffService staffService;
    public ArtStage1ConditionsController(ArtStage1ConditionsService service, StaffService staffService) { this.service = service; this.staffService = staffService; }

    @GetMapping("/api/v1/visits/{visitId}/art-stage-1-conditions")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }
    @PutMapping("/api/v1/visits/{visitId}/art-stage-1-conditions")
    public ResponseEntity<Map<String, Object>> save(@PathVariable UUID visitId, @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request, staff.userId())));
    }
    private Map<String, Object> toResponse(ArtStage1Conditions d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", d.getId()); m.put("visitId", d.getVisitId());
        m.put("persistentGeneralizedLymphadenopathy", d.getPersistentGeneralizedLymphadenopathy());
        m.put("stage1Other", d.getStage1Other()); m.put("stage1OtherSpecify", d.getStage1OtherSpecify());
        m.put("stage2WeightLossUnder10Percent", d.getStage2WeightLossUnder10Percent()); m.put("stage2MinorMucocutaneousConditions", d.getStage2MinorMucocutaneousConditions());
        m.put("stage2RecurrentUrti", d.getStage2RecurrentUrti()); m.put("stage2Other", d.getStage2Other()); m.put("stage2OtherSpecify", d.getStage2OtherSpecify());
        m.put("stage3WeightLossOver10Percent", d.getStage3WeightLossOver10Percent()); m.put("stage3DiarrhoeaOverOneMonth", d.getStage3DiarrhoeaOverOneMonth());
        m.put("stage3OralCandidiasis", d.getStage3OralCandidiasis()); m.put("stage3SevereBacterialInfections", d.getStage3SevereBacterialInfections());
        m.put("stage3OralHairyLeukoplakia", d.getStage3OralHairyLeukoplakia()); m.put("stage3ProlongedFever", d.getStage3ProlongedFever());
        m.put("stage3BedriddenUnder50Percent", d.getStage3BedriddenUnder50Percent()); m.put("stage3PulmonaryTb", d.getStage3PulmonaryTb());
        m.put("stage3Other", d.getStage3Other()); m.put("stage3OtherSpecify", d.getStage3OtherSpecify());
        m.put("stage4HerpesSimplexOverOneMonth", d.getStage4HerpesSimplexOverOneMonth()); m.put("stage4OesophagealCandidiasis", d.getStage4OesophagealCandidiasis());
        m.put("stage4PneumocystisJiroveci", d.getStage4PneumocystisJiroveci()); m.put("stage4KaposisSarcoma", d.getStage4KaposisSarcoma());
        m.put("stage4HivWastingSyndrome", d.getStage4HivWastingSyndrome()); m.put("stage4HivEncephalopathy", d.getStage4HivEncephalopathy());
        m.put("stage4RecurrentPneumonia", d.getStage4RecurrentPneumonia()); m.put("stage4Cytomegalovirus", d.getStage4Cytomegalovirus());
        m.put("stage4IsosporiasisCryptosporidiosis", d.getStage4IsosporiasisCryptosporidiosis()); m.put("stage4BedriddenOver50Percent", d.getStage4BedriddenOver50Percent());
        m.put("stage4CryptococcalMeningitis", d.getStage4CryptococcalMeningitis()); m.put("stage4CervicalCancer", d.getStage4CervicalCancer());
        m.put("stage4Lymphoma", d.getStage4Lymphoma()); m.put("stage4ExtraPulmonaryTb", d.getStage4ExtraPulmonaryTb()); m.put("cd4Result", d.getCd4Result());
        m.put("updatedByUserId", d.getUpdatedByUserId()); m.put("updatedByName", staffService.resolveUserNames(Set.of(d.getUpdatedByUserId())).get(d.getUpdatedByUserId()));
        m.put("createdAt", d.getCreatedAt()); m.put("updatedAt", d.getUpdatedAt());
        return m;
    }
    public record ItemResponse(Map<String, Object> item) {}
    public record SaveRequest(Boolean persistentGeneralizedLymphadenopathy, Boolean stage1Other, @Size(max=10000) String stage1OtherSpecify,
        Boolean stage2WeightLossUnder10Percent, Boolean stage2MinorMucocutaneousConditions, Boolean stage2RecurrentUrti,
        Boolean stage2Other, @Size(max=10000) String stage2OtherSpecify, Boolean stage3WeightLossOver10Percent,
        Boolean stage3DiarrhoeaOverOneMonth, Boolean stage3OralCandidiasis, Boolean stage3SevereBacterialInfections,
        Boolean stage3OralHairyLeukoplakia, Boolean stage3ProlongedFever, Boolean stage3BedriddenUnder50Percent,
        Boolean stage3PulmonaryTb, Boolean stage3Other, @Size(max=10000) String stage3OtherSpecify,
        Boolean stage4HerpesSimplexOverOneMonth, Boolean stage4OesophagealCandidiasis, Boolean stage4PneumocystisJiroveci,
        Boolean stage4KaposisSarcoma, Boolean stage4HivWastingSyndrome, Boolean stage4HivEncephalopathy,
        Boolean stage4RecurrentPneumonia, Boolean stage4Cytomegalovirus, Boolean stage4IsosporiasisCryptosporidiosis,
        Boolean stage4BedriddenOver50Percent, Boolean stage4CryptococcalMeningitis, Boolean stage4CervicalCancer,
        Boolean stage4Lymphoma, Boolean stage4ExtraPulmonaryTb, @Size(max=10000) String cd4Result) {}
}
