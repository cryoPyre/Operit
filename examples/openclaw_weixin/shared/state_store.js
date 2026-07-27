"use strict";

const { TOOLPKG_ID, asText, isObject, parseJsonObject } = require("./common");

const STATE_FILE_NAME = "send_state.json";
const MAX_RECORDS = 100;

function getStatePath() {
  const directory = asText(ToolPkg.getConfigDir(TOOLPKG_ID)).trim();
  if (!directory) {
    throw new Error(`Unable to resolve state directory for ${TOOLPKG_ID}`);
  }
  return `${directory}/${STATE_FILE_NAME}`;
}

async function readStateFile() {
  const path = getStatePath();
  // 发送记录用于跨进程幂等和失败重发，读取失败必须让调用方看到真实错误。
  const exists = await Tools.Files.exists(path, "android");
  if (!exists || !exists.exists) {
    return { records: {}, lastRequestId: "", lastFailureRequestId: "", lastUpdatedAt: 0 };
  }
  const result = await Tools.Files.read({ path, environment: "android" });
  const parsed = parseJsonObject(result && result.content, "OpenClaw Weixin state");
  return {
    records: isObject(parsed.records) ? parsed.records : {},
    lastRequestId: asText(parsed.lastRequestId).trim(),
    lastFailureRequestId: asText(parsed.lastFailureRequestId).trim(),
    lastUpdatedAt: Number(parsed.lastUpdatedAt) || 0
  };
}

async function writeStateFile(state) {
  await Tools.Files.write(getStatePath(), JSON.stringify(state, null, 2), false, "android");
}

function trimRecords(records) {
  const keys = Object.keys(records);
  if (keys.length <= MAX_RECORDS) {
    return records;
  }
  keys.sort((left, right) => Number(records[left].updatedAt || 0) - Number(records[right].updatedAt || 0));
  const next = Object.assign({}, records);
  while (Object.keys(next).length > MAX_RECORDS) {
    delete next[keys.shift()];
  }
  return next;
}

async function saveRecord(record) {
  const state = await readStateFile();
  // 先写最终发送结果再释放内存中的并发锁，避免同一 request id 同时被重发。
  const nextRecords = trimRecords(Object.assign({}, state.records, {
    [record.requestId]: Object.assign({}, record, { updatedAt: Date.now() })
  }));
  const next = {
    records: nextRecords,
    lastRequestId: record.requestId,
    lastFailureRequestId: record.status === "failed" ? record.requestId : state.lastFailureRequestId,
    lastUpdatedAt: Date.now()
  };
  await writeStateFile(next);
  return record;
}

async function getRecord(requestId) {
  const state = await readStateFile();
  return state.records[requestId] || null;
}

async function getLastFailure() {
  const state = await readStateFile();
  const record = state.records[state.lastFailureRequestId];
  return record && record.status === "failed" ? record : null;
}

async function clearRecords() {
  await writeStateFile({ records: {}, lastRequestId: "", lastFailureRequestId: "", lastUpdatedAt: Date.now() });
}

module.exports = {
  saveRecord,
  getRecord,
  getLastFailure,
  clearRecords,
  readStateFile
};
