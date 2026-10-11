# Knit It Now: Legacy Course Purchaser Lookup

**Purpose:** Identify historical *paid purchasers* of a legacy course before granting its course-specific Memberstack access plan. Use a read-only SQL Server query. Do not mistake course access or subscription bonuses for purchases.

## Verified example: Beginner Workshop

- Legacy course: `Challenges_V2.ChallengesID = 33`, title `Beginner Workshop`, catalog cost $49.95, `Free = 0`.
- Purchase history was traced through `Challenge_V2_Member_Libraray.Credit_id_fk` to `credt_history.Credit_id` and then to `Members.memberid` via `Challenge_V2_Member_Libraray.memberid_fk`.
- Paid purchase evidence: `TransactionType = 'Machine Knitting Course'`, `details LIKE 'Home Study Course Purchase: Beginner Workshop Courses%'`, `dollaramount IN (39.96,49.95)`.
- Paid access rows: 109 at $39.96 (108 distinct members in that price group) and 44 at $49.95 (44 distinct members in that price group). Across groups, 153 paid records corresponded to 152 unique legacy members in the final joined result.
- Legacy plan for this course: `pln_course-beginner-workshop-legacy-wzr70hsx`.
- Output CSV columns: `LegacyMemberID, FirstName, LastName, Email, FirstPurchaseDate, PurchaseRecords, TotalPaid`.

## Key tables and caveats

| Table | Role |
|---|---|
| `Challenges_V2` | Course ID, title, price, free status |
| `Challenge_V2_Member_Libraray` | Course-to-member access assignments, credit reference, `Subscriberfree` |
| `credt_history` | Transaction type, description, dollar amount, date |
| `Members` | Legacy member ID, `Fristname` (actual misspelling), `Lastname`, `Email` |
| `Store_items` | Optional course-to-store-item mapping via `ChallengesID_FK` |
| `Store_Transactions_items`, `Store_Transactions` | Possible alternative store purchase trail |

**Caution:** `Subscriberfree = 0` alone is not proof of payment. Every Course 33 library row had a `Credit_id_fk`, including subscription-free rows, so the presence of a credit ID is not proof of payment either. Credit history included subscriber bonuses, free courses, upgrades, updates, and unclassified rows. Inspect these separately; do not silently classify them as purchases. Other courses may have different payment routes and descriptions.

## Reusable read-only investigation

**1. Confirm course metadata** (replace `33`):

```sql
SELECT ChallengesID, Title, Cost, Free, TagID_Purchased
FROM Challenges_V2
WHERE ChallengesID = 33;
```

**2. Summarize access assignment categories:**

```sql
SELECT Subscriberfree,
       COUNT(*) AS TotalRecords,
       COUNT(DISTINCT memberid_fk) AS UniqueMembers
FROM Challenge_V2_Member_Libraray
WHERE ChallengesID_fk = 33
GROUP BY Subscriberfree;
```

**3. Discover payment evidence and exceptions before filtering:**

```sql
SELECT c.TransactionType, c.details, l.Subscriberfree,
       COUNT(*) AS Records,
       COUNT(DISTINCT l.memberid_fk) AS UniqueMembers,
       MIN(c.dollaramount) AS MinDollarAmount,
       MAX(c.dollaramount) AS MaxDollarAmount
FROM Challenge_V2_Member_Libraray AS l
LEFT JOIN credt_history AS c ON l.Credit_id_fk = c.Credit_id
WHERE l.ChallengesID_fk = 33
GROUP BY c.TransactionType, c.details, l.Subscriberfree
ORDER BY l.Subscriberfree, Records DESC;
```

**4. Only after verifying the course-specific paid transaction descriptions, export distinct purchasers.** This query is verified for *Beginner Workshop only*, not a universal filter:

```sql
SELECT m.memberid AS LegacyMemberID,
       m.Fristname AS FirstName,
       m.Lastname AS LastName,
       m.Email,
       MIN(c.transDate) AS FirstPurchaseDate,
       COUNT(*) AS PurchaseRecords,
       SUM(c.dollaramount) AS TotalPaid
FROM Challenge_V2_Member_Libraray AS l
INNER JOIN credt_history AS c ON l.Credit_id_fk = c.Credit_id
INNER JOIN Members AS m ON l.memberid_fk = m.memberid
WHERE l.ChallengesID_fk = 33
  AND c.TransactionType = 'Machine Knitting Course'
  AND c.details LIKE 'Home Study Course Purchase: Beginner Workshop Courses%'
  AND c.dollaramount IN (39.96, 49.95)
GROUP BY m.memberid, m.Fristname, m.Lastname, m.Email
ORDER BY m.Lastname, m.Fristname;
```

**5. Validate export:** compare raw qualifying transaction count with grouped `PurchaseRecords` sum; count distinct legacy member IDs, normalize and check duplicate/missing emails, review NULL names, and separately investigate unmatched member records, refunds, transfers, upgrades, and ambiguous grants. Save raw evidence and review decisions. The join above only includes matching rows in `Members`.

**6. After purchaser approval:** hand the verified CSV to Cursor for Memberstack matching and plan-grant preparation. Do not create accounts, assign plans, change subscriptions, import to ActiveCampaign, or email anyone without separate approval. Keep existing plans intact and never resubscribe unsubscribed contacts.

## Repeatable process for the next course

1. Confirm the legacy course ID and its sales method.
2. Run the transaction-type summary without assuming prices or text patterns.
3. Check `Store_items` and store transaction tables if the course has a store mapping or the course-credit trail is incomplete.
4. Agree on which records are paid, complimentary, refunded, transferred, or ambiguous.
5. Adapt the purchaser query to that course's verified evidence; export and audit.
6. Match to Memberstack, review exceptions, grant access with explicit approval, publish, then email eligible contacts.

**Do not run the Beginner Workshop payment filter unchanged for another course.**
