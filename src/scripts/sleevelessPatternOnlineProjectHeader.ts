/**

 * Online sleeveless pattern tab — display project title and notes from `patternProject`.

 * Print slots stay on `patternPrintPersonalization.ts` (unchanged).

 */



import { canCustomizePattern } from "../lib/patterns/sleevelessPatternAccessGate";

import { initChangePatternChoicesLinks } from "../lib/patterns/restoreSleevelessExpressBuilderFromPattern";
import { ensureSavedCustomPatternSessionHydratedOnPatternPage } from "../lib/patterns/hydrateSavedCustomPatternProject";

import { navigateToCustomizeProjectField } from "../lib/patterns/sleevelessCustomizeProjectFieldNav";

import {

  getPatternProjectMeta,

  getSleevelessPatternOnlineHeading,

  getSleevelessPatternOnlineNotesText,

} from "../lib/patterns/sleevelessPatternProjectMeta";



const PENCIL_ICON_SVG = `<svg class="sleeveless-pattern-edit-shortcut__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;



function bindEditShortcuts(): void {

  if (!canCustomizePattern()) return;



  document.querySelectorAll<HTMLButtonElement>("[data-sleeveless-edit-customize]").forEach((btn) => {

    if (btn.dataset.sleevelessEditCustomizeBound === "1") return;

    const target = btn.getAttribute("data-sleeveless-edit-customize");

    if (target !== "title" && target !== "notes") return;

    btn.dataset.sleevelessEditCustomizeBound = "1";

    btn.hidden = false;

    if (!btn.querySelector(".sleeveless-pattern-edit-shortcut__icon")) {

      btn.insertAdjacentHTML("afterbegin", PENCIL_ICON_SVG);

    }

    btn.addEventListener("click", () => {

      navigateToCustomizeProjectField(target);

    });

  });

}



export function applySleevelessPatternOnlineProjectHeader(): void {

  const heading = document.querySelector("[data-sleeveless-pattern-online-heading]");

  const notesWrap = document.querySelector("[data-sleeveless-pattern-online-notes-wrap]");

  const notesBlock = document.querySelector("[data-sleeveless-pattern-online-notes]");

  const notesText = document.querySelector("[data-sleeveless-pattern-online-notes-text]");



  const meta = getPatternProjectMeta();



  if (heading instanceof HTMLElement) {

    heading.textContent = getSleevelessPatternOnlineHeading(meta);

  }



  const notes = getSleevelessPatternOnlineNotesText(meta);

  const showCustomizeNotes = canCustomizePattern();



  if (notesWrap instanceof HTMLElement) {

    if (showCustomizeNotes) {

      notesWrap.removeAttribute("hidden");

    } else {

      notesWrap.setAttribute("hidden", "");

    }

  }



  if (notesBlock instanceof HTMLElement && notesText instanceof HTMLElement) {

    if (notes) {

      notesText.textContent = notes;

      notesBlock.removeAttribute("hidden");

    } else {

      notesText.textContent = "";

      notesBlock.setAttribute("hidden", "");

    }

  }



  bindEditShortcuts();

}



export function initSleevelessPatternOnlineProjectHeader(): void {

  if (!document.querySelector("[data-sleeveless-pattern-online-heading]")) return;

  ensureSavedCustomPatternSessionHydratedOnPatternPage();

  applySleevelessPatternOnlineProjectHeader();

  initChangePatternChoicesLinks();

}



if (typeof document !== "undefined") {

  const boot = (): void => initSleevelessPatternOnlineProjectHeader();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);

  else boot();

}


