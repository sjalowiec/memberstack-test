CREATE TABLE IF NOT EXISTS "legacy_members" (
"memberid" TEXT NOT NULL,
"fristname" TEXT,
"lastname" TEXT,
"email" TEXT,
"datejoined" TIMESTAMPTZ,
"active" INTEGER,
"betaactive" INTEGER,
"address" TEXT,
"address2" TEXT,
"city" TEXT,
"state" TEXT,
"postalcode" TEXT,
"country" TEXT,
"birthdayinfo" DATE,
"notes" TEXT,
"unsubscribed" INTEGER,
"unsubscribeddate" TIMESTAMPTZ,
"mailchimpid" TEXT,
"mailchimpactive" INTEGER,
"mailchimpstatus" TEXT,
"activecampaignid" TEXT,
"activecampaignstatus" TEXT,
"forumuserid" TEXT,
"heartbeatid" TEXT,
"currentsubscriber" INTEGER,
"subscriptiondate" TIMESTAMPTZ,
"subscriptionexpiring" TIMESTAMPTZ,
"subscriptiontype" TEXT,
"subscriptionrenewal" INTEGER,
"monthlysubscriber" INTEGER,
"subscriptionid_fk" INTEGER,
"stripcustomerid" TEXT,
  PRIMARY KEY ("memberid")
);

CREATE TABLE IF NOT EXISTS "legacy_subscriptions" (
"subscriptionid" BIGINT NOT NULL,
"memberid_fk" TEXT NOT NULL,
"datebought" TIMESTAMPTZ,
"expirationdate" TIMESTAMPTZ,
"transactionguid_fk" TEXT,
"dollaramount" NUMERIC(12, 4),
"arb_id" TEXT,
"abr_inovicenumber" TEXT,
"monthlypaymentwddx" TEXT,
"renewal" INTEGER,
"monthlybilling" INTEGER,
"monthlyyearcompletedate" TEXT,
"cancelled" INTEGER,
"canceldate" TIMESTAMPTZ,
"cardyear" TEXT,
"cardmonth" TEXT,
"cardlast4" TEXT,
"issuewithsub" INTEGER,
"issuedate" TIMESTAMPTZ,
"evidence" INTEGER,
"premium" INTEGER,
"processor" TEXT,
"subscriptionrate_id" TEXT,
  PRIMARY KEY ("subscriptionid")
);

CREATE TABLE IF NOT EXISTS "legacy_store_transactions" (
"storetransactionid" BIGINT NOT NULL,
"transactionid" TEXT NOT NULL,
"memberid_fk" TEXT NOT NULL,
"billing_firstname" TEXT,
"billing_lastname" TEXT,
"billing_address" TEXT,
"billing_address2" TEXT,
"billing_city" TEXT,
"billing_state" TEXT,
"billing_zipcode" TEXT,
"billing_phone" TEXT,
"billing_email" TEXT,
"billing_country" TEXT,
"purchasedate" TIMESTAMPTZ,
"shipping_firstname" TEXT,
"shipping_lastname" TEXT,
"shipping_address" TEXT,
"shipping_address2" TEXT,
"shipping_city" TEXT,
"shipping_state" TEXT,
"shipping_zipcode" TEXT,
"shipping_country" TEXT,
"shipping_phone" TEXT,
"itemcost" NUMERIC(12, 4),
"shippingcost" NUMERIC(12, 4),
"salestax" NUMERIC(12, 4),
"totalcost" NUMERIC(12, 4),
"athorizeid" TEXT,
"additionalnotes" TEXT,
"transactionmethod" TEXT,
"paid" INTEGER,
"coupon_fk" INTEGER,
"discount" NUMERIC(12, 4),
"internalnotes" TEXT,
"fulfillment_id" TEXT,
"fulfillment_status" TEXT,
"fulfillment_ordernumber" TEXT,
"fulfillment_hide" INTEGER,
"fulfillment_shipping_cost" NUMERIC(12, 4),
"fulfillment_orderconfirmation" TEXT,
"fulfillment_status_current" TEXT,
"efill_completed_order" INTEGER,
"orderinfo" TEXT,
"vendornotes" TEXT,
  PRIMARY KEY ("storetransactionid")
);

CREATE TABLE IF NOT EXISTS "legacy_store_transaction_items" (
"transaction_itemid" BIGINT NOT NULL,
"storetransactionid" BIGINT NOT NULL,
"itemid" INTEGER,
"itemname" TEXT,
"color" TEXT,
"quantity" INTEGER,
"vendorid" INTEGER,
"priceperitem" NUMERIC(12, 4),
"totalprice" NUMERIC(12, 4),
"saledescripton" TEXT,
"perlable" TEXT,
"product" TEXT,
"weight" NUMERIC(12, 4),
"onsale" INTEGER,
"putup" TEXT,
"confirmedrecipt" INTEGER,
"shippingdate" TIMESTAMPTZ,
"trackingnumber" TEXT,
"shipped" INTEGER,
"carrier" TEXT,
"vendorpaid" INTEGER,
"orderdate" TIMESTAMPTZ,
"colorid" TEXT,
"ponumber" TEXT,
"backorder" INTEGER,
"removefromlist" INTEGER,
"deposit" NUMERIC(12, 4),
"vendorinvoice" TEXT,
"vendorpaiddate" TIMESTAMPTZ,
  PRIMARY KEY ("transaction_itemid")
);

CREATE TABLE IF NOT EXISTS "legacy_course_member_library" (
"homestudy_libraryid" BIGINT NOT NULL,
"homestudy_courseid_fk" INTEGER NOT NULL,
"dateadded" TIMESTAMPTZ,
"credit_id_fk" INTEGER,
"memberid_fk" TEXT NOT NULL,
"subscriberfree" INTEGER,
  PRIMARY KEY ("homestudy_libraryid")
);

CREATE TABLE IF NOT EXISTS "legacy_member_pattern_details" (
"member_fk" TEXT NOT NULL,
"detailid" BIGINT NOT NULL,
"garmentid_fk" TEXT,
"builddate" TIMESTAMPTZ,
"libraryid_fk" TEXT,
"buildnotes" TEXT,
"buildid" TEXT,
"size" TEXT,
"patterntype" TEXT,
"gaugesizing" TEXT,
"challengeid_fk" TEXT,
"challengepatternname" TEXT,
"customfit" INTEGER,
"customname" TEXT,
"sizingsizeid" TEXT,
"issuewithpattern" INTEGER,
"issuewithpatternmarker" INTEGER,
"neckshape" TEXT,
"garmentstyle" TEXT,
"datatoggles" TEXT,
"patternidlist" TEXT,
"fixed" INTEGER,
  PRIMARY KEY ("detailid")
);

CREATE TABLE IF NOT EXISTS "legacy_pattern_library" (
"patternlibarry_id" BIGINT NOT NULL,
"title" TEXT,
"description" TEXT,
"keywords" TEXT,
"garmentid_fk" INTEGER,
"authorid_fk" INTEGER,
"designerid_fk" INTEGER,
"skill_level_id" INTEGER,
"patterntype" TEXT,
"categoryid" INTEGER,
"filename" TEXT,
"cost" NUMERIC(12, 4),
"active" INTEGER,
"dateadded" TIMESTAMPTZ,
"freewithsubscription" INTEGER,
"credits" INTEGER,
"sizingtypeid_fk" INTEGER,
"additionalimages" TEXT,
"addcopywrite" INTEGER,
"netcost" NUMERIC(12, 4),
  PRIMARY KEY ("patternlibarry_id")
);

CREATE TABLE IF NOT EXISTS "legacy_pattern_library_purchases" (
"pattern_library_purchases" BIGINT NOT NULL,
"transactionguid" TEXT NOT NULL,
"dateadded" TIMESTAMPTZ,
"memberid_fk" TEXT NOT NULL,
"patternlibarry_id" BIGINT NOT NULL,
"vendorpaid" INTEGER,
  PRIMARY KEY ("pattern_library_purchases")
);

CREATE TABLE IF NOT EXISTS watson_import_runs (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'dry-run')),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS watson_import_run_tables (
  import_run_id BIGINT NOT NULL REFERENCES watson_import_runs(id) ON DELETE CASCADE,
  pg_table TEXT NOT NULL,
  export_name TEXT NOT NULL,
  csv_path TEXT NOT NULL,
  csv_row_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  rejected_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  reject_file TEXT,
  PRIMARY KEY (import_run_id, pg_table)
);

CREATE TABLE IF NOT EXISTS watson_notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  memberid TEXT NOT NULL,
  note_text TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('General', 'Course', 'Membership', 'Payment', 'Support')),
  created_by TEXT NOT NULL DEFAULT 'Sue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watson_notes_memberid_created ON watson_notes (memberid, created_at DESC);

CREATE TABLE IF NOT EXISTS watson_store_fulfillments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  memberid TEXT NOT NULL,
  shopify_order_id TEXT,
  shopify_order_number TEXT NOT NULL,
  product_description TEXT NOT NULL,
  product_variant_id TEXT,
  supplier TEXT NOT NULL,
  carrier TEXT NOT NULL,
  tracking_number TEXT,
  actual_shipping_cost NUMERIC(12, 4) NOT NULL CHECK (actual_shipping_cost >= 0),
  customer_shipping_charge NUMERIC(12, 4) CHECK (customer_shipping_charge IS NULL OR customer_shipping_charge >= 0),
  box_count INTEGER NOT NULL DEFAULT 1 CHECK (box_count >= 1),
  ship_date DATE NOT NULL,
  supplier_invoice_number TEXT,
  destination_state TEXT,
  destination_postal TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_shopify_order_id ON watson_store_fulfillments (shopify_order_id);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_memberid_ship_date ON watson_store_fulfillments (memberid, ship_date DESC);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_ship_date ON watson_store_fulfillments (ship_date);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_supplier ON watson_store_fulfillments (supplier);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_product ON watson_store_fulfillments (product_description);

CREATE INDEX IF NOT EXISTS idx_watson_store_fulfillments_shopify_order_number ON watson_store_fulfillments (shopify_order_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watson_store_fulfillments_order_tracking_unique
ON watson_store_fulfillments (shopify_order_number, tracking_number)
WHERE tracking_number IS NOT NULL AND BTRIM(tracking_number) <> '';

CREATE TABLE IF NOT EXISTS watson_shopify_orders (
  shopify_order_id TEXT PRIMARY KEY,
  shopify_order_gid TEXT,
  order_number TEXT NOT NULL,
  order_name TEXT,
  processed_at TIMESTAMPTZ,
  created_at_shopify TIMESTAMPTZ,
  customer_first_name TEXT,
  customer_last_name TEXT,
  customer_email TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal_amount NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_discounts NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_tax NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_shipping NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total_refunded NUMERIC(12, 4) NOT NULL DEFAULT 0,
  financial_status TEXT,
  fulfillment_status TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  tags TEXT,
  site_brand TEXT NOT NULL CHECK (site_brand IN ('knit_it_now', 'designaknit')),
  is_designaknit BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'shopify',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_processed_at ON watson_shopify_orders (processed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_email ON watson_shopify_orders (lower(customer_email));

CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_order_number ON watson_shopify_orders (order_number);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_orders_site_brand ON watson_shopify_orders (site_brand);

CREATE TABLE IF NOT EXISTS watson_shopify_order_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shopify_order_id TEXT NOT NULL REFERENCES watson_shopify_orders (shopify_order_id) ON DELETE CASCADE,
  shopify_line_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  sku TEXT,
  variant_title TEXT,
  vendor TEXT,
  product_id TEXT,
  product_handle TEXT,
  unit_price NUMERIC(12, 4),
  UNIQUE (shopify_order_id, shopify_line_item_id)
);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_order_items_order_id ON watson_shopify_order_items (shopify_order_id);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_order_items_title ON watson_shopify_order_items (title);

CREATE TABLE IF NOT EXISTS watson_shopify_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  lookback_days INTEGER NOT NULL DEFAULT 90,
  orders_fetched INTEGER NOT NULL DEFAULT 0,
  orders_added INTEGER NOT NULL DEFAULT 0,
  orders_updated INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_watson_shopify_sync_runs_started ON watson_shopify_sync_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS watson_dak_licenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shopify_order_id TEXT NOT NULL UNIQUE REFERENCES watson_shopify_orders (shopify_order_id) ON DELETE CASCADE,
  shopify_order_number TEXT NOT NULL,
  customer_email TEXT,
  customer_name TEXT,
  product_title TEXT,
  license_number TEXT,
  license_assigned_date DATE,
  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'assigned', 'delivered')),
  internal_notes TEXT,
  memberid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_watson_dak_licenses_order_number ON watson_dak_licenses (shopify_order_number);

CREATE TABLE IF NOT EXISTS watson_legacy_renewal_reminders (
  id BIGSERIAL PRIMARY KEY,
  as_of_date DATE NOT NULL,
  window_days SMALLINT NOT NULL CHECK (window_days IN (30, 7, 1)),
  tag_name TEXT NOT NULL,
  legacy_memberid TEXT NOT NULL,
  email TEXT,
  paid_through DATE,
  memberstack_id TEXT,
  memberstack_resolution TEXT,
  ac_contact_id TEXT,
  list_status TEXT,
  outcome TEXT NOT NULL,
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  trigger_source TEXT NOT NULL DEFAULT 'manual',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_watson_legacy_renewal_reminders_tagged_unique
ON watson_legacy_renewal_reminders (legacy_memberid, tag_name)
WHERE outcome = 'tagged' AND dry_run = FALSE;

CREATE INDEX IF NOT EXISTS idx_watson_legacy_renewal_reminders_as_of ON watson_legacy_renewal_reminders (as_of_date, window_days);

CREATE INDEX IF NOT EXISTS idx_watson_legacy_renewal_reminders_memberid ON watson_legacy_renewal_reminders (legacy_memberid);

CREATE TABLE IF NOT EXISTS watson_whats_new_cards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('tool', 'pattern', 'resource', 'learning', 'improvement')),
  destination_url TEXT,
  button_text TEXT,
  board_column TEXT NOT NULL CHECK (board_column IN ('just_added', 'worth_exploring', 'in_the_pipeline')),
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  display_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_whats_new_cards_public
ON watson_whats_new_cards (board_column, display_order, publish_date DESC)
WHERE status = 'published' AND archived = FALSE;

CREATE INDEX IF NOT EXISTS idx_watson_whats_new_cards_admin ON watson_whats_new_cards (archived, board_column, display_order, publish_date DESC);

CREATE TABLE IF NOT EXISTS watson_whats_new_settings (
  key TEXT PRIMARY KEY,
  headline TEXT NOT NULL DEFAULT '',
  introduction TEXT NOT NULL DEFAULT '',
  original_video_url TEXT,
  safe_vimeo_embed_url TEXT,
  publish_date DATE,
  button_text TEXT,
  button_destination_url TEXT,
  start_date DATE,
  end_date DATE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE watson_whats_new_settings
  ADD COLUMN IF NOT EXISTS button_text TEXT,
  ADD COLUMN IF NOT EXISTS button_destination_url TEXT,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

CREATE TABLE IF NOT EXISTS watson_tip_of_the_week (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tip_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  intro TEXT NOT NULL,
  video_content_id TEXT NOT NULL,
  available_from DATE NOT NULL,
  available_through DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'active', 'archived')),
  availability_notice TEXT NOT NULL DEFAULT 'Free to watch this week',
  availability_footer_template TEXT NOT NULL DEFAULT
    'This Learning Library video is free for everyone through {date}. After that, it returns to the member Learning Library.',
  try_copy TEXT NOT NULL DEFAULT '',
  sue_tip_copy TEXT NOT NULL DEFAULT '',
  learn_points_json TEXT NOT NULL DEFAULT '[]',
  related_links_json TEXT NOT NULL DEFAULT '[]',
  eyebrow TEXT NOT NULL DEFAULT 'TIP OF THE WEEK',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT watson_tip_of_the_week_dates_ok
    CHECK (available_from <= available_through)
);

CREATE INDEX IF NOT EXISTS idx_watson_tip_of_the_week_public
ON watson_tip_of_the_week (status, available_from, available_through)
WHERE status IN ('scheduled', 'active');

CREATE INDEX IF NOT EXISTS idx_watson_tip_of_the_week_admin
ON watson_tip_of_the_week (status, available_from DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS watson_email_signups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('added', 'already-subscribed', 'not-added', 'failed')),
  outcome TEXT,
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watson_email_signups_added_created
ON watson_email_signups (created_at)
WHERE status = 'added';

CREATE INDEX IF NOT EXISTS idx_watson_email_signups_source_created ON watson_email_signups (source, created_at);

CREATE INDEX IF NOT EXISTS idx_watson_email_signups_status_created ON watson_email_signups (status, created_at);

CREATE INDEX IF NOT EXISTS idx_legacy_members_email ON legacy_members (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_legacy_members_lastname ON legacy_members (lastname);

CREATE INDEX IF NOT EXISTS idx_legacy_members_fristname ON legacy_members (fristname);

CREATE INDEX IF NOT EXISTS idx_legacy_subscriptions_memberid ON legacy_subscriptions (memberid_fk);

CREATE INDEX IF NOT EXISTS idx_legacy_store_transactions_memberid ON legacy_store_transactions (memberid_fk);

CREATE INDEX IF NOT EXISTS idx_legacy_store_transaction_items_storetransactionid ON legacy_store_transaction_items (storetransactionid);

CREATE INDEX IF NOT EXISTS idx_legacy_course_member_library_memberid ON legacy_course_member_library (memberid_fk);

CREATE INDEX IF NOT EXISTS idx_legacy_member_pattern_details_member ON legacy_member_pattern_details (member_fk);

CREATE INDEX IF NOT EXISTS idx_legacy_pattern_library_purchases_member ON legacy_pattern_library_purchases (memberid_fk);

