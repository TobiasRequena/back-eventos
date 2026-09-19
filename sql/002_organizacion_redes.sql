ALTER TABLE organizacion
  ADD COLUMN sitio_web VARCHAR(255),
  ADD COLUMN instagram VARCHAR(30),
  ADD COLUMN twitter   VARCHAR(15),
  ADD COLUMN facebook  VARCHAR(50),
  ADD CONSTRAINT chk_org_sitio_web CHECK (sitio_web ~* '^https?://[^\s/@]+\.[^\s/@]+(/[^\s]*)?$'),
  ADD CONSTRAINT chk_org_instagram CHECK (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  ADD CONSTRAINT chk_org_twitter   CHECK (twitter   ~ '^[A-Za-z0-9_]{1,15}$'),
  ADD CONSTRAINT chk_org_facebook  CHECK (facebook  ~ '^[A-Za-z0-9.]{5,50}$');
