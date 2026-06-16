ALTER TABLE activities ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'activity';

UPDATE activities SET category = 'drift'
WHERE name IN (
  'Kahytten/lokale',
  'Båtdrift',
  'Admin/gebyrer',
  'Kretskontingent',
  'Tropp/gruppe'
);
