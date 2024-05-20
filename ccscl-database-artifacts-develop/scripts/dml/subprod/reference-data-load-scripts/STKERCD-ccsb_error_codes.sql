INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (1,'IVBDY','Y','Invalid body number input');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (2,'ACBDY','Y','Body Number not in GALC');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (3,'NOBDY','Y','No body Number');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (4,'NOULD','Y','In transit - part has no last unload');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (5,'OLPOS','Y','Overlap between dock inventory and intransit (OSC)');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (6,'GAPOS','Y','OSC gap in pipeline');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (7,'NOSFY','Y','Part has no safety loaded');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (8,'CRULD','N','In transit - last unload is not current date');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (9,'NOADR','N','Part has no Address');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (10,'NOLC2','N','Part not Life Cycle 2 at other docks');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (11,'DTINT','N','In transit - last unload is not current date');
INSERT INTO TMM.ccsb_error_codes (ERROR_CODE_ID,ERROR_CODE,IS_CRITICAL,MESSAGE) VALUES (12,'MISTP','Y','New Tracking point(s) found in GALC');