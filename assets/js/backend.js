const config = window.INTERVIEWPLUS_CONFIG || {
  backendMode: "local",
  supabaseUrl: "",
  supabaseAnonKey: "",
};

const SERVER_TOKEN_KEY = "interviewplus-server-token";
let supabaseClient = null;

export function isRemoteBackendEnabled() {
  return isServerBackendEnabled() || isSupabaseBackendEnabled();
}

function isServerBackendEnabled() {
  return config.backendMode === "server";
}

function isSupabaseBackendEnabled() {
  return (
    config.backendMode === "supabase" &&
    Boolean(config.supabaseUrl) &&
    Boolean(config.supabaseAnonKey)
  );
}

export async function getSupabaseClient() {
  if (!isSupabaseBackendEnabled()) {
    return null;
  }
  if (supabaseClient) {
    return supabaseClient;
  }

  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabaseClient;
}

export async function downloadPrivateQuestionWorkbook() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("PRIVATE_STORAGE_NOT_CONFIGURED");
  }

  const bucket = config.privateQuestionBucket || "interviewplus-private";
  const objectPath = config.privateQuestionPath || "Questions_InterviewPlus_Bilingual.xlsx";
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw error || new Error("PRIVATE_QUESTION_FILE_UNAVAILABLE");
  }
  return data.arrayBuffer();
}

export async function getRemoteSession() {
  if (isServerBackendEnabled()) {
    const token = getServerToken();
    return token ? { access_token: token } : null;
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function getRemoteCurrentUser() {
  if (isServerBackendEnabled()) {
    const token = getServerToken();
    if (!token) return null;
    try {
      const data = await serverFetch("/api/me", { method: "GET" });
      return data.user || null;
    } catch (error) {
      clearServerToken();
      return null;
    }
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: authorization, error: authorizationError } = await supabase
    .from("authorized_users")
    .select("email,full_name,active")
    .eq("email", String(user.email || "").toLowerCase())
    .eq("active", true)
    .maybeSingle();

  if (authorizationError || !authorization) {
    await supabase.auth.signOut();
    throw new Error("ACCESS_NOT_AUTHORIZED");
  }

  let profile = null;
  try {
    const { data } = await supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle();
    profile = data;
  } catch (error) {
    profile = null;
  }

  return {
    id: user.id,
    email: profile?.email || user.email || "",
    name: authorization.full_name || profile?.full_name || user.user_metadata?.name || user.email || "Utilisateur",
    createdAt: user.created_at,
  };
}

export async function remoteSignUp({ name, email, password }) {
  if (isServerBackendEnabled()) {
    const data = await serverFetch("/api/auth/signup", {
      method: "POST",
      body: { name, email, password },
      skipAuth: true,
    });
    setServerToken(data.token);
    return {
      user: data.user,
      session: { access_token: data.token },
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
      },
    },
  });

  if (error) {
    throw error;
  }

  return {
    user: data.user,
    session: data.session,
  };
}

export async function remoteSignIn({ email, password }) {
  if (isServerBackendEnabled()) {
    const data = await serverFetch("/api/auth/signin", {
      method: "POST",
      body: { email, password },
      skipAuth: true,
    });
    setServerToken(data.token);
    return {
      user: data.user,
      session: { access_token: data.token },
    };
  }

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function remoteSignOut() {
  if (isServerBackendEnabled()) {
    try {
      await serverFetch("/api/auth/signout", { method: "POST" });
    } catch {
      // A local sign-out must still succeed if the server is temporarily unavailable.
    }
    clearServerToken();
    return;
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    return;
  }
  await supabase.auth.signOut();
}

export async function remoteRequestPasswordReset(email) {
  if (isServerBackendEnabled()) {
    throw new Error("PASSWORD_RESET_NOT_AVAILABLE_ON_LOCAL_SERVER");
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("REMOTE_BACKEND_DISABLED");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth.html`,
  });

  if (error) {
    throw error;
  }
}

export async function listRemoteSessions(userId) {
  if (isServerBackendEnabled()) {
    const data = await serverFetch("/api/sessions", { method: "GET" });
    return (data.sessions || []).map(mapServerSession);
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("session_runs")
    .select("*")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data || []).map(mapRemoteSession);
}

export async function upsertRemoteSession(session) {
  if (isServerBackendEnabled()) {
    const data = await serverFetch("/api/sessions", {
      method: "POST",
      body: { session },
    });
    return mapServerSession(data.session);
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const payload = toRemoteSessionRow(session);

  const { data, error } = await supabase
    .from("session_runs")
    .upsert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapRemoteSession(data);
}

function mapServerSession(session) {
  return {
    ...session,
    status: session.status || "review",
    sourceLabel: session.sourceLabel || "Questions_InterviewPlus.xlsx",
    questions: Array.isArray(session.questions) ? session.questions : [],
  };
}

async function serverFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  const token = getServerToken();
  if (token && !options.skipAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "SERVER_REQUEST_FAILED");
  }
  return data;
}

function getServerToken() {
  return localStorage.getItem(SERVER_TOKEN_KEY);
}

function setServerToken(token) {
  if (token) {
    localStorage.setItem(SERVER_TOKEN_KEY, token);
  }
}

function clearServerToken() {
  localStorage.removeItem(SERVER_TOKEN_KEY);
}

export function toRemoteSessionRow(session) {
  const isCase = session.sessionType === "case";
  const { grade, ...caseJson } = isCase && session.caseData && typeof session.caseData === "object" ? session.caseData : {};
  return {
    id: session.id,
    user_id: session.userId,
    theme: session.config.theme,
    question_count: session.config.questionCount,
    timer_minutes: session.config.timerMinutes,
    global_score: session.globalScore,
    session_type: isCase ? "case" : "questions",
    difficulty: session.config.difficulty || null,
    template_id: isCase ? caseJson.templateId || null : null,
    case_seed: isCase ? caseJson.seed ?? null : null,
    case_json: isCase ? caseJson : null,
    score_json: isCase && grade ? grade : {},
    correction_mode: session.correctionMode || null,
    correction_provider: session.correctionProvider || null,
    correction_model: session.correctionModel || null,
    questions_json: isCase ? [] : session.questions,
    session_json: structuredClone(session),
    started_at: session.startedAt,
    completed_at: session.completedAt,
  };
}

export function mapRemoteSession(row) {
  if (row.session_json && typeof row.session_json === "object" && !Array.isArray(row.session_json)) {
    return structuredClone(row.session_json);
  }
  const isCase = row.session_type === "case";
  const caseJson = row.case_json && typeof row.case_json === "object" && !Array.isArray(row.case_json) ? row.case_json : {};
  const scoreJson = row.score_json && typeof row.score_json === "object" && !Array.isArray(row.score_json) ? row.score_json : {};
  const questions = isCase ? [] : (Array.isArray(row.questions_json) ? row.questions_json : []);
  return {
    id: row.id,
    userId: row.user_id,
    sourceLabel: isCase ? "Cas pratiques" : "Questions_InterviewPlus.xlsx",
    sessionType: isCase ? "case" : "questions",
    status: "review",
    startedAt: row.started_at,
    completedAt: row.completed_at,
    currentIndex: 0,
    globalScore: row.global_score,
    correctionMode: row.correction_mode || null,
    correctionProvider: row.correction_provider || null,
    correctionModel: row.correction_model || null,
    config: {
      theme: row.theme,
      ...(row.difficulty ? { difficulty: row.difficulty } : {}),
      ...(!isCase ? { questionLanguage: questions[0]?.language || "en" } : {}),
      questionCount: row.question_count,
      timerMinutes: row.timer_minutes,
    },
    questions,
    ...(isCase ? {
      caseData: {
        ...caseJson,
        templateId: row.template_id || caseJson.templateId,
        difficulty: row.difficulty || caseJson.difficulty,
        seed: row.case_seed ?? caseJson.seed,
        grade: Object.keys(scoreJson).length ? scoreJson : (caseJson.grade || null),
      },
    } : {}),
  };
}
