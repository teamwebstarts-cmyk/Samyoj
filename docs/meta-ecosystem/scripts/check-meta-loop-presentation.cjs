#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../../..");
const file = path.join(root, "docs/meta-ecosystem/META_LOOP_PRESENTATION_2026-09-18.md");
const text = fs.readFileSync(file, "utf8");
const fail = (m) => {
  console.error(m);
  process.exit(1);
};

if (!text.includes("Samyoj Meta Loop")) fail("missing program name");
const mermaid = (text.match(/```mermaid/g) || []).length;
if (mermaid < 6) fail(`need >=6 mermaid charts, got ${mermaid}`);
if (!text.includes("## 12. Three ledgers") ||
    !text.includes("Samyoj SaaS — Razorpay") ||
    !text.includes("WhatsApp Cloud — Meta → WABA") ||
    !text.includes("Ad spend — Meta → Ad Account")) {
  fail("need the three current ledger labels");
}
if (!/Lead Ads|Phase 0|CTWA/.test(text)) fail("missing phase language");
if (!text.includes("We do not build") && !text.includes("We do not")) {
  fail("missing not-doing language");
}
// Invented IG/Messenger Cloud API rupee-per-DM would be a lie.
if (/Instagram.{0,80}₹\s*0\.\d+/i.test(text) || /Messenger.{0,80}₹\s*0\.\d+/i.test(text)) {
  fail("do not invent IG/Messenger per-message INR");
}
if (text.includes("₹0.78") && !text.includes("heuristic")) {
  fail("₹0.78 must be labeled heuristic not invoice");
}

console.log("meta-loop-presentation-ok");
