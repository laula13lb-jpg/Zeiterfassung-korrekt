-- Grunddaten: Abteilungen und Abwesenheitsarten (im Admin-Bereich änderbar)
INSERT INTO "Department" ("id","name","sortOrder","minStaffing","productive","active","createdAt","updatedAt") VALUES
  ('dep_karosserie','Karosserie (inkl. Mechanik)',1,1,true,true,now(),now()),
  ('dep_lack','Lack',2,1,true,true,now(),now()),
  ('dep_buero','Büro/Verwaltung',3,1,false,true,now(),now())
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "AbsenceType" ("id","code","name","category","creditsTarget","deductsVacation","requiresApproval","color","system","active") VALUES
  ('abs_urlaub','URLAUB','Urlaub','URLAUB',true,true,true,'#1d4ed8',true,true),
  ('abs_sonder','SONDERURLAUB','Sonderurlaub','SONDERURLAUB',true,false,true,'#7c3aed',true,true),
  ('abs_unbezahlt','UNBEZAHLT','Unbezahlter Urlaub','UNBEZAHLT',false,false,true,'#64748b',true,true),
  ('abs_fza','FZA','Freizeitausgleich (Überstundenabbau)','FREIZEITAUSGLEICH',false,false,true,'#0891b2',true,true),
  ('abs_schule','BERUFSSCHULE','Berufsschule','SONSTIGE',true,false,false,'#ca8a04',false,true),
  ('abs_schulung','SCHULUNG','Schulung','SONSTIGE',true,false,true,'#16a34a',false,true)
ON CONFLICT ("code") DO NOTHING;
