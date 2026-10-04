package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Scheduled medicines register — contract section 3 (B4). PHRM:VIEW reads,
// PHRM:MANAGE writes.
@RestController
@RequestMapping("/api/v1/pharmacy/schedule-register")
public class ScheduleRegisterController {

    private final ScheduleRegisterService registerService;
    private final ScheduleRegisterQueryService queryService;
    private final ScheduleDayCloseService dayCloseService;
    private final RegisterProductListService productListService;
    private final RegisterWitnessDirectory witnessDirectory;
    private final FacilityBusinessDay businessDay;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public ScheduleRegisterController(ScheduleRegisterService registerService,
                                      ScheduleRegisterQueryService queryService,
                                      RegisterProductListService productListService,
                                      RegisterWitnessDirectory witnessDirectory,
                                      ScheduleDayCloseService dayCloseService, FacilityBusinessDay businessDay,
                                      PermissionService permissionService, UserRepository userRepository) {
        this.registerService = registerService;
        this.queryService = queryService;
        this.productListService = productListService;
        this.witnessDirectory = witnessDirectory;
        this.dayCloseService = dayCloseService;
        this.businessDay = businessDay;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ScheduleRegisterPageResponse list(@RequestParam UUID facilityId,
                                             @RequestParam(required = false) UUID productId,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return queryService.list(facilityId, productId, page, size);
    }

    @GetMapping("/products")
    public ProductsResponse products(@RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return new ProductsResponse(productListService.productsAt(facilityId));
    }

    // Excludes the signed-in user: a witness has to be a second person.
    @GetMapping("/witnesses")
    public WitnessesResponse witnesses(@RequestParam UUID facilityId,
                                       @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return new WitnessesResponse(witnessDirectory.witnessesFor(facilityId, principal.userId()));
    }

    @PostMapping("/entries")
    public ResponseEntity<RegisterEntryResponse> addEntry(@Valid @RequestBody NewEntryRequest request,
                                                          @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = actorOf(principal);
        var command = new ScheduleRegisterService.NewEntryCommand(request.facilityId(), request.productId(),
                request.kind(), request.quantity(), request.rxSerial(), request.patientName(),
                request.patientIdRef(), request.prescriber(), request.prescriberRegNo(), request.lotNumber(),
                request.witnessStaffId(), request.witnessPin(), request.reason());
        ScheduleRegisterEntry entry = registerService.record(command, actor.getId(), nameOf(actor));
        return ResponseEntity.status(HttpStatus.CREATED).body(queryService.entry(entry));
    }

    @GetMapping("/day-close")
    public DayCloseResponse dayCloseCard(@RequestParam UUID facilityId, @RequestParam UUID productId,
                                         @RequestParam(required = false) LocalDate date) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        LocalDate day = date != null ? date : businessDay.today(facilityId);
        return DayCloseResponse.from(dayCloseService.reconciliationFor(facilityId, productId, day));
    }

    @PostMapping("/day-close")
    public ResponseEntity<DayCloseResponse> closeDay(@Valid @RequestBody CloseDayRequest request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = actorOf(principal);
        LocalDate day = request.date() != null ? request.date() : businessDay.today(request.facilityId());
        var command = new ScheduleDayCloseService.CloseCommand(request.facilityId(), request.productId(), day,
                request.countedQuantity(), request.varianceReason());
        var reconciliation = dayCloseService.close(command, actor.getId(), nameOf(actor));
        return ResponseEntity.status(HttpStatus.CREATED).body(DayCloseResponse.from(reconciliation));
    }

    private User actorOf(AuthenticatedPrincipal principal) {
        return userRepository.findById(principal.userId()).orElseThrow();
    }

    private String nameOf(User user) {
        return user.getFirstName() + " " + user.getLastName();
    }

    // witnessPin is the witness's own account password (the identity module
    // has no separate PIN) — WitnessVerifier's why-note.
    public record NewEntryRequest(@NotNull UUID facilityId, @NotNull UUID productId, @NotNull RegisterEntryKind kind,
                                  @Positive long quantity, String rxSerial, String patientName,
                                  String patientIdRef, String prescriber, String prescriberRegNo,
                                  @NotBlank String lotNumber, UUID witnessStaffId, String witnessPin,
                                  @Size(max = 200) String reason) {
    }

    public record ProductsResponse(List<RegisterProductListService.RegisterProduct> items) {
    }

    public record WitnessesResponse(List<RegisterWitnessDirectory.WitnessOption> items) {
    }

    public record CloseDayRequest(@NotNull UUID facilityId, @NotNull UUID productId, LocalDate date,
                                  @PositiveOrZero long countedQuantity, String varianceReason) {
    }
}
