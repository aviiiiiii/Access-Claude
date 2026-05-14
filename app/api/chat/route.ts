import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, WORKFLOWS } from '@/lib/workflows';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 60;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

function collectMdFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function readSkillPrompt(skillName: string): string {
  const skillDir = path.join(process.cwd(), 'lib', 'skills', skillName);
  if (!fs.existsSync(skillDir)) return '';

  // Read SKILL.md first, then all other .md files in folder order
  const allFiles = collectMdFiles(skillDir);
  const skillMd = allFiles.filter(f => path.basename(f) === 'SKILL.md');
  const rest = allFiles.filter(f => path.basename(f) !== 'SKILL.md');

  return [...skillMd, ...rest]
    .map(f => fs.readFileSync(f, 'utf-8'))
    .join('\n\n---\n\n');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, workflowId } = body;

    const workflow = WORKFLOWS.find(w => w.id === workflowId);
    let workflowPrompt: string | null = null;
    if (workflow?.skillName) {
      workflowPrompt = readSkillPrompt(workflow.skillName);
    } else if (workflow?.prompt) {
      workflowPrompt = workflow.prompt;
    }

    // Build system prompt - merge base + workflow if triggered
    const systemPrompt = workflowPrompt
      ? `${SYSTEM_PROMPT}\n\n---\n\nACTIVE WORKFLOW INSTRUCTIONS:\n${workflowPrompt}`
      : SYSTEM_PROMPT;

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
