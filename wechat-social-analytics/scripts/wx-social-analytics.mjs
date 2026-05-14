#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const mode = args.shift();

function usage() {
  console.error(`Usage:
  wx-social-analytics.mjs group-top --chat <name> [--since YYYY-MM-DD] [--until YYYY-MM-DD]
  wx-social-analytics.mjs group-topology --chat <name> [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--limit 5000] [--window-minutes 10] [--mermaid]
  wx-social-analytics.mjs my-top [--days 10] [--sessions 300] [--limit-per-chat 5000]
  wx-social-analytics.mjs shared-groups [--sessions 1000] [--top 10]
  wx-social-analytics.mjs group-summary --chat <name> [--date YYYY-MM-DD] [--limit 5000] [--content-limit 500]`);
  process.exit(2);
}

function opt(name, fallback = undefined) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return fallback;
  if (i === args.length - 1 || args[i + 1].startsWith("--")) return true;
  return args[i + 1];
}

function intOpt(name, fallback) {
  const value = opt(name);
  if (value === undefined || value === true) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function wx(commandArgs) {
  const wxBin = process.env.WX_BIN || "wx";
  const result = spawnSync(wxBin, commandArgs, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `wx exited ${result.status}`).trim());
  }
  const stdout = result.stdout.trim();
  return stdout ? JSON.parse(stdout) : null;
}

function sinceFromDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatLocalDate(d);
}

function dateFromDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatLocalDate(d);
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDateFlags(out) {
  const since = opt("since");
  const until = opt("until");
  if (since) out.push("--since", String(since));
  if (until) out.push("--until", String(until));
}

function sortByCountDesc(rows, key = "count") {
  return rows.sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0) || String(a.display || a.sender || "").localeCompare(String(b.display || b.sender || "")));
}

function safeId(label, taken) {
  const base = `n${Buffer.from(label).toString("hex").slice(0, 16) || "x"}`;
  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  taken.add(id);
  return id;
}

function mermaid(edges) {
  const ids = new Map();
  const taken = new Set();
  const get = (label) => {
    if (!ids.has(label)) ids.set(label, safeId(label, taken));
    return ids.get(label);
  };
  const lines = ["graph TD"];
  for (const edge of edges) {
    const from = get(edge.from);
    const to = get(edge.to);
    lines.push(`  ${from}["${escapeMermaid(edge.from)}"] -->|${edge.weight}| ${to}["${escapeMermaid(edge.to)}"]`);
  }
  return lines.join("\n");
}

function escapeMermaid(s) {
  return String(s).replaceAll('"', '\\"').replaceAll("[", "(").replaceAll("]", ")");
}

function groupTop() {
  const chat = opt("chat");
  if (!chat || chat === true) usage();
  const cmd = ["stats", String(chat), "--json"];
  addDateFlags(cmd);
  const stats = wx(cmd);
  const top = stats.top_senders || [];
  console.log(JSON.stringify({
    question: "group_top_active",
    chat: stats.chat,
    username: stats.username,
    total: stats.total,
    top_senders: top.slice(0, 10),
    method: "wx stats top_senders",
  }, null, 2));
}

function groupTopology() {
  const chat = opt("chat");
  if (!chat || chat === true) usage();
  const limit = intOpt("limit", 5000);
  const windowMinutes = intOpt("window-minutes", 10);
  const cmd = ["history", String(chat), "--json", "-n", String(limit)];
  addDateFlags(cmd);
  const messages = wx(cmd).filter((m) => m.sender);
  const byPair = new Map();
  const addEdge = (from, to, weight, reason) => {
    if (!from || !to || from === to) return;
    const key = `${from}\u0000${to}`;
    const prev = byPair.get(key) || { from, to, weight: 0, adjacency: 0, quote: 0 };
    prev.weight += weight;
    prev[reason] += weight;
    byPair.set(key, prev);
  };

  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const cur = messages[i];
    const delta = (cur.timestamp || 0) - (prev.timestamp || 0);
    if (delta >= 0 && delta <= windowMinutes * 60) {
      addEdge(prev.sender, cur.sender, 1, "adjacency");
    }
  }

  const quoteRe = /↳\s*([^:\n]+):/g;
  for (const msg of messages) {
    let match;
    while ((match = quoteRe.exec(msg.content || ""))) {
      addEdge(msg.sender, match[1].trim(), 3, "quote");
    }
  }

  const edges = Array.from(byPair.values())
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
    .slice(0, intOpt("top", 30));
  const out = {
    question: "group_interaction_topology",
    chat: String(chat),
    message_count: messages.length,
    window_minutes: windowMinutes,
    method: "temporal_adjacency_and_quote",
    edges,
  };
  if (opt("mermaid") === true) out.mermaid = mermaid(edges);
  console.log(JSON.stringify(out, null, 2));
}

function myTop() {
  const days = intOpt("days", 10);
  const sessionsLimit = intOpt("sessions", 300);
  const limitPerChat = intOpt("limit-per-chat", 5000);
  const since = opt("since") || sinceFromDays(days);
  const sessions = wx(["sessions", "--json", "-n", String(sessionsLimit)]).filter((s) => s.chat_type === "private");
  const rows = [];
  let skipped = 0;
  for (const s of sessions) {
    const messages = historyForSession(s, since, limitPerChat);
    if (!messages) {
      skipped += 1;
      continue;
    }
    if (!messages.length) continue;
    rows.push({
      display: s.chat,
      username: s.username,
      message_count: messages.length,
      last_time: messages[messages.length - 1]?.time || "",
      last_timestamp: messages[messages.length - 1]?.timestamp || 0,
    });
  }
  sortByCountDesc(rows, "message_count");
  console.log(JSON.stringify({
    question: "private_chat_top",
    since,
    days,
    scanned_private_sessions: sessions.length,
    skipped_private_sessions: skipped,
    method: "private chat total message count",
    top: rows.slice(0, intOpt("top", 10)),
  }, null, 2));
}

function historyForSession(session, since, limit) {
  const candidates = [session.chat, session.username].filter(Boolean);
  for (const chat of candidates) {
    try {
      return wx(["history", String(chat), "--json", "--since", String(since), "-n", String(limit)]);
    } catch {
      continue;
    }
  }
  return null;
}

function sharedGroups() {
  const sessionsLimit = intOpt("sessions", 1000);
  const topN = intOpt("top", 10);
  const sessions = wx(["sessions", "--json", "-n", String(sessionsLimit)]).filter((s) => s.chat_type === "group");
  const people = new Map();
  const selfUsername = opt("self") || inferSelfUsername();
  for (const group of sessions) {
    let members;
    try {
      const result = wx(["members", group.username || group.chat, "--json"]);
      members = result.members || result;
    } catch {
      continue;
    }
    for (const m of members) {
      if (!m.username || !m.display) continue;
      if (selfUsername && m.username === selfUsername) continue;
      const prev = people.get(m.username) || {
        username: m.username,
        display: m.display,
        shared_group_count: 0,
        groups: [],
      };
      prev.shared_group_count += 1;
      prev.groups.push(group.chat);
      people.set(m.username, prev);
    }
  }
  const top = Array.from(people.values())
    .map((p) => ({ ...p, sample_groups: p.groups.slice(0, 5), groups: undefined }))
    .sort((a, b) => b.shared_group_count - a.shared_group_count || a.display.localeCompare(b.display))
    .slice(0, topN);
  console.log(JSON.stringify({
    question: "shared_groups_top",
    scanned_group_sessions: sessions.length,
    excluded_self: selfUsername || "",
    method: "scan recent group sessions and aggregate wx members",
    coverage_note: "wx sessions is recent-session based; provide a group list for full coverage.",
    top,
  }, null, 2));
}

function inferSelfUsername() {
  try {
    const configPath = path.join(os.homedir(), ".wx-cli", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const base = path.basename(path.dirname(config.db_dir || ""));
    return base.split("_")[0] || "";
  } catch {
    return "";
  }
}

function groupSummary() {
  const chat = opt("chat");
  if (!chat || chat === true) usage();
  const date = opt("date") || dateFromDaysAgo(1);
  const limit = intOpt("limit", 5000);
  const contentLimit = intOpt("content-limit", 500);
  const until = opt("until") || String(date);
  const messages = wx(["history", String(chat), "--json", "--since", String(date), "--until", String(until), "-n", String(limit)]);
  const stats = wx(["stats", String(chat), "--json", "--since", String(date), "--until", String(until)]);
  const senderCounts = new Map();
  const typeCounts = new Map();
  for (const msg of messages) {
    if (msg.sender) senderCounts.set(msg.sender, (senderCounts.get(msg.sender) || 0) + 1);
    if (msg.type) typeCounts.set(msg.type, (typeCounts.get(msg.type) || 0) + 1);
  }
  const topSenders = Array.from(senderCounts.entries())
    .map(([sender, count]) => ({ sender, count }))
    .sort((a, b) => b.count - a.count || a.sender.localeCompare(b.sender))
    .slice(0, 10);
  const byType = Array.from(typeCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  const compactMessages = messages.map((msg) => ({
    time: msg.time,
    sender: msg.sender || "",
    type: msg.type || "",
    content: String(msg.content || "").slice(0, contentLimit),
  }));
  console.log(JSON.stringify({
    question: "daily_group_summary_source",
    chat: stats.chat || String(chat),
    username: stats.username,
    date,
    until,
    message_count: messages.length,
    truncated_by_limit: messages.length >= limit,
    method: "wx history plus wx stats for one day",
    top_senders: topSenders,
    by_type: byType,
    by_hour: stats.by_hour || [],
    messages: compactMessages,
    summary_instruction: "Summarize topics, decisions, tasks, links/files worth opening, questions without answers, and active participants. Mention data limits if truncated_by_limit is true.",
  }, null, 2));
}

try {
  if (mode === "group-top") groupTop();
  else if (mode === "group-topology") groupTopology();
  else if (mode === "my-top") myTop();
  else if (mode === "shared-groups") sharedGroups();
  else if (mode === "group-summary") groupSummary();
  else usage();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
