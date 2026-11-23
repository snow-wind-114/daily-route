import {
  createPasswordRecord,
  normalizePasswordRecord,
  PASSWORD_ITERATIONS,
  verifyPasswordRecord,
} from "./account.js";
import { createId } from "./schedule.js";

export const FOCUS_PROJECT_TYPES = Object.freeze(["focus", "rest"]);
export const FOCUS_SESSION_STORAGE_KEY = "daily-route.focus-session.v1";
export const FOCUS_PROJECT_MAX_MINUTES = 240;
export const FOCUS_FLOW_MAX_STEPS = 20;
export const FOCUS_MAX_WALLPAPERS = 12;

function cleanText(value, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.floor(number)
    : 0;
}

function validTimestamp(value, fallback) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : fallback;
}

export function emptyFocusState() {
  return {
    focusProjects: [],
    focusFlows: [],
    focusQuotes: [],
    focusWallpapers: [],
    focusPassword: null,
  };
}

export function normalizeFocusProject(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const title = cleanText(raw.title, 40);
  const type = FOCUS_PROJECT_TYPES.includes(raw.type)
    ? raw.type
    : "focus";
  const durationMinutes = Math.floor(Number(raw.durationMinutes));
  if (
    !title ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 1 ||
    durationMinutes > FOCUS_PROJECT_MAX_MINUTES
  ) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    title,
    type,
    durationMinutes,
    notes: cleanText(raw.notes),
    accumulatedSeconds: nonNegativeInteger(raw.accumulatedSeconds),
    completedRuns: nonNegativeInteger(raw.completedRuns),
    lastUsedAt:
      typeof raw.lastUsedAt === "string" &&
      !Number.isNaN(Date.parse(raw.lastUsedAt))
        ? raw.lastUsedAt
        : null,
    createdAt: validTimestamp(raw.createdAt, now),
    updatedAt: validTimestamp(raw.updatedAt, now),
  };
}

export function normalizeFocusProjects(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set();
  return raw
    .map(normalizeFocusProject)
    .filter((project) => {
      if (!project || seen.has(project.id)) {
        return false;
      }
      seen.add(project.id);
      return true;
    });
}

export function normalizeFocusFlow(raw, projects) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const title = cleanText(raw.title, 40);
  const projectMap = new Map(
    projects.map((project) => [project.id, project]),
  );
  const steps = [];
  for (const rawStep of Array.isArray(raw.steps) ? raw.steps : []) {
    const project = projectMap.get(rawStep?.projectId);
    const durationMinutes = Math.floor(Number(rawStep?.durationMinutes));
    if (
      !project ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 1 ||
      durationMinutes > FOCUS_PROJECT_MAX_MINUTES
    ) {
      continue;
    }
    steps.push({
      projectId: project.id,
      durationMinutes,
    });
    if (steps.length >= FOCUS_FLOW_MAX_STEPS) {
      break;
    }
  }
  if (!title || steps.length === 0) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createId(),
    title,
    notes: cleanText(raw.notes),
    steps,
    createdAt: validTimestamp(raw.createdAt, now),
    updatedAt: validTimestamp(raw.updatedAt, now),
  };
}

export function normalizeFocusFlows(raw, projects) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set();
  return raw
    .map((flow) => normalizeFocusFlow(flow, projects))
    .filter((flow) => {
      if (!flow || seen.has(flow.id)) {
        return false;
      }
      seen.add(flow.id);
      return true;
    });
}

export function normalizeFocusQuotes(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set();
  return raw
    .map((item) => {
      const text = cleanText(item?.text, 200);
      if (!text) {
        return null;
      }
      return {
        id:
          typeof item.id === "string" && item.id
            ? item.id
            : createId(),
        text,
        createdAt: validTimestamp(
          item.createdAt,
          new Date().toISOString(),
        ),
      };
    })
    .filter((item) => {
      if (!item || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
}

export function normalizeFocusWallpapers(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set();
  return raw
    .map((item) => {
      const name = cleanText(item?.name, 80);
      if (!name) {
        return null;
      }
      return {
        id:
          typeof item.id === "string" && item.id
            ? item.id
            : createId(),
        name,
        createdAt: validTimestamp(
          item.createdAt,
          new Date().toISOString(),
        ),
      };
    })
    .filter((item) => {
      if (!item || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    })
    .slice(0, FOCUS_MAX_WALLPAPERS);
}

export function normalizeFocusState(raw) {
  const focusProjects = normalizeFocusProjects(raw?.focusProjects);
  return {
    focusProjects,
    focusFlows: normalizeFocusFlows(raw?.focusFlows, focusProjects),
    focusQuotes: normalizeFocusQuotes(raw?.focusQuotes),
    focusWallpapers: normalizeFocusWallpapers(raw?.focusWallpapers),
    focusPassword: normalizePasswordRecord(raw?.focusPassword),
  };
}

export function validateFocusProjectInput(input) {
  if (!cleanText(input.title, 40)) {
    return "请填写专注项目名称";
  }
  if (!FOCUS_PROJECT_TYPES.includes(input.type)) {
    return "请选择专注或休息类型";
  }
  const minutes = Number(input.durationMinutes);
  if (
    !Number.isInteger(minutes) ||
    minutes < 1 ||
    minutes > FOCUS_PROJECT_MAX_MINUTES
  ) {
    return `专注时间必须是 1–${FOCUS_PROJECT_MAX_MINUTES} 分钟`;
  }
  return null;
}

export function focusProjectFromInput(input, existing = null) {
  const now = new Date().toISOString();
  return normalizeFocusProject({
    ...existing,
    ...input,
    id: existing?.id ?? createId(),
    accumulatedSeconds: existing?.accumulatedSeconds ?? 0,
    completedRuns: existing?.completedRuns ?? 0,
    lastUsedAt: existing?.lastUsedAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export function validateFocusFlowInput(input, projects) {
  if (!cleanText(input.title, 40)) {
    return "请填写流程名称";
  }
  const steps = Array.isArray(input.steps) ? input.steps : [];
  if (steps.length === 0) {
    return "请至少添加一个专注步骤";
  }
  if (steps.length > FOCUS_FLOW_MAX_STEPS) {
    return `一个流程最多 ${FOCUS_FLOW_MAX_STEPS} 个步骤`;
  }
  const projectIds = new Set(projects.map((project) => project.id));
  for (const step of steps) {
    const minutes = Number(step.durationMinutes);
    if (
      !projectIds.has(step.projectId) ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > FOCUS_PROJECT_MAX_MINUTES
    ) {
      return "流程步骤无效，请重新选择项目和时间";
    }
  }
  return null;
}

export function focusFlowFromInput(input, projects, existing = null) {
  const now = new Date().toISOString();
  return normalizeFocusFlow(
    {
      ...existing,
      ...input,
      id: existing?.id ?? createId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
    projects,
  );
}

export function projectsReferencingFlow(flows, projectId) {
  return flows.filter((flow) =>
    flow.steps.some((step) => step.projectId === projectId),
  );
}

export function focusTotalSeconds(projects) {
  return projects
    .filter((project) => project.type === "focus")
    .reduce(
      (total, project) => total + project.accumulatedSeconds,
      0,
    );
}

export function addFocusProjectTime(
  projects,
  projectId,
  seconds,
  { completed = false, now = new Date() } = {},
) {
  const elapsed = nonNegativeInteger(seconds);
  if (elapsed === 0 && !completed) {
    return projects;
  }
  const timestamp = now.toISOString();
  return projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          accumulatedSeconds:
            project.accumulatedSeconds + elapsed,
          completedRuns:
            project.completedRuns + (completed ? 1 : 0),
          lastUsedAt: timestamp,
          updatedAt: timestamp,
        }
      : project,
  );
}

export function focusFlowDurationMinutes(flow, projects) {
  const projectMap = new Map(
    projects.map((project) => [project.id, project]),
  );
  return flow.steps.reduce((total, step) => {
    const project = projectMap.get(step.projectId);
    return project ? total + step.durationMinutes : total;
  }, 0);
}

export function createFocusRun({
  project = null,
  flow = null,
  projects,
  now = new Date(),
}) {
  const projectMap = new Map(
    projects.map((item) => [item.id, item]),
  );
  const sourceSteps = flow
    ? flow.steps
    : project
      ? [{ projectId: project.id, durationMinutes: project.durationMinutes }]
      : [];
  const steps = sourceSteps.flatMap((step) => {
    const item = projectMap.get(step.projectId);
    if (!item) {
      return [];
    }
    return [
      {
        projectId: item.id,
        title: item.title,
        type: item.type,
        durationSeconds: Math.round(step.durationMinutes * 60),
      },
    ];
  });
  if (steps.length === 0) {
    return null;
  }
  const timestamp = now.toISOString();
  return {
    version: 1,
    id: createId(),
    title: flow?.title ?? project?.title ?? "专注",
    steps,
    stepIndex: 0,
    stepElapsedSeconds: 0,
    currentStepStartedAt: timestamp,
    status: "running",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function normalizeFocusSession(raw) {
  if (!raw || typeof raw !== "object" || raw.version !== 1) {
    return null;
  }
  const steps = [];
  for (const item of Array.isArray(raw.steps) ? raw.steps : []) {
    const durationSeconds = nonNegativeInteger(item?.durationSeconds);
    const title = cleanText(item?.title, 40);
    if (
      !title ||
      !FOCUS_PROJECT_TYPES.includes(item?.type) ||
      typeof item?.projectId !== "string" ||
      durationSeconds < 1
    ) {
      continue;
    }
    steps.push({
      projectId: item.projectId,
      title,
      type: item.type,
      durationSeconds,
    });
  }
  const stepIndex = Math.floor(Number(raw.stepIndex));
  if (
    steps.length === 0 ||
    !Number.isInteger(stepIndex) ||
    stepIndex < 0 ||
    stepIndex >= steps.length
  ) {
    return null;
  }
  const createdAt = validTimestamp(
    raw.createdAt,
    new Date().toISOString(),
  );
  return {
    version: 1,
    id:
      typeof raw.id === "string" && raw.id ? raw.id : createId(),
    title: cleanText(raw.title, 40) || "专注",
    steps,
    stepIndex,
    stepElapsedSeconds: Math.min(
      steps[stepIndex].durationSeconds,
      nonNegativeInteger(raw.stepElapsedSeconds),
    ),
    currentStepStartedAt:
      typeof raw.currentStepStartedAt === "string"
        ? raw.currentStepStartedAt
        : null,
    status: raw.status === "running" ? "running" : "paused",
    createdAt,
    updatedAt: validTimestamp(raw.updatedAt, createdAt),
  };
}

export function readFocusSession(storage = localStorage) {
  try {
    const stored = storage.getItem(FOCUS_SESSION_STORAGE_KEY);
    const session = stored
      ? normalizeFocusSession(JSON.parse(stored))
      : null;
    if (!session) {
      return null;
    }
    return {
      ...session,
      status: "paused",
      currentStepStartedAt: null,
    };
  } catch {
    return null;
  }
}

export function writeFocusSession(session, storage = localStorage) {
  storage.setItem(
    FOCUS_SESSION_STORAGE_KEY,
    JSON.stringify({ ...session, updatedAt: new Date().toISOString() }),
  );
}

export function clearFocusSession(storage = localStorage) {
  storage.removeItem(FOCUS_SESSION_STORAGE_KEY);
}

export function validateFocusPassword(password, confirmation) {
  if (password.length < 4 || password.length > 64) {
    return "专注密码必须是 4–64 个字符";
  }
  if (confirmation !== undefined && password !== confirmation) {
    return "两次输入的专注密码不一致";
  }
  return null;
}

export function createFocusPassword(password, options) {
  const error = validateFocusPassword(password);
  if (error) {
    throw new Error(error);
  }
  return createPasswordRecord(password, {
    iterations: PASSWORD_ITERATIONS,
    ...options,
  });
}

export function verifyFocusPassword(passwordRecord, password, options) {
  return passwordRecord
    ? verifyPasswordRecord(passwordRecord, password, options)
    : Promise.resolve(true);
}
