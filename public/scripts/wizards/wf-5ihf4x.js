ple-system, sans-serif;
      }
      .wizard-embed * {
        box-sizing: border-box;
      }
      .wizard-bubble {
        position: relative;
        border-radius: 1rem;
        border-bottom-left-radius: 0.25rem;
        padding: 1.5rem;
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
        gap: 0.75rem;
      }
      .wizard-bubble-icon {
        color: ${COLORS.green};
        flex-shrink: 0;
        margin-top: 0.125rem;
      }
      .wizard-thought {
        font-size: 1.125rem;
        font-weight: 500;
        line-height: 1.5;
        color: #1f2937;
      }
      .wizard-helper {
        font-size: 0.875rem;
        color: ${COLORS.textMuted};
        margin-top: 0.5rem;
      }
      .wizard-choices {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding-left: 1.5rem;
        margin-top: 1.5rem;
      }
      .wizard-choice-btn {
        width: 100%;
        text-align: left;
        padding: 0.75rem 1rem;
        background: white;
        border: 1px solid #d1d5db;
        border-radius: 0.5rem;
        font-size: 1rem;
        cursor: pointer;
        transition: border-color 0.15s, background-color 0.15s;
      }
      .wizard-choice-btn:hover {
        border-color: ${COLORS.green};
        background-color: ${COLORS.questionBg};
      }
      .wizard-selected-box {
        background: ${COLORS.selectedBg};
        border-radius: 0.5rem;
        padding: 1rem;
        margin-left: 1.5rem;
        margin-top: 1.5rem;
      }
      .wizard-selected-label {
        font-size: 0.875rem;
        font-weight: 500;
        color: ${COLORS.green};
        margin-bottom: 0.25rem;
      }
      .wizard-selected-text {
        font-weight: 500;
        color: #1f2937;
      }
      .wizard-feedback-card {
        background: ${COLORS.feedbackBg};
        border: 2px solid ${COLORS.feedbackBorder};
        border-radius: 0.75rem;
        padding: 1.5rem;
        margin-top: 1.5rem;
      }
      .wizard-feedback-content {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
      }
      .wizard-feedback-icon {
        background: ${COLORS.iconBg};
        border-radius: 50%;
        padding: 0.5rem;
        color: ${COLORS.green};
        flex-shrink: 0;
      }
      .wizard-feedback-text {
        flex: 1;
        color: #1f2937;
        line-height: 1.6;
      }
      .wizard-outcome-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: ${COLORS.green};
        margin-bottom: 0.5rem;
      }
      .wizard-outcome-body {
        color: #1f2937;
        line-height: 1.6;
        white-space: pre-line;
      }
      .wizard-outcome-body ul {
        margin: 0.5rem 0;
        padding-left: 1.5rem;
      }
      .wizard-outcome-body li {
        margin: 0.25rem 0;
      }
      .wizard-btn-row {
        display: flex;
        justify-content: center;
        gap: 1rem;
        margin-top: 1.5rem;
        flex-wrap: wrap;
      }
      .wizard-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.15s;
      }
      .wizard-btn:hover {
        opacity: 0.9;
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
        padding: 0.75rem 1.5rem;
        background: ${COLORS.green};
        color: white;
        border-radius: 0.5rem;
        font-weight: 500;
        text-decoration: none;
        margin-top: 1rem;
      }
      .wizard-cta-btn:hover {
        opacity: 0.9;
      }
    `;
    document.head.appendChild(style);
  }

  // Render functions
  function renderStepView(step) {
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
          ${step.choices.map((choice, i) => `
            <button class="wizard-choice-btn" data-choice="${i}">${escapeHtml(choice.label)}</button>
          `).join("")}
        </div>
        ${history.length > 0 ? `
          <div class="wizard-btn-row">
            <button class="wizard-btn wizard-btn-ghost" data-action="back">
              ${ICONS.arrowLeft} Go Back
            </button>
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderFeedbackView(step, choice) {
    return `
      <div class="wizard-embed" data-view="feedback">
        <div class="wizard-bubble">
          <div class="wizard-bubble-content">
            <div class="wizard-bubble-icon">${ICONS.messageCircle}</div>
            <div>
              <p class="wizard-thought">${escapeHtml(step.thoughtText)}</p>
            </div>
          </div>
          <div class="wizard-bubble-tail"></div>
        </div>
        <div class="wizard-selected-box">
          <p class="wizard-selected-label">You selected:</p>
          <p class="wizard-selected-text">${escapeHtml(choice.label)}</p>
        </div>
        <div class="wizard-feedback-card">
          <div class="wizard-feedback-content">
            <div class="wizard-feedback-icon">${ICONS.checkCircle}</div>
            <div class="wizard-feedback-text">${escapeHtml(choice.feedbackText)}</div>
          </div>
        </div>
        <div class="wizard-btn-row">
          <button class="wizard-btn wizard-btn-ghost" data-action="back">
            ${ICONS.arrowLeft} Change Answer
          </button>
          <button class="wizard-btn wizard-btn-primary" data-action="continue">
            Continue ${ICONS.arrowRight}
          </button>
        </div>
      </div>
    `;
  }

  function renderOutcomeView(outcome) {
    return `
      <div class="wizard-embed" data-view="outcome">
        <div class="wizard-feedback-card">
          <div class="wizard-feedback-content">
            <div class="wizard-feedback-icon">${ICONS.checkCircle}</div>
            <div class="wizard-feedback-text">
              <h3 class="wizard-outcome-title">${escapeHtml(outcome.title)}</h3>
              ${outcome.body ? `<div class="wizard-outcome-body">${outcome.body}</div>` : ""}
              ${outcome.ctaLabel && outcome.ctaHref ? `
                <a href="${escapeHtml(outcome.ctaHref)}" class="wizard-cta-btn" target="_blank" rel="noopener noreferrer">
                  ${escapeHtml(outcome.ctaLabel)} ${ICONS.externalLink}
                </a>
              ` : ""}
            </div>
          </div>
        </div>
        <div class="wizard-btn-row">
          ${history.length > 0 ? `
            <button class="wizard-btn wizard-btn-outline" data-action="back">
              ${ICONS.arrowLeft} Go Back
            </button>
          ` : ""}
          <button class="wizard-btn wizard-btn-primary" data-action="restart">
            ${ICONS.rotateCcw} Start Over
          </button>
        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

  function render() {
    const step = getCurrentStep();
    const outcome = getCurrentOutcome();

    let content;
    if (step && !selectedChoice) {
      content = renderStepView(step);
    } else if (step && selectedChoice) {
      content = renderFeedbackView(step, selectedChoice);
    } else if (outcome) {
      content = renderOutcomeView(outcome);
    } else {
      content = `<div style="padding: 2rem; text-align: center; color: #666;">No steps configured for this wizard.</div>`;
    }

    // Wrap in well container, show orientation text only on first question
    const showOrientation = history.length === 0 && !selectedChoice && !outcome;
    mount.innerHTML = `
      <div class="wizard-well">
        ${showOrientation ? `<p class="wizard-orientation">${ORIENTATION_TEXT}</p>` : ""}
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
  render();
})();
