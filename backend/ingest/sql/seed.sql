BEGIN;

INSERT INTO clients (name, slug)
VALUES ('Metro Vancouver', 'metrovancouver')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO sites (client_id, name, slug)
SELECT id, 'Coquitlam Dam', 'coquitlam'
FROM clients WHERE slug='metrovancouver'
ON CONFLICT (slug) DO NOTHING;

COMMIT;
