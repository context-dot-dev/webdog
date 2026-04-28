ALTER TABLE `target` ADD COLUMN `linkScope` text;
--> statement-breakpoint
UPDATE target SET linkScope = 'NEW', kind = 'SITEMAP_LINKS' WHERE kind = 'NEW_LINK';
--> statement-breakpoint
UPDATE target SET linkScope = 'REMOVED', kind = 'SITEMAP_LINKS' WHERE kind = 'REMOVED_LINK';
--> statement-breakpoint
UPDATE alert
SET targetId = (
  SELECT MIN(t2.id)
  FROM target t2
  WHERE t2.websiteId = (SELECT websiteId FROM target WHERE id = alert.targetId)
    AND t2.kind = 'SITEMAP_LINKS'
    AND t2.pageUrl IS NULL
)
WHERE targetId IN (
  SELECT t.id
  FROM target t
  WHERE t.kind = 'SITEMAP_LINKS'
    AND t.pageUrl IS NULL
    AND (
      SELECT COUNT(*)
      FROM target t3
      WHERE t3.websiteId = t.websiteId
        AND t3.kind = 'SITEMAP_LINKS'
        AND t3.pageUrl IS NULL
    ) >= 2
);
--> statement-breakpoint
UPDATE target
SET linkScope = 'BOTH'
WHERE id IN (
  SELECT MIN(id)
  FROM target
  WHERE kind = 'SITEMAP_LINKS'
    AND pageUrl IS NULL
  GROUP BY websiteId
  HAVING COUNT(*) >= 2
);
--> statement-breakpoint
DELETE FROM target
WHERE id IN (
  SELECT t1.id
  FROM target t1
  INNER JOIN target t2 ON t1.websiteId = t2.websiteId
    AND t1.kind = 'SITEMAP_LINKS'
    AND t2.kind = 'SITEMAP_LINKS'
    AND t1.pageUrl IS NULL
    AND t2.pageUrl IS NULL
    AND t1.id <> t2.id
  WHERE t1.id > t2.id
);
