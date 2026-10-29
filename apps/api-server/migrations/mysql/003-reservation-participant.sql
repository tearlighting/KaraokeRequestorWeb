-- Additive participant attribution for new reservations. Existing rows remain unlinked.
ALTER TABLE reservation
  ADD COLUMN participant_userid CHAR(36) NULL AFTER id,
  ADD KEY reservation_participant (participant_userid, reqorder, id),
  ADD CONSTRAINT reservation_participant_fk FOREIGN KEY (participant_userid)
    REFERENCES app_user(userid) ON DELETE SET NULL;
