import { createScoreRecordStore } from './score-record-store.js';

export const FLOW_RECORDS_STORAGE_KEY = 'turn-flow-records-v1';
export const FLOW_RECORDS_STORAGE_VERSION = 2;

const store = createScoreRecordStore(FLOW_RECORDS_STORAGE_KEY, FLOW_RECORDS_STORAGE_VERSION);
export const getBestFlowRecord = store.getBest;
export const saveBestFlowRecord = store.saveBest;
export const clearFlowRecords = store.clear;
