import { mkdir, writeFile } from 'node:fs/promises';

interface Discussion { id: string; title: string; body: string; url: string; createdAt: string; category: { name: string } }
const token = process.env.GITHUB_TOKEN;
const repositoryId = process.env.GITHUB_REPOSITORY_ID;
if (!token || !repositoryId) {
  console.warn('Discussions unavailable: missing token or repository id. Incident data remains authoritative.');
  await mkdir('public/data', { recursive: true });
  await writeFile('public/data/announcements.json', JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), available: false, announcements: [] }));
  process.exit(0);
}
const query = `query($id:ID!){repository(id:$id){discussions(first:50,orderBy:{field:CREATED_AT,direction:DESC}){nodes{id title body url createdAt category{name}}}}}`;
const response = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { id: repositoryId } }) });
if (!response.ok) throw new Error(`GitHub GraphQL ${response.status}`);
const payload = await response.json() as { data?: { repository?: { discussions?: { nodes: Discussion[] } } }; errors?: unknown[] };
if (payload.errors?.length || !payload.data?.repository?.discussions) throw new Error('GitHub Discussions response was unavailable');
const announcements = payload.data.repository.discussions.nodes.filter((discussion) => ['Announcements', 'Scheduled Maintenance'].includes(discussion.category.name)).map((discussion) => ({ ...discussion, body: discussion.body.replace(/<[^>]*>/g, '').slice(0, 500) }));
await mkdir('public/data', { recursive: true });
await writeFile('public/data/announcements.json', JSON.stringify({ schemaVersion: 1, generatedAt: new Date().toISOString(), available: true, announcements }, null, 2));
