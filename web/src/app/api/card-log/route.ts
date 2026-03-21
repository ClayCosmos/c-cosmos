import { NextRequest, NextResponse } from 'next/server';

const REPO = 'ClayCosmos/c-cosmos';
const FILE_PATH = 'web/data/agent-cards.json';

interface AgentCard {
  name: string;
  tagline?: string;
  skills?: string[];
  url?: string;
  website?: string;
  timestamp: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = decodeURIComponent(body.name || '').trim();
    const tagline = decodeURIComponent(body.tagline || '').trim();
    const skills = decodeURIComponent(body.skills || '')
      .split(',').map((s: string) => s.trim()).filter(Boolean);
    const url = decodeURIComponent(body.url || '').trim();
    const website = decodeURIComponent(body.website || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    const token = process.env.GITHUB_TOKEN;
    const apiBase = 'https://api.github.com/repos/' + REPO + '/contents/' + FILE_PATH;

    let currentContent = '[]';
    let sha: string | undefined;

    if (token) {
      try {
        const getRes = await fetch(apiBase, {
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        });
        if (getRes.ok) {
          const data = await getRes.json() as { sha?: string; content?: string };
          sha = data.sha;
          currentContent = Buffer.from(data.content ?? '', 'base64').toString('utf-8');
        }
      } catch {
        // file doesn't exist yet, start with empty array
      }
    }

    let entries: AgentCard[] = [];
    try { entries = JSON.parse(currentContent) as AgentCard[]; } catch {
      entries = [];
    }

    // Deduplicate: skip if same agent logged today
    const today = new Date().toISOString().slice(0, 10);
    const alreadyLogged = entries.some((e: AgentCard) =>
      e.name?.toLowerCase() === name.toLowerCase() &&
      e.timestamp?.startsWith(today)
    );

    if (!alreadyLogged) {
      entries.unshift({ name, tagline, skills, url, website, timestamp: new Date().toISOString() });
      if (entries.length > 500) entries = entries.slice(0, 500);

      if (token) {
        const newContent = Buffer.from(JSON.stringify(entries, null, 2)).toString('base64');
        await fetch(apiBase, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
          },
          body: JSON.stringify({
            message: 'chore: log agent card creation — ' + name,
            content: newContent,
            sha: sha
          })
        });
      }
    }

    return NextResponse.json({ ok: true, total: entries.length, alreadyLogged });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
