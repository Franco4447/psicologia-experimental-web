# TEST_INFRA: E2E Testing Track Infrastructure & Quality Gates

**Proyecto**: Plataforma Web de Psicología Experimental - Creación de Falsos Recuerdos y Creencias  
**Institución**: Universidad Favaloro (Facultad de Psicología)  
**Track**: E2E Quality Assurance & Opaque-Box Verification Harness  
**Authoritative Specifications**: `ORIGINAL_REQUEST.md`, `PROJECT.md`, `Feedback_Diseño_Experimental.md`, `NOTICIAS TRADUCIDAS.docx`

---

## 1. Testing Philosophy & Core Principles

The testing harness of the Universidad Favaloro Experimental Psychology Web Platform is built upon strict scientific and software engineering principles:

1. **Opaque-Box & Requirement-Driven Testing**: Tests are derived strictly from formal specifications (`ORIGINAL_REQUEST.md`, `PROJECT.md`) and empirical psychological literature (León et al., 2023; Murphy et al., 2021; Martel et al., 2020; Pennycook & Rand, 2021; Johnson et al., 1993). The harness treats the system under test (SUT) as an opaque box, validating external behaviors, inputs, outputs, state transitions, HTTP contracts, and data persistence guarantees without coupling to internal component implementations.
2. **Progressive Testability**: Each milestone's contracts are testable independently. The test harness provides standalone simulation oracles and executable contracts so that tests can execute deterministically in CI/CD before, during, and after full UI and database wiring.
3. **No Facade / Zero False-Positive Policy**: Tests must execute actual assertions against concrete inputs and derived expected outputs. No stub tests that unconditionally pass (`assert(true)`) are permitted.
4. **Data Isolation & Hermetic State**: Every test case initializes its own state, generates unique UUIDs for participant sessions, avoids cross-test contamination, and cleans up artifacts.
5. **Adversarial & Edge Verification**: Beyond the happy path, tests vigorously probe boundary conditions, non-standard user actions (e.g. back navigation, double-clicking, sub-second clicks, network disconnects), and malicious input sanitization.

---

## 2. Test Architecture

The E2E test harness is structured in modular TypeScript components located under `tests/e2e/`:

```
web-experimento/
├── TEST_INFRA.md                 # Test architecture & methodology specification
├── TEST_READY.md                 # Execution readiness certificate & test manifest
├── package.json                  # Scripts to execute test suites
└── tests/
    └── e2e/
        ├── harness/
        │   ├── types.ts              # Canonical domain contracts (Session, Trial, Demographics, etc.)
        │   ├── stimulusOracle.ts     # Authoritative stimuli dictionary (28 news, assets, labels)
        │   ├── balanceOracle.ts      # Statistical balancing oracle & concurrency stress engine
        │   ├── experimentEngine.ts   # Deterministic participant state machine & business logic
        │   ├── csvValidator.ts       # RFC 4180 + UTF-8 BOM parser & column contract validator
        │   └── simulatedUser.ts      # Headless participant actor simulating realistic human behavior
        ├── tier1_features.test.ts    # 95+ Feature assertions across 19 canonical features (>=5 per feature)
        ├── tier2_boundaries.test.ts  # Edge cases, boundaries, network failure & out-of-order defense
        ├── tier3_combinations.test.ts# Pairwise permutations (Orientation x Student x Induction x Responses)
        ├── tier4_simulations.test.ts # Full end-to-end multi-participant simulation runs (>=5 runs)
        └── run_all_tests.ts          # Unified execution runner & formatted reporter
```

---

## 3. The 4 Verification Tiers & Quality Thresholds

### Tier 1: Feature Coverage (Unit & Contract Invariants)
- **Target**: 19 Features identified in `PROJECT.md` Feature Inventory.
- **Threshold**: $\ge 5$ explicit assertions per feature $\rightarrow$ minimum 95 assertions.
- **Features Covered**:
  1. Welcome & Presentation Screen
  2. Mandatory Informed Consent
  3. Demographics Collection Form
  4. Inclusion / Exclusion Logic
  5. Balanced Group Allocation ($\Delta \le 1$ serial, $\le 2$ concurrent)
  6. Excluded Participant Routing (invisible Control prompt, random set, no quota skew)
  7. Ideological Congruence Engine (exact 8 fake news mapped to psychoanalysis vs evidence-based)
  8. Cognitive Induction Priming Screen (verbatim texts for Racional, Emocional, Control)
  9. 20-Trial Stimulus Randomizer (12 true + 8 fake, Fisher-Yates shuffle)
  10. 10s Stimulus Exposure Display (countdown progress, no premature advance)
  11. Asset Extension Resolver (`Noticia_26.png`, 27 `.jpg` files, non-empty)
  12. 4-Point Response Scale (Murphy/León scale, mutually exclusive)
  13. Millisecond Latency Tracking (RT and reading time precision)
  14. Ethical Debriefing (Dehoaxing & academic disclosure)
  15. Thank You & Confirmation Screen
  16. Client Telemetry Capture (device, resolution, user agent)
  17. Supabase Data Persistence (DDL adherence, relational integrity, retry buffer)
  18. Protected Admin Dashboard (route protection, summary counts, balance alerts)
  19. CSV Export Engine (Long format, 20 rows/participant, UTF-8 BOM, 23 columns)

### Tier 2: Boundary & Corner Cases
- **Target**: Boundary values, edge conditions, network disruptions, input sanitization.
- **Threshold**: $\ge 5$ assertions per critical domain:
  - **Age Limits**: Under 18 rejected ($<18$), exactly 18 accepted, realistic upper bound (99), non-numeric or negative values rejected.
  - **Input Sanitization**: Empty university field, Unicode/accents (`Universidad Favaloro (CABA)`), special symbols.
  - **Consent Enforcement**: Unchecked box disables progression, re-enables dynamically upon click.
  - **Timing & Latency**: Reading time minimums, negative RT rejection, long reading handling.
  - **Network Resilience**: Simulated offline drop during trial 15, local storage buffer persistence, auto-sync upon reconnect, idempotent deduplication.
  - **Anti-Tampering / State Machine**: Preventing direct jump to trial 20 without completing earlier trials, preventing double submission of final response.

### Tier 3: Cross-Feature Combinations (Pairwise Permutations)
- **Target**: Systematic validation of the $3 \times 2 \times 3$ factor matrix:
  - Orientation (Psicoanálisis, Basada en Evidencia, Otros)
  - Psychology Student (true, false)
  - Induction Group (racional, emocional, control)
- **Invariants Validated**:
  - Psychoanalysis + Student $\rightarrow$ Included $\rightarrow$ Fake News Set 1 (IDs: 14, 16, 18, 20, 21, 23, 25, 27).
  - Evidence-Based + Student $\rightarrow$ Included $\rightarrow$ Fake News Set 2 (IDs: 13, 15, 17, 19, 22, 24, 26, 28).
  - Any Non-Student or "Otros" $\rightarrow$ Excluded (`is_included = false`) $\rightarrow$ Forced Control group $\rightarrow$ Unbiased fake news set $\rightarrow$ No quota skew.
  - Response codes 1-4 mapped to binary flags:
    - Code 1 on Fake $\rightarrow$ `is_false_memory = true`, `is_false_belief = false`.
    - Code 2 on Fake $\rightarrow$ `is_false_memory = false`, `is_false_belief = true`.
    - Code 3 or 4 on Fake $\rightarrow$ both flags false.
    - Any code on True News $\rightarrow$ both flags false (true news cannot produce false memory/belief of fake news).

### Tier 4: Real-World Application Scenarios
- **Target**: Full end-to-end human participant simulations.
- **Threshold**: $\ge 5$ distinct end-to-end user journeys:
  1. *Scenario 1 (Included Psychoanalysis)*: Student in Emotional induction, completes 20 trials, reports false memories, verifies DB & CSV.
  2. *Scenario 2 (Included Evidence-Based)*: Student in Rational induction, verifies congruent stimuli, high deliberative response times.
  3. *Scenario 3 (Included Control Group)*: Student in Control induction, neutral prompt, mixed response patterns.
  4. *Scenario 4 (Excluded Participant)*: Medical student (non-psychology), transparently guided through Control flow, marked `is_included = false`.
  5. *Scenario 5 (Network Interruption & Recovery)*: Participant loses connection at trial 12, answers trials 13-17 offline, connection restores at trial 18, final debrief successfully flushes all 20 trials.
  6. *Scenario 6 (Mass Allocation Stress Test)*: 60 sequential and concurrent participants simulated; asserts maximum group difference $\le 2$ at all times.

---

## 4. Test Execution Instructions

### Running All Test Suites
```bash
npm test
# or
npm run test:e2e
# or
node --experimental-strip-types tests/e2e/run_all_tests.ts
```

### Running Individual Tiers
```bash
npm run test:tier1   # Tier 1 Feature Coverage (95+ assertions)
npm run test:tier2   # Tier 2 Boundary & Corner Cases
npm run test:tier3   # Tier 3 Cross-Feature Permutations
npm run test:tier4   # Tier 4 Real-World E2E Simulations
```

### Exit Codes & CI/CD Integration
- **Code 0**: All assertions passed; 0 failures.
- **Code 1**: One or more assertions failed. Detailed error trace, file location, expected vs actual values printed to stdout/stderr.
