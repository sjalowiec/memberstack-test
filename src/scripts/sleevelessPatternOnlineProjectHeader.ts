/**

 * Online sleeveless pattern tab — display project title and notes from `patternProject`.

 * Print slots stay on `patternPrintPersonalization.ts` (unchanged).

 */



import { canCustomizePattern } from "../lib/patterns/sleevelessPatternAccessGate";

import { initChangePatternChoicesLinks } from "../lib/patterns/restoreSleevelessExpressBuilderFromPattern";
import { ensureSavedCustomPatternSessionHydratedOnPatternPage } from "../lib/patterns/hydrateSavedCustomPatternProject";

import {

  getPatternProjectMeta,

  getSleevelessPatternOnlineHeading,

  getSleevelessPatternOnlineNotesText,

} from "../lib/patterns/sleevelessPatternProjectMeta";



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


