/**
 * Print the video page. Print CSS keeps only the title and transcript copy.
 * The listener runs during capture so the click never toggles the accordion.
 */

type PrintTranscriptTarget = {
  closest?: (selector: string) => unknown;
};

export function handleTranscriptPrintClick(event: Event): boolean {
  const target = event.target as PrintTranscriptTarget | null;
  if (!target?.closest?.("[data-print-transcript]")) return false;
  event.preventDefault();
  event.stopPropagation();
  window.print();
  return true;
}

export function bindTranscriptPrintButton(): void {
  document.addEventListener("click", handleTranscriptPrintClick, true);
}
