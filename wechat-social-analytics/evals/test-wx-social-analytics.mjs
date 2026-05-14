#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const script = path.join(root, "scripts", "wx-social-analytics.mjs");
const mockWx = path.join(root, "evals", "mock-wx.mjs");

function run(args) {
  const result = spawnSync("node", [script, ...args], {
    encoding: "utf8",
    env: { ...process.env, WX_BIN: mockWx },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const groupTop = run(["group-top", "--chat", "产品群"]);
assert.equal(groupTop.question, "group_top_active");
assert.equal(groupTop.top_senders[0].sender, "Alice");
assert.equal(groupTop.top_senders.length, 3);

const topology = run(["group-topology", "--chat", "产品群", "--top", "3", "--mermaid"]);
assert.equal(topology.question, "group_interaction_topology");
assert.equal(topology.edges[0].from, "Alice");
assert.equal(topology.edges[0].to, "Bob");
assert.equal(topology.edges[0].weight, 4);
assert.match(topology.mermaid, /graph TD/);

const myTop = run(["my-top", "--days", "10"]);
assert.equal(myTop.question, "private_chat_top");
assert.equal(myTop.scanned_private_sessions, 3);
assert.equal(myTop.skipped_private_sessions, 1);
assert.equal(myTop.top[0].display, "张三");
assert.equal(myTop.top[0].message_count, 3);

const sharedGroups = run(["shared-groups"]);
assert.equal(sharedGroups.question, "shared_groups_top");
assert.equal(sharedGroups.top[0].display, "Bob");
assert.equal(sharedGroups.top[0].shared_group_count, 2);

const summary = run(["group-summary", "--chat", "产品群", "--date", "2026-05-13"]);
assert.equal(summary.question, "daily_group_summary_source");
assert.equal(summary.message_count, 5);
assert.equal(summary.top_senders[0].sender, "Alice");
assert.equal(summary.by_type[0].type, "text");
assert.equal(summary.messages[0].content, "今天评审首页方案");

console.log("ok");
