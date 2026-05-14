#!/usr/bin/env node
const args = process.argv.slice(2);
const command = args[0];

const sessions = [
  { chat: "产品群", username: "room1@chatroom", chat_type: "group" },
  { chat: "技术群", username: "room2@chatroom", chat_type: "group" },
  { chat: "张三", username: "wxid_zhang", chat_type: "private" },
  { chat: "李四", username: "wxid_li", chat_type: "private" },
  { chat: "公众号", username: "gh_demo", chat_type: "official_account" },
];

const groupMessages = [
  { time: "2026-05-13 09:00", timestamp: 1778624400, sender: "Alice", type: "text", content: "今天评审首页方案" },
  { time: "2026-05-13 09:04", timestamp: 1778624640, sender: "Bob", type: "text", content: "我补数据口径" },
  { time: "2026-05-13 09:06", timestamp: 1778624760, sender: "Alice", type: "link", content: "[引用] 这个口径可以\n  ↳ Bob: 我补数据口径" },
  { time: "2026-05-13 09:40", timestamp: 1778626800, sender: "Carol", type: "file", content: "上传需求文档" },
  { time: "2026-05-13 09:45", timestamp: 1778627100, sender: "Bob", type: "text", content: "今天下班前给结论" },
];

const privateHistory = {
  "张三": [
    { time: "2026-05-13 10:00", timestamp: 1778628000, type: "text", content: "早" },
    { time: "2026-05-13 10:05", timestamp: 1778628300, type: "text", content: "确认一下" },
    { time: "2026-05-13 10:08", timestamp: 1778628480, type: "text", content: "好" },
  ],
  wxid_zhang: [
    { time: "2026-05-13 10:00", timestamp: 1778628000, type: "text", content: "早" },
    { time: "2026-05-13 10:05", timestamp: 1778628300, type: "text", content: "确认一下" },
    { time: "2026-05-13 10:08", timestamp: 1778628480, type: "text", content: "好" },
  ],
  "李四": [
    { time: "2026-05-13 11:00", timestamp: 1778631600, type: "text", content: "收到" },
  ],
  wxid_li: [
    { time: "2026-05-13 11:00", timestamp: 1778631600, type: "text", content: "收到" },
  ],
};

const members = {
  "room1@chatroom": [
    { username: "wxid_alice", display: "Alice" },
    { username: "wxid_bob", display: "Bob" },
    { username: "wxid_zhang", display: "张三" },
  ],
  "room2@chatroom": [
    { username: "wxid_bob", display: "Bob" },
    { username: "wxid_zhang", display: "张三" },
    { username: "wxid_li", display: "李四" },
  ],
};

function print(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

if (command === "sessions") {
  print(sessions);
} else if (command === "stats") {
  print({
    chat: args[1],
    username: args[1],
    total: 5,
    top_senders: [
      { sender: "Alice", count: 2 },
      { sender: "Bob", count: 2 },
      { sender: "Carol", count: 1 },
    ],
    by_hour: [
      { hour: 9, count: 5 },
    ],
  });
} else if (command === "history") {
  const chat = args[1];
  if (chat === "产品群" || chat === "room1@chatroom") {
    print(groupMessages);
  } else {
    print(privateHistory[chat] || []);
  }
} else if (command === "members") {
  print(members[args[1]] || []);
} else {
  console.error(`unsupported mock command: ${command}`);
  process.exit(1);
}
