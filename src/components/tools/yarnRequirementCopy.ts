/** Drawer results subline copy by embed variant (YarnRequirementCalculatorCore). */
export const YARN_RESULT_SUBLINE_BY_VARIANT = {
  hat: 'Includes a 10% buffer. Uses your swatch and this hat’s finished size and construction.',
  blanket: 'From your swatch density and this blanket’s finished size.',
  garment:
    'Note: We’ve added a 10% buffer to account for yarn tails, factory knots, or any mistakes that require re-knitting. If you plan to add extra length to your sweater, you may want to grab one more skein, just in case!',
} as const;

export type YarnRequirementEmbedVariant = keyof typeof YARN_RESULT_SUBLINE_BY_VARIANT | 'default';

export function yarnResultSublineForVariant(
  variant: YarnRequirementEmbedVariant,
): string {
  if (variant === 'default') return '';
  return YARN_RESULT_SUBLINE_BY_VARIANT[variant];
}
