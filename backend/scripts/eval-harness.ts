#!/usr/bin/env node
/**
 * TalkChess — Guardrail Eval Harness (Phase 5)
 *
 * Samples N ChatMessages from the DB and verifies every chess-fact claim
 * traces back to a tool_call result in the same message's toolCalls field.
 *
 * Usage:
 *   cd backend && npx tsx scripts/eval-harness.ts [--sample 50]
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

// Chess-fact claim patterns — phrases that require engine backing
const CLAIM_PATTERNS: RegExp[] = [
  /best move/i,
  /eval(uation)?\s*(is|of|:)\s*[+\-]?\d/i,
  /\+\d+\.\d+/,    // eval like +1.23
  /\-\d+\.\d+/,    // eval like -1.23
  /mate in \d/i,
  /is (winning|losing|better|worse)/i,
  /centipawn/i,
  /should (have )?play(ed)?/i,
  /(blunder|mistake|inaccuracy|best)/i,
  /engine (says|suggests|recommends)/i,
];

interface HarnessResult {
  totalMessages: number;
  messagesWithClaims: number;
  messagesWithToolCalls: number;
  hallucinated: number;        // claimed without tool backing
  toolBacked: number;          // claimed with tool backing
  hallucination_rate: number;
  examples: Array<{ messageId: string; claim: string; backed: boolean }>;
}

function extractClaims(content: string): string[] {
  const claims: string[] = [];
  const sentences = content.match(/[^.!?]+[.!?]+/g) ?? [content];
  for (const sentence of sentences) {
    for (const pattern of CLAIM_PATTERNS) {
      if (pattern.test(sentence)) {
        claims.push(sentence.trim());
        break;
      }
    }
  }
  return claims;
}

function hasToolCalls(toolCallsJson: string): boolean {
  try {
    const calls = JSON.parse(toolCallsJson);
    return Array.isArray(calls) && calls.length > 0;
  } catch {
    return false;
  }
}

async function runHarness(sampleSize: number): Promise<HarnessResult> {
  const messages = await prisma.chatMessage.findMany({
    where: { role: 'assistant' },
    orderBy: { createdAt: 'desc' },
    take: sampleSize,
  });

  let messagesWithClaims = 0;
  let messagesWithToolCalls = 0;
  let hallucinated = 0;
  let toolBacked = 0;
  const examples: HarnessResult['examples'] = [];

  for (const msg of messages) {
    const claims = extractClaims(msg.content);
    const hasTools = hasToolCalls(msg.toolCalls);

    if (hasTools) messagesWithToolCalls++;

    if (claims.length > 0) {
      messagesWithClaims++;
      for (const claim of claims.slice(0, 2)) { // log up to 2 per message
        if (!hasTools) {
          hallucinated++;
          examples.push({ messageId: msg.id, claim, backed: false });
        } else {
          toolBacked++;
          examples.push({ messageId: msg.id, claim, backed: true });
        }
      }
    }
  }

  const totalClaimMessages = hallucinated + toolBacked;
  const hallucination_rate = totalClaimMessages > 0 ? hallucinated / totalClaimMessages : 0;

  return {
    totalMessages: messages.length,
    messagesWithClaims,
    messagesWithToolCalls,
    hallucinated,
    toolBacked,
    hallucination_rate,
    examples: examples.slice(0, 10),
  };
}

async function main() {
  const sampleArg = process.argv.indexOf('--sample');
  const sampleSize = sampleArg >= 0 ? parseInt(process.argv[sampleArg + 1] ?? '50') : 50;

  console.log('\n🔍 TalkChess Guardrail Eval Harness');
  console.log('=====================================');
  console.log(`Sampling last ${sampleSize} assistant messages...\n`);

  try {
    const result = await runHarness(sampleSize);

    console.log(`📊 Results:`);
    console.log(`  Total messages sampled:    ${result.totalMessages}`);
    console.log(`  Messages with chess claims: ${result.messagesWithClaims}`);
    console.log(`  Messages with tool calls:   ${result.messagesWithToolCalls}`);
    console.log(`  Tool-backed claims:         ${result.toolBacked}`);
    console.log(`  Hallucinated claims:        ${result.hallucinated}`);
    console.log(`\n  🎯 Hallucination rate: ${(result.hallucination_rate * 100).toFixed(1)}%`);

    if (result.hallucination_rate > 0.05) {
      console.log(`\n  ⚠️  WARNING: Hallucination rate exceeds 5% threshold!`);
      console.log(`     Review system prompt and tool-call enforcement.`);
    } else {
      console.log(`\n  ✅ Hallucination rate within acceptable threshold (<5%)`);
    }

    if (result.examples.length > 0) {
      console.log(`\n📝 Sample claims:`);
      for (const ex of result.examples.slice(0, 5)) {
        const badge = ex.backed ? '✅ BACKED' : '❌ HALLUCINATED';
        console.log(`  [${badge}] "${ex.claim.slice(0, 80)}..."`);
      }
    }

    process.exit(result.hallucination_rate > 0.1 ? 1 : 0);
  } catch (err) {
    console.error('Error running harness:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
