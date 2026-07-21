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

CREATE INDEX IF NOT EXISTS idx_legacy_members_email ON legacy_members (LOWER(email));

CREATE INDEX IF NOT EXISTS idx_legacy_members_lastname ON legacy_members (lastname);

CREATE INDEX IF NOT EXISTS idx_legacy_members_fristname ON legacy_members (fristname);

CREATE INDEX IF NOT EXISTS idx_legacy_subscriptions_memberid ON legacy_subscriptions (memberid_fk);

CREATE INDEX IF NOT EXISTS idx_legacy_store_transactions_memberid ON legacy_store_transactions (memberid_fk);

CREATE INDEX IF NOT EXISTS idx_legacy_store_transaction_items_storetransactionid ON legacy_store_transaction_items (storetransactionid);

CREATE INDEX IF NOT EXISTS idx_legacy_course_member_library_memberid ON legacy_course_member_library (memberid_fk);

CREATE INDEX IF NOT EXISTS idx_legacy_member_pattern_details_member ON legacy_member_pattern_details (member_fk);

CREATE INDEX IF NOT EXISTS idx_legacy_pattern_library_purchases_member ON legacy_pattern_library_purchases (memberid_fk);

