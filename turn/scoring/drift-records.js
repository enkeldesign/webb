import { createScoreRecordStore } from './score-record-store.js';

export const DRIFT_RECORDS_STORAGE_KEY = 'turn-drift-records-v1';
export const DRIFT_RECORDS_STORAGE_VERSION = 2;

const store = createScoreRecordStore(DRIFT_RECORDS_STORAGE_KEY, DRIFT_RECORDS_STORAGE_VERSION);
export const getBestDriftRecord = store.getBest;
export const saveBestDriftRecord = store.saveBest;
export const clearDriftRecords = store.clear;
