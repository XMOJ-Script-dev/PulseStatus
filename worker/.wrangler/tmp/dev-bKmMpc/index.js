var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var GITHUB_API = "https://api.github.com";
var ACTIVE_STATUSES = /* @__PURE__ */ new Set(["queued", "in_progress", "waiting", "requested", "pending"]);
function githubHeaders(env) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}
__name(githubHeaders, "githubHeaders");
async function runTrigger(env, dryRun) {
  const base = `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}`;
  const runsResponse = await fetch(`${GITHUB_API}${base}/actions/runs?per_page=10`, { headers: githubHeaders(env) });
  if (!runsResponse.ok) {
    return { action: "error", detail: `GitHub API ${runsResponse.status} while listing workflow runs`, at: (/* @__PURE__ */ new Date()).toISOString() };
  }
  const runsData = await runsResponse.json();
  const runs = runsData.workflow_runs ?? [];
  const inProgress = runs.filter((run) => ACTIVE_STATUSES.has(run.status)).length;
  if (inProgress > 0) {
    return { action: "skipped-in-progress", inProgress, at: (/* @__PURE__ */ new Date()).toISOString() };
  }
  const minIntervalMinutes = Math.max(1, Number(env.CRON_MINUTES ?? "5") - 1);
  const latest = runs[0];
  if (latest) {
    const ageMinutes = (Date.now() - new Date(latest.created_at).valueOf()) / 6e4;
    if (ageMinutes < minIntervalMinutes) {
      return { action: "skipped-too-recent", lastRunAgeMinutes: Math.round(ageMinutes * 10) / 10, at: (/* @__PURE__ */ new Date()).toISOString() };
    }
  }
  if (dryRun) {
    return { action: "would-dispatch", at: (/* @__PURE__ */ new Date()).toISOString() };
  }
  const dispatchResponse = await fetch(`${GITHUB_API}${base}/actions/workflows/${encodeURIComponent(env.WORKFLOW_FILE)}/dispatches`, {
    method: "POST",
    headers: githubHeaders(env),
    body: JSON.stringify({ ref: env.GITHUB_REF })
  });
  if (dispatchResponse.status !== 204) {
    return { action: "error", detail: `dispatch returned ${dispatchResponse.status}: ${(await dispatchResponse.text()).slice(0, 200)}`, at: (/* @__PURE__ */ new Date()).toISOString() };
  }
  return { action: "dispatched", at: (/* @__PURE__ */ new Date()).toISOString() };
}
__name(runTrigger, "runTrigger");
var src_default = {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runTrigger(env, false).then((report) => {
        if (report.action === "error") console.error(JSON.stringify(report));
        else console.log(JSON.stringify(report));
      })
    );
  },
  async fetch(_request, env) {
    const hasToken = Boolean(env.GITHUB_TOKEN);
    const report = hasToken ? await runTrigger(env, true) : { action: "error", detail: "GITHUB_TOKEN secret is not set; configure it with `npx wrangler secret put GITHUB_TOKEN`.", at: (/* @__PURE__ */ new Date()).toISOString() };
    return Response.json({ worker: "pulsestatus-scheduler", tokenConfigured: hasToken, config: { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, workflow: env.WORKFLOW_FILE, ref: env.GITHUB_REF, cronMinutes: env.CRON_MINUTES }, report });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-y3QdzY/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-y3QdzY/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
