# Pattern System Standards

## Purpose

The Pattern System Standards define how every Knit It Now pattern system is designed, developed, tested, and maintained.

The goal is simple:

> Every pattern should produce accurate, repeatable results before a knitter ever sees it.

These standards eliminate guesswork, reduce regressions, and ensure every pattern system behaves consistently across the site.

---

# Core Principles

## Test the math, not the written pattern.

The written instructions are generated from calculated values.

If the calculations are correct, the written pattern will be correct.

Focus testing on:

- stitch counts
- row counts
- shaping calculations
- construction logic
- validation rules

instead of manually checking finished pattern text.

---

## Every bug becomes a permanent test.

Whenever a bug is discovered:

1. Reproduce it in an automated test.
2. Fix the underlying code.
3. Verify the test passes.
4. Keep the test permanently.

This prevents the same issue from returning later.

---

## One responsibility per module.

Pattern systems should be built from small, focused modules rather than one large file.

Typical components include:

- Pattern builder
- Pattern calculations
- Validation
- Rendering
- Workspace editing
- Save/load
- Pattern generation
- Tests

Each module should have a single responsibility.

---

# Pattern System Structure

Although every pattern may differ slightly, a complete pattern system will typically include:

```
src/lib/patterns/{pattern}/

patternMath.ts
patternValidation.ts
patternRenderer.ts
patternWorkspace.ts
patternSave.ts
patternMath.test.ts
patternValidation.test.ts
```

Supporting files may include:

- builder workflows
- UI helpers
- edit drawer logic
- summary generators
- measurement helpers
- image helpers

---

# The Pattern Calculator

The calculator is responsible for converting user inputs into knitting values.

Inputs may include:

- gauge
- measurements
- size
- style
- fit
- options

Outputs include:

- stitch counts
- row counts
- shaping schedules
- bind-off locations
- sleeve calculations
- neckline calculations

The calculator should contain no UI code.

---

# Validation

Validation confirms the calculated values are internally consistent.

Examples include:

- stitch counts greater than zero
- row counts greater than zero
- crown depth does not exceed total rows
- neckline shaping fits within body length
- shaping never produces negative stitches
- decreases never exceed available stitches
- measurements remain within acceptable limits

Validation protects against impossible or broken patterns.

---

# Automated Tests

Every pattern system should include automated tests.

Tests should verify:

- calculations
- validation
- edge cases
- previously fixed bugs

---

## 1. Known Scenarios

Known scenarios use fixed inputs with expected outputs.

Example:

```
Gauge:
5 stitches/inch

Size:
Medium

Expected cast on:
180 stitches

Expected total rows:
260
```

These become the answer key for future development.

---

## 2. Validation Tests

Validation tests verify rules instead of exact numbers.

Examples:

- stitch count is positive
- row count is positive
- neckline rows fit within body rows
- sleeve decreases never exceed sleeve length

---

## 3. Regression Tests

Whenever a bug is fixed, create a test that reproduces it.

Examples:

- cardigan front width incorrect
- V-neck shaping error
- sleeve override issue
- stale workspace values
- edit drawer refresh bug

Regression tests ensure solved problems remain solved.

---

## 4. Randomized Tests (Fuzz Testing)

Randomized tests generate many combinations automatically.

Examples include random:

- gauges
- sizes
- sleeve lengths
- measurements
- ease values

The goal is not to verify exact numbers.

The goal is to verify that calculations remain stable and never fail unexpectedly.

---

# Development Workflow

Whenever a pattern system changes:

1. Modify the calculation or feature.
2. Update or add automated tests.
3. Run the relevant test suite.
4. Fix any failures.
5. Test the workflow in the browser.
6. Test all access levels.
7. Push to the development environment.
8. Perform real-world testing before production.

---

# Browser Testing Checklist

Every significant pattern change should be tested as:

- Guest
- Logged in (no subscription)
- Member
- Beta member (when applicable)

Verify:

- builder
- save
- edit
- workspace
- library
- PDF generation
- gating
- pattern regeneration

---

# Before Every Release

Before releasing a pattern system:

- All automated tests pass.
- No validation failures.
- Browser workflow verified.
- Save and edit confirmed.
- PDF generated successfully.
- Gating behaves correctly.
- Existing regression tests pass.

---

# Goal

Before a machine knitter creates a pattern:

- the calculations have been tested
- validation rules have been checked
- edge cases have been explored
- previous bugs remain fixed
- the workflow has been verified

The knitter should never become the first tester of the math.