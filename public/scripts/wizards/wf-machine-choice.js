/**
 * Vanilla JS Stepped Wizard Embed
 * Wizard ID: wf-machine-choice
 * 
 * Embed with:
 *   <div id="wizard-wf-machine-choice"></div>
 *   <script type="module" src="/scripts/wizards/wf-machine-choice.js"></script>
 */

(async function() {
  // KBM Brand Colors
  const COLORS = {
    green: "#52682D",
    questionBg: "#F4F6F2",
    selectedBg: "#E9EDE4",
    feedbackBg: "#E5E8E0",
    feedbackBorder: "#52682D",
    iconBg: "#D4DBC7",
    textMuted: "#6b7280"
  };

  // SVG Icons (inline for no dependencies)
  const ICONS = {
    messageCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
    checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>`,
    arrowLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>`,
    arrowRight: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>`,
    rotateCcw: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
    externalLink: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"/></svg>`
  };

  // Machine inventory (new machines we sell)
  const INVENTORY = [
    {
      id: "lk150",
      name: "Silver Reed LK150",
      url: "/machines/lk150",
      control_type: "manual",
      gauge_family: "mid",
      available_new: true,
      ribber_supported: false,
      ribber_available_new: false
    },
    {
      id: "sk280",
      name: "Silver Reed SK280",
      url: "/machines/sk280",
      control_type: "punchcard",
      gauge_family: "standard",
      available_new: true,
      ribber_supported: true,
      ribber_available_new: true
    },
    {
      id: "sk840",
      name: "Silver Reed SK840",
      url: "/machines/sk840",
      control_type: "electronic_standalone",
      gauge_family: "standard",
      available_new: true,
      ribber_supported: true,
      ribber_available_new: true
    },
    {
      id: "sk890",
      name: "Silver Reed SK890",
      url: "/machines/sk890",
      control_type: "electronic_software",
      gauge_family: "standard",
      available_new: true,
      ribber_supported: true,
      ribber_available_new: true
    }
  ];

  // Find mount element
  const mount = document.getElementById("wizard-wf-machine-choice");
  if (!mount) {
    console.error("[Wizard wf-machine-choice] Mount element #wizard-wf-machine-choice not found");
    return;
  }

  // Fetch wizard data
  let data;
  try {
    const response = await fetch("/wizards/wf-machine-choice.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
  } catch (err) {
    console.error("[Wizard wf-machine-choice] Failed to load wizard data:", err);
    mount.innerHTML = `<div style="padding: 2rem; text-align: center; color: #666;">Unable to load wizard. Please refresh the page.</div>`;
    return;
  }

  const { wizardSteps: steps, wizardStartStepId: startStepId } = data;

  // State
  let currentStepId = startStepId;
  let history = [];
  let answers = {};
  let multiSelectTemp = []; // Temporary storage for multi-select step
  let singleSelectTemp = null; // Temporary storage for the current single-select step (before Continue)

  // Helper functions
  function getCurrentStep() {
    return steps.find(s => s.stepId === currentStepId);
  }

  function getCurrentStepIndex() {
    return steps.findIndex(s => s.stepId === currentStepId);
  }

  function getStepByIndex(index) {
    return steps[index] || null;
  }

  // Seed the temp selection for whatever step is now current from any previously saved
  // answer, so navigating forward/back always shows the prior choice highlighted.
  function loadTempForCurrentStep() {
    const step = getCurrentStep();
    multiSelectTemp = [];
    singleSelectTemp = null;
    if (!step) return;
    if (step.answerType === "multi") {
      multiSelectTemp = Array.isArray(answers[step.answerKey]) ? [...answers[step.answerKey]] : [];
    } else if (step.answerType === "single") {
      singleSelectTemp = (answers[step.answerKey] !== undefined) ? answers[step.answerKey] : null;
    }
  }

  // Compute results based on answers
  function computeResults() {
    // Start with all control types
    let eligibleControlTypes = ["manual", "punchcard", "electronic_standalone", "electronic_software"];

    // Apply patterning rules
    const patterning = answers.patterning_expectation;
    if (patterning === "digital_download") {
      eligibleControlTypes = ["electronic_software"];
    } else if (patterning === "automatic_patterning") {
      eligibleControlTypes = eligibleControlTypes.filter(t => t !== "manual");
    }

    // Gauge family output
    const gaugeFamily = answers.gauge_family || "standard";
    const gaugeIsUnknown = gaugeFamily === "unknown";

    // Ribber output
    const ribberNeed = answers.ribber_need;
    const ribberOutput = ribberNeed === "rib_required" ? "Required" : "Optional";

    // Caveats
    const caveats = [];
    const spacePermanence = answers.space_permanence;
    const fabricGoals = answers.fabric_goals || [];
    const buyingReality = answers.buying_reality;

    if (spacePermanence === "pack_away") {
      caveats.push("You'll need to store the machine between sessions. Consider setup and teardown time.");
      if (eligibleControlTypes.includes("electronic_software")) {
        caveats.push("Software-connected machines require computer and cable setup each session.");
      }
    }

    if (fabricGoals.includes("repeat_production")) {
      caveats.push("For repeat production, consider machine durability, consistency, and accessories like row counters.");
    }

    if (fabricGoals.includes("mixed_fabrics")) {
      caveats.push("Mixed fabrics may require more planning for predictable results when switching techniques.");
    }

    // Filter machines from inventory
    const matchingMachines = INVENTORY.filter(machine => {
      // Must be available new
      if (!machine.available_new) return false;

      // Gauge family must match (skip filter if unknown)
      if (!gaugeIsUnknown && machine.gauge_family !== gaugeFamily) return false;

      // Control type must be in eligible list
      if (!eligibleControlTypes.includes(machine.control_type)) return false;

      // Ribber requirements
      if (ribberNeed === "rib_required") {
        if (!machine.ribber_supported) return false;
        if (buyingReality === "new_supported" && !machine.ribber_available_new) return false;
      }

      return true;
    }).slice(0, 4); // Limit to 4 examples

    return {
      eligibleControlTypes,
      gaugeFamily,
      ribberOutput,
      caveats,
      matchingMachines
    };
  }

  // Format control type for display
  function formatControlType(type) {
    const labels = {
      "manual": "Manual",
      "punchcard": "Punchcard",
      "electronic_standalone": "Electronic (Standalone)",
      "electronic_software": "Electronic (Software-Connected)"
    };
    return labels[type] || type;
  }

  // Format gauge family for display
  function formatGaugeFamily(gauge) {
    const labels = {
      "standard": "Standard Gauge",
      "mid": "Mid Gauge",
      "bulky": "Bulky Gauge",
      "unknown": "Not sure yet"
    };
    return labels[gauge] || gauge;
  }

  // Event handlers
  function handleChoiceClick(choiceIndex) {
    const step = getCurrentStep();
    if (!step) return;

    const choice = step.choices[choiceIndex];
    if (!choice) return;

    if (step.answerType === "multi") {
      // Toggle selection for multi-select (highlight only; advance happens on Continue)
      const value = choice.value;
      const idx = multiSelectTemp.indexOf(value);
      if (idx >= 0) {
        multiSelectTemp.splice(idx, 1);
      } else {
        multiSelectTemp.push(value);
      }
      render();
    } else {
      // Single select: highlight only, do NOT auto-advance. Continue advances.
      singleSelectTemp = choice.value;
      render();
    }
  }

  function handleContinue() {
    const step = getCurrentStep();
    if (!step) return;

    // Commit the current step's temp selection into answers (guarded so a disabled
    // Continue can never advance without a selection).
    if (step.answerType === "multi") {
      if (multiSelectTemp.length === 0) return;
      answers[step.answerKey] = [...multiSelectTemp];
    } else if (step.answerType === "single") {
      if (singleSelectTemp === null || singleSelectTemp === undefined) return;
      answers[step.answerKey] = singleSelectTemp;
    }

    history.push(currentStepId);
    const nextIndex = getCurrentStepIndex() + 1;
    if (nextIndex < steps.length) {
      currentStepId = steps[nextIndex].stepId;
    }
    loadTempForCurrentStep();
    render();
  }

  function handleBack() {
    if (history.length > 0) {
      const prevStepId = history.pop();
      currentStepId = prevStepId;

      // Restore the prior answer as the highlighted temp selection.
      loadTempForCurrentStep();

      render();
    }
  }

  function handleRestart() {
    currentStepId = startStepId;
    history = [];
    answers = {};
    multiSelectTemp = [];
    singleSelectTemp = null;
    render();
  }

  // "Contact Sue" recipient. Matches Sue's direct address already used elsewhere on the
  // site (src/pages/reference/clubs.astro, src/pages/help-hub/guided-workshop.astro,
  // src/lib/email/sendCourseReadyNotificationEmail.ts).
  const CONTACT_SUE_EMAIL = "sue@knititnow.com";

  // Build a readable list of the user's selected answers using the wizard's own
  // question text and choice labels. Shared by the on-screen "Your answers" summary
  // and the Contact Sue mailto body, so both always reflect the current wizard state.
  function buildAnswerSummary() {
    const summary = [];
    steps.forEach(step => {
      if (!step.answerKey || step.answerType === "computed") return;
      const raw = answers[step.answerKey];
      if (raw === undefined || raw === null || (Array.isArray(raw) && raw.length === 0)) return;

      const labelFor = (val) => {
        const choice = (step.choices || []).find(c => c.value === val);
        return choice ? choice.label : val;
      };

      const answerText = Array.isArray(raw)
        ? raw.map(labelFor).join(", ")
        : labelFor(raw);

      summary.push({ question: step.thoughtText, answer: answerText });
    });
    return summary;
  }

  // Build the "Contact Sue" mailto href dynamically from the current wizard state.
  // Subject + body are URL-encoded with encodeURIComponent.
  function buildContactMailto() {
    const summary = buildAnswerSummary();
    const subject = "Help choosing a knitting machine";

    const lines = [
      "Hi Sue,",
      "I used the Choose a Knitting Machine guide and would like help choosing a machine.",
      "",
      "Your answers:"
    ];

    if (summary.length > 0) {
      summary.forEach(item => {
        lines.push(`- ${item.question}`);
        lines.push(`  ${item.answer}`);
      });
    } else {
      lines.push("- (no answers recorded)");
    }

    lines.push("");
    lines.push("Thank you!");

    const body = lines.join("\n");
    return `mailto:${CONTACT_SUE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // CSS Styles (injected once)
  function injectStyles() {
    if (document.getElementById("wizard-embed-styles-machine-choice")) return;
    const style = document.createElement("style");
    style.id = "wizard-embed-styles-machine-choice";
    style.textContent = `
      .wizard-well {
        background: ${COLORS.questionBg};
        border: 1px solid #E2E6DC;
        border-radius: 0.75rem;
        padding: 1.75rem;
        font-size: 1.125rem;
      }
      .wizard-orientation {
        font-size: 1rem;
        color: ${COLORS.textMuted};
        margin-bottom: 1.5rem;
        line-height: 1.6;
      }
      .wizard-embed {
        max-width: 42rem;
        margin: 0 auto;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 1.125rem;
      }
      .wizard-embed * {
        box-sizing: border-box;
      }
      .wizard-bubble {
        position: relative;
        border-radius: 1rem;
        border-bottom-left-radius: 0.25rem;
        padding: 1.75rem;
        background: white;
        border: 1px solid #E2E6DC;
      }
      .wizard-bubble-tail {
        position: absolute;
        bottom: -0.5rem;
        left: 1rem;
        width: 1rem;
        height: 1rem;
        background: white;
        border-right: 1px solid #E2E6DC;
        border-bottom: 1px solid #E2E6DC;
        transform: rotate(45deg);
      }
      .wizard-bubble-content {
        display: flex;
        align-items: flex-start;
        gap: 0.875rem;
      }
      .wizard-bubble-icon {
        color: ${COLORS.green};
        flex-shrink: 0;
        margin-top: 0.125rem;
      }
      .wizard-thought {
        font-size: 1.375rem;
        font-weight: 500;
        line-height: 1.5;
        color: #1f2937;
      }
      .wizard-helper {
        font-size: 1rem;
        color: ${COLORS.textMuted};
        margin-top: 0.5rem;
      }
      .wizard-choices {
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
        padding-left: 1.5rem;
        margin-top: 1.75rem;
      }
      .wizard-choice-btn {
        width: 100%;
        text-align: left;
        padding: 1rem 1.25rem;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        font-size: 1.125rem;
        cursor: pointer;
        transition: border-color 0.15s, background-color 0.15s;
        display: flex;
        align-items: center;
        gap: 0.875rem;
      }
      .wizard-choice-btn:hover {
        border-color: ${COLORS.green};
        background-color: ${COLORS.questionBg};
      }
      .wizard-choice-btn.is-selected {
        border-color: ${COLORS.green};
        background-color: ${COLORS.selectedBg};
      }
      .wizard-choice-checkbox {
        width: 1.5rem;
        height: 1.5rem;
        border: 2px solid #d1d5db;
        border-radius: 0.25rem;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: border-color 0.15s, background-color 0.15s;
      }
      .wizard-choice-btn.is-selected .wizard-choice-checkbox {
        border-color: ${COLORS.green};
        background-color: ${COLORS.green};
        color: white;
      }
      .wizard-choice-label {
        flex: 1;
      }
      .wizard-selected-box {
        background: ${COLORS.selectedBg};
        border-radius: 0.5rem;
        padding: 1.25rem;
        margin-left: 1.5rem;
        margin-top: 1.75rem;
      }
      .wizard-selected-label {
        font-size: 1rem;
        font-weight: 500;
        color: ${COLORS.green};
        margin-bottom: 0.375rem;
      }
      .wizard-selected-text {
        font-weight: 500;
        font-size: 1.125rem;
        color: #1f2937;
      }
      .wizard-feedback-card {
        background: ${COLORS.feedbackBg};
        border: 2px solid ${COLORS.feedbackBorder};
        border-radius: 0.75rem;
        padding: 1.75rem;
        margin-top: 1.75rem;
      }
      .wizard-feedback-content {
        display: flex;
        align-items: flex-start;
        gap: 1.125rem;
      }
      .wizard-feedback-icon {
        background: ${COLORS.iconBg};
        border-radius: 50%;
        padding: 0.625rem;
        color: ${COLORS.green};
        flex-shrink: 0;
      }
      .wizard-feedback-text {
        flex: 1;
        color: #1f2937;
        line-height: 1.7;
        font-size: 1.125rem;
      }
      .wizard-outcome-title {
        font-size: 1.375rem;
        font-weight: 600;
        color: ${COLORS.green};
        margin-bottom: 0.625rem;
      }
      .wizard-outcome-body {
        color: #1f2937;
        line-height: 1.7;
        white-space: pre-line;
        font-size: 1.125rem;
      }
      .wizard-outcome-body ul {
        margin: 0.625rem 0;
        padding-left: 1.5rem;
      }
      .wizard-outcome-body li {
        margin: 0.375rem 0;
      }
      .wizard-btn-row {
        display: flex;
        justify-content: center;
        gap: 1.25rem;
        margin-top: 1.75rem;
        flex-wrap: wrap;
      }
      .wizard-btn-row-sticky {
        position: sticky;
        bottom: 0;
        background: ${COLORS.questionBg};
        padding: 1rem 0;
        margin: 1.75rem -1.75rem -1.75rem -1.75rem;
        padding-left: 1.75rem;
        padding-right: 1.75rem;
        border-top: 1px solid #E2E6DC;
        border-radius: 0 0 0.75rem 0.75rem;
        z-index: 10;
      }
      .wizard-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .wizard-btn:hover {
        opacity: 0.9;
      }
      .wizard-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .wizard-btn-primary {
        background: ${COLORS.green};
        color: white;
        border: none;
      }
      .wizard-btn-outline {
        background: transparent;
        color: ${COLORS.green};
        border: 2px solid ${COLORS.green};
      }
      .wizard-btn-ghost {
        background: transparent;
        color: ${COLORS.green};
        border: none;
      }
      .wizard-btn-ghost:hover {
        background: rgba(82, 104, 45, 0.1);
      }
      .wizard-cta-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.875rem 1.75rem;
        background: ${COLORS.green};
        color: white;
        border-radius: 0.5rem;
        font-weight: 500;
        font-size: 1.125rem;
        text-decoration: none;
        margin-top: 0.625rem;
      }
      .wizard-cta-btn:hover {
        opacity: 0.9;
      }
      .wizard-results-section {
        margin-bottom: 1.5rem;
      }
      .wizard-results-section:last-child {
        margin-bottom: 0;
      }
      .wizard-results-label {
        font-size: 1rem;
        font-weight: 600;
        color: ${COLORS.green};
        margin-bottom: 0.5rem;
      }
      .wizard-results-value {
        color: #1f2937;
        line-height: 1.6;
        font-size: 1.125rem;
      }
      .wizard-results-list {
        margin: 0;
        padding-left: 1.5rem;
        font-size: 1.125rem;
      }
      .wizard-results-list li {
        margin: 0.375rem 0;
      }
      .wizard-machine-link {
        color: ${COLORS.green};
        text-decoration: underline;
      }
      .wizard-machine-link:hover {
        opacity: 0.8;
      }
      .wizard-no-machines {
        font-style: italic;
        color: ${COLORS.textMuted};
        font-size: 1.125rem;
      }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  // Render functions
  function renderStepView(step) {
    const isMultiSelect = step.answerType === "multi";

    let choicesHtml;
    if (isMultiSelect) {
      choicesHtml = step.choices.map((choice, i) => {
        const isSelected = multiSelectTemp.includes(choice.value);
        return `
          <button class="wizard-choice-btn${isSelected ? ' is-selected' : ''}" data-choice="${i}">
            <span class="wizard-choice-checkbox">${isSelected ? ICONS.check : ''}</span>
            <span class="wizard-choice-label">${escapeHtml(choice.label)}</span>
          </button>
        `;
      }).join("");
    } else {
      // Single-select: highlight the chosen option; selection no longer auto-advances.
      choicesHtml = step.choices.map((choice, i) => {
        const isSelected = singleSelectTemp === choice.value;
        return `
          <button class="wizard-choice-btn${isSelected ? ' is-selected' : ''}" data-choice="${i}">${escapeHtml(choice.label)}</button>
        `;
      }).join("");
    }

    // Continue is enabled only once this step has a selection (works the same for every
    // question, single or multi, first screen or later).
    const canContinue = isMultiSelect
      ? multiSelectTemp.length > 0
      : (singleSelectTemp !== null && singleSelectTemp !== undefined);
    const isFirstStep = history.length === 0;

    return `
      <div class="wizard-embed" data-view="step">
        <div class="wizard-bubble">
          <div class="wizard-bubble-content">
            <div class="wizard-bubble-icon">${ICONS.messageCircle}</div>
            <div>
              <p class="wizard-thought">${escapeHtml(step.thoughtText)}</p>
              ${step.helperText ? `<p class="wizard-helper">${escapeHtml(step.helperText)}</p>` : ""}
            </div>
          </div>
          <div class="wizard-bubble-tail"></div>
        </div>
        <div class="wizard-choices">
          ${choicesHtml}
        </div>
        <div class="wizard-btn-row wizard-btn-row-sticky">
          ${!isFirstStep ? `
            <button class="wizard-btn wizard-btn-ghost" data-action="back">
              ${ICONS.arrowLeft} Go Back
            </button>
            <button class="wizard-btn wizard-btn-outline" data-action="restart">
              ${ICONS.rotateCcw} Start Over
            </button>
          ` : ""}
          <button class="wizard-btn wizard-btn-primary" data-action="continue" ${!canContinue ? 'disabled' : ''}>
            Continue ${ICONS.arrowRight}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * TEMPORARY (pre-August 1 launch): specific machine recommendations are disabled.
   * While this flag is false, the results screen shows a "contact Sue" invitation
   * instead of naming machines. Flip it back to `true` to restore the original
   * recommendation UI after the recommendations are reviewed post-launch. All scoring
   * and recommendation logic (computeResults, INVENTORY, control/gauge/ribber/caveats,
   * matching machines) is left fully intact below and still runs every render.
   */
  const SHOW_MACHINE_RECOMMENDATIONS = false;

  function renderResultsView() {
    const results = computeResults();

    // Build control types list
    const controlTypesHtml = results.eligibleControlTypes.map(type => 
      `<li>${formatControlType(type)}</li>`
    ).join("");

    // Build caveats list
    const caveatsHtml = results.caveats.length > 0 
      ? `<ul class="wizard-results-list">${results.caveats.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`
      : '<span class="wizard-results-value">None</span>';

    // Build machines list
    let machinesHtml;
    if (results.matchingMachines.length > 0) {
      machinesHtml = `<ul class="wizard-results-list">${results.matchingMachines.map(m => 
        `<li><a href="${escapeHtml(m.url)}" class="wizard-machine-link" target="_blank" rel="noopener noreferrer">${escapeHtml(m.name)}</a></li>`
      ).join("")}</ul>`;
    } else {
      machinesHtml = '<p class="wizard-no-machines">No current machines we offer match every requirement you selected.</p>';
    }

    // Original machine-recommendation card body. Preserved intact; only shown when
    // SHOW_MACHINE_RECOMMENDATIONS is re-enabled after the post-launch review.
    const recommendationsInner = `
      <h3 class="wizard-outcome-title">Your Machine Recommendations</h3>

      <div class="wizard-results-section">
        <p class="wizard-results-label">Control types that fit your needs:</p>
        <ul class="wizard-results-list">${controlTypesHtml}</ul>
      </div>

      <div class="wizard-results-section">
        <p class="wizard-results-label">Gauge family:</p>
        <p class="wizard-results-value">${formatGaugeFamily(results.gaugeFamily)}</p>
      </div>

      <div class="wizard-results-section">
        <p class="wizard-results-label">Ribber:</p>
        <p class="wizard-results-value">${results.ribberOutput}</p>
      </div>

      <div class="wizard-results-section">
        <p class="wizard-results-label">Things to consider:</p>
        ${caveatsHtml}
      </div>

      <div class="wizard-results-section">
        <p class="wizard-results-label">New machines we currently offer that fit:</p>
        ${machinesHtml}
      </div>
    `;

    // TEMPORARY replacement shown while SHOW_MACHINE_RECOMMENDATIONS is false: no specific
    // machine picks yet — show a friendly closing message, a summary of the user's answers,
    // and a Contact Sue button. Remove this (and flip the flag) once recommendations are
    // reviewed after launch.
    const summary = buildAnswerSummary();
    const answersHtml = summary.length > 0
      ? `<ul class="wizard-results-list">${summary.map(item =>
          `<li><strong>${escapeHtml(item.question)}</strong><br>${escapeHtml(item.answer)}</li>`
        ).join("")}</ul>`
      : '<p class="wizard-results-value">No answers recorded.</p>';

    // mailto is built from current wizard state; subject/body encoded with encodeURIComponent.
    const mailtoHref = buildContactMailto();

    const contactInner = `
      <h3 class="wizard-outcome-title">Still have questions?</h3>
      <p class="wizard-outcome-body">Choosing your first knitting machine can feel overwhelming, but it doesn't have to be.</p>
      <p class="wizard-outcome-body" style="margin-top: 0.875rem;">If you'd like a little guidance, let's spend 5 minutes talking about what you want to knit.</p>
      <p class="wizard-outcome-body" style="margin-top: 0.875rem;"><strong>No sales pitch. No pressure. Just one machine knitter helping another find the right machine.</strong></p>

      <div class="wizard-results-section" style="margin-top: 1.5rem;">
        <p class="wizard-results-label">Your answers</p>
        ${answersHtml}
      </div>

      <a href="${escapeHtml(mailtoHref)}" class="wizard-cta-btn">${ICONS.messageCircle} Contact Sue</a>
    `;

    const cardInner = SHOW_MACHINE_RECOMMENDATIONS ? recommendationsInner : contactInner;

    return `
      <div class="wizard-embed" data-view="results">
        <div class="wizard-feedback-card">
          <div class="wizard-feedback-content">
            <div class="wizard-feedback-icon">${ICONS.checkCircle}</div>
            <div class="wizard-feedback-text">
              ${cardInner}
            </div>
          </div>
        </div>
        <div class="wizard-btn-row wizard-btn-row-sticky">
          <button class="wizard-btn wizard-btn-ghost" data-action="back">
            ${ICONS.arrowLeft} Go Back
          </button>
          <button class="wizard-btn wizard-btn-primary" data-action="restart">
            ${ICONS.rotateCcw} Start Over
          </button>
        </div>
      </div>
    `;
  }

  function render() {
    const step = getCurrentStep();

    let content;
    if (step && step.answerType === "computed") {
      content = renderResultsView();
    } else if (step) {
      content = renderStepView(step);
    } else {
      content = `<div style="padding: 2rem; text-align: center; color: #666;">No steps configured for this wizard.</div>`;
    }

    mount.innerHTML = `
      <div class="wizard-well">
        ${content}
      </div>
    `;

    attachEventListeners();
  }

  function attachEventListeners() {
    // Choice buttons
    mount.querySelectorAll("[data-choice]").forEach(btn => {
      btn.addEventListener("click", () => {
        handleChoiceClick(parseInt(btn.dataset.choice, 10));
      });
    });

    // Action buttons
    mount.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        if (action === "back") handleBack();
        else if (action === "continue") handleContinue();
        else if (action === "restart") handleRestart();
      });
    });
  }

  // Initialize
  injectStyles();
  loadTempForCurrentStep();
  render();
})();
