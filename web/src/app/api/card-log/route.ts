import { NextRequest, NextResponse } from 'next/server';

const GIST_ID = process.env.CARD_LOG_GIST_ID || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, tagline, skills, url, website } = body;

    if (!name) {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }

    if (!GITHUB_TOKEN || !GIST_ID) {
      // Fallback: just acknowledge
      return NextResponse.json({ ok: true, note: 'gist not configured' });
    }

    // Fetch current gist
    const gistRes = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }
    });
    const gist = await gistRes.json();
    const filename = Object.keys(gist.files)[0];
    let entries = [];
    try {
      entries = JSON.parse(gist.files[filename].content);
    } catch {}

    entries.unshift({
      name: decodeURIComponent(name || ''),
      tagline: decodeURIComponent(tagline || ''),
      skills: decodeURIComponent(skills || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      url: decodeURIComponent(url || ''),
      website: decodeURIComponent(website || ''),
      timestamp: new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for') || 'unknown',
    });

    if (entries.length > 500) entries = entries.slice(0, 500);

    // Update gist
    await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          [filename]: { content: JSON.stringify(entries, null, 2) }
        }
      })
    });

    return NextResponse.json({ ok: true, total: entries.length });
  } catch (err) {
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
