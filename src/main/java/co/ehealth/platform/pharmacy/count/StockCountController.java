package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Stock counts — contract section 3 (B4). Reading needs PHRM:VIEW; every
// change needs PHRM:MANAGE, the same two-tier split as the other pharmacy
// controllers.
@RestController
@RequestMapping("/api/v1/pharmacy/counts")
public class StockCountController {

    private final StockCountService countService;
    private final StockCountRecordingService recordingService;
    private final StockCountPostingService postingService;
    private final StockCountQueryService queryService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public StockCountController(StockCountService countService, StockCountRecordingService recordingService,
                                StockCountPostingService postingService, StockCountQueryService queryService,
                                PermissionService permissionService, UserRepository userRepository) {
        this.countService = countService;
        this.recordingService = recordingService;
        this.postingService = postingService;
        this.queryService = queryService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<StockCountResponse> list(@RequestParam UUID facilityId,
                                         @RequestParam(required = false) CountStatus status) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return queryService.list(facilityId, status);
    }

    @GetMapping("/{countId}")
    public StockCountResponse detail(@PathVariable UUID countId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return queryService.detail(countId);
    }

    @PostMapping
    public ResponseEntity<StockCountResponse> start(@Valid @RequestBody StartCountRequest request,
                                                    @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = actorOf(principal);
        var command = new StockCountService.StartCountCommand(request.facilityId(), request.scope(),
                request.areaLabel(), request.productQuery(), request.blind());
        PharmacyStockCount count = countService.start(command, actor.getId(), nameOf(actor));
        return ResponseEntity.status(HttpStatus.CREATED).body(queryService.detail(count.getId()));
    }

    @PutMapping("/{countId}/lines/{lineId}")
    public StockCountLineResponse recordCount(@PathVariable UUID countId, @PathVariable UUID lineId,
                                              @Valid @RequestBody RecordCountRequest request) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        recordingService.recordCount(countId, lineId, request.countedQuantity());
        return queryService.line(countId, lineId);
    }

    @PutMapping("/{countId}/lines/{lineId}/reason")
    public StockCountLineResponse recordReason(@PathVariable UUID countId, @PathVariable UUID lineId,
                                               @Valid @RequestBody ReasonRequest request) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        recordingService.recordReason(countId, lineId, request.reason());
        return queryService.line(countId, lineId);
    }

    @PostMapping("/{countId}/found-lots")
    public ResponseEntity<StockCountLineResponse> addFoundLot(@PathVariable UUID countId,
                                                              @Valid @RequestBody FoundLotRequest request) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        var command = new StockCountRecordingService.FoundLotCommand(request.productId(), request.lotNumber(),
                request.expiryDate(), request.quantity());
        PharmacyStockCountLine line = recordingService.addFoundLot(countId, command);
        return ResponseEntity.status(HttpStatus.CREATED).body(queryService.line(countId, line.getId()));
    }

    @PostMapping("/{countId}/post")
    public StockCountResponse post(@PathVariable UUID countId,
                                   @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = actorOf(principal);
        postingService.post(countId, actor.getId(), nameOf(actor));
        return queryService.detail(countId);
    }

    @PostMapping("/{countId}/cancel")
    public StockCountResponse cancel(@PathVariable UUID countId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        countService.cancel(countId);
        return queryService.detail(countId);
    }

    private User actorOf(AuthenticatedPrincipal principal) {
        return userRepository.findById(principal.userId()).orElseThrow();
    }

    private String nameOf(User user) {
        return user.getFirstName() + " " + user.getLastName();
    }

    public record StartCountRequest(@NotNull UUID facilityId, @NotNull CountScope scope, String areaLabel,
                                    String productQuery, boolean blind) {
    }

    public record RecordCountRequest(@NotNull @PositiveOrZero Long countedQuantity) {
    }

    public record FoundLotRequest(@NotNull UUID productId, @NotBlank String lotNumber, @NotNull LocalDate expiryDate,
                                  @NotNull Long quantity) {
    }

    public record ReasonRequest(@NotBlank String reason) {
    }
}
