interface Env {
	GITHUB_TOKEN: string;
	GITHUB_OWNER: string;
	GITHUB_REPO: string;
	WORKFLOW_FILE: string;
	GITHUB_REF: string;
	CRON_MINUTES: string;
}

interface TriggerReport {
	action: 'dispatched' | 'would-dispatch' | 'skipped-in-progress' | 'skipped-too-recent' | 'error';
	detail?: string;
	inProgress?: number;
	lastRunAgeMinutes?: number;
	at: string;
}

interface WorkflowRun {
	status: string;
	created_at: string;
}

const GITHUB_API = 'https://api.github.com';
const QUEUED_STATUSES = new Set(['queued', 'waiting', 'requested', 'pending']);

function githubHeaders(env: Env): HeadersInit {
	return {
		Accept: 'application/vnd.github+json',
		Authorization: `Bearer ${env.GITHUB_TOKEN}`,
		'X-GitHub-Api-Version': '2022-11-28',
		'Content-Type': 'application/json',
	};
}

async function runTrigger(env: Env, dryRun: boolean): Promise<TriggerReport> {
	const base = `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}`;
	const workflowRunsUrl = new URL(`${GITHUB_API}${base}/actions/workflows/${encodeURIComponent(env.WORKFLOW_FILE)}/runs`);
	workflowRunsUrl.searchParams.set('per_page', '10');
	if (!env.GITHUB_REF.startsWith('refs/tags/')) {
		workflowRunsUrl.searchParams.set('branch', env.GITHUB_REF.replace(/^refs\/heads\//, ''));
	}
	const runsResponse = await fetch(workflowRunsUrl, { headers: githubHeaders(env) });
	if (!runsResponse.ok) {
		return { action: 'error', detail: `GitHub API ${runsResponse.status} while listing workflow runs`, at: new Date().toISOString() };
	}
	const runsData = (await runsResponse.json()) as { workflow_runs?: WorkflowRun[] };
	const runs = runsData.workflow_runs ?? [];
	const inProgress = runs.filter((run) => run.status === 'in_progress').length;
	if (runs.some((run) => QUEUED_STATUSES.has(run.status))) {
		return { action: 'skipped-in-progress', inProgress, at: new Date().toISOString() };
	}
	const minIntervalMinutes = Math.max(1, Number(env.CRON_MINUTES ?? '5'));
	const latest = runs[0];
	if (latest) {
		const ageMinutes = (Date.now() - new Date(latest.created_at).valueOf()) / 60_000;
		if (ageMinutes < minIntervalMinutes) {
			return { action: 'skipped-too-recent', lastRunAgeMinutes: Math.round(ageMinutes * 10) / 10, at: new Date().toISOString() };
		}
	}
	if (dryRun) {
		return { action: 'would-dispatch', at: new Date().toISOString() };
	}
	const dispatchResponse = await fetch(`${GITHUB_API}${base}/actions/workflows/${encodeURIComponent(env.WORKFLOW_FILE)}/dispatches`, {
		method: 'POST',
		headers: githubHeaders(env),
		body: JSON.stringify({ ref: env.GITHUB_REF }),
	});
	if (dispatchResponse.status !== 204) {
		return { action: 'error', detail: `dispatch returned ${dispatchResponse.status}: ${(await dispatchResponse.text()).slice(0, 200)}`, at: new Date().toISOString() };
	}
	return { action: 'dispatched', at: new Date().toISOString() };
}

export default {
	async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		if (!env.GITHUB_TOKEN) {
			console.error('GITHUB_TOKEN secret is not set; scheduled dispatch skipped.');
			return;
		}
		ctx.waitUntil(
			runTrigger(env, false).then((report) => {
				if (report.action === 'error') console.error(JSON.stringify(report));
				else console.log(JSON.stringify(report));
			}),
		);
	},
	async fetch(_request: Request, env: Env): Promise<Response> {
		const hasToken = Boolean(env.GITHUB_TOKEN);
		const report = hasToken
			? await runTrigger(env, true)
			: { action: 'error' as const, detail: 'GITHUB_TOKEN secret is not set; configure it with `npx wrangler secret put GITHUB_TOKEN`.', at: new Date().toISOString() };
		return Response.json({ worker: 'pulsestatus-scheduler', tokenConfigured: hasToken, config: { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, workflow: env.WORKFLOW_FILE, ref: env.GITHUB_REF, cronMinutes: env.CRON_MINUTES }, report });
	},
};
