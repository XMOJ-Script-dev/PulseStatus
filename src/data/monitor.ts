import type { ServiceStatus } from '../types/status';

export interface CheckResult { ok: boolean; statusCode: number | null; latencyMs: number | null; errorKind?: string }
export interface MonitorState { consecutiveFailures: number; consecutiveSuccesses: number; status: ServiceStatus }

export function applyCheck(state: MonitorState, result: CheckResult, failuresToDown: number, successesToRecover: number): MonitorState {
  if (result.ok) {
    const successes = state.consecutiveSuccesses + 1;
    return { consecutiveFailures: 0, consecutiveSuccesses: successes, status: successes >= successesToRecover ? 'operational' : state.status };
  }
  const failures = state.consecutiveFailures + 1;
  return { consecutiveFailures: failures, consecutiveSuccesses: 0, status: failures >= failuresToDown ? 'down' : state.status };
}

export function effectiveMonitorMode(globalMode: 'scheduled' | 'manual' | 'hybrid', serviceMode?: 'scheduled' | 'manual' | 'hybrid'): 'scheduled' | 'manual' | 'hybrid' {
  return serviceMode ?? globalMode;
}
