-- Allow LearnDesignKnit Course Purchase rows in watson_legacy_history.
-- Does not modify existing Membership / Course Purchase / Pattern Purchase / LK150 Bundle rows.

ALTER TABLE watson_legacy_history
  DROP CONSTRAINT IF EXISTS watson_legacy_history_category_check,
  ADD CONSTRAINT watson_legacy_history_category_check
    CHECK (category IN (
      'Membership',
      'Course Purchase',
      'Pattern Purchase',
      'LK150 Bundle',
      'LearnDesignKnit Course Purchase'
    ));
