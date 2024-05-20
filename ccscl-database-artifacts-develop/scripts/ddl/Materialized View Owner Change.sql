-- DEV DB
alter materialized view tmm.stklgsm owner to ccsdevappuser;
alter materialized view tmm.stkdkrm owner to ccsdevappuser;
alter materialized view tmm.stkmxrm  owner to ccsdevappuser;
alter materialized view tmm.stkprum  owner to ccsdevappuser;

-- QA DB
alter materialized view tmm.stklgsm owner to ccsqaappuser;
alter materialized view tmm.stkdkrm owner to ccsqaappuser;
alter materialized view tmm.stkmxrm  owner to ccsqaappuser;
alter materialized view tmm.stkprum  owner to ccsqaappuser;

-- PROD DB
alter materialized view tmm.stklgsm owner to ccsprodappuser;
alter materialized view tmm.stkdkrm owner to ccsprodappuser;
alter materialized view tmm.stkmxrm  owner to ccsprodappuser;
alter materialized view tmm.stkprum  owner to ccsprodappuser;
