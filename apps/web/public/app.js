const apiBaseUrl = "http://127.0.0.1:4000";
const app = document.querySelector("#app");

const state = {
  user: null,
  loading: true,
  error: "",
  parsePollTimer: null
};

window.addEventListener("popstate", () => render());

await bootstrap();

async function bootstrap() {
  state.loading = true;
  renderLoading();
  try {
    state.user = await fetchCurrentUser();
  } catch {
    state.user = null;
  } finally {
    state.loading = false;
    render();
  }
}

function render() {
  const path = window.location.pathname;

  if (path === "/signup") {
    renderSignup();
    return;
  }

  if (path === "/login") {
    renderLogin();
    return;
  }

  if (path === "/resumes/upload") {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderUploadPage();
    return;
  }

  if (path === "/resumes") {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderResumeList();
    return;
  }

  if (path === "/jobs/new") {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderJobDescriptionUpload();
    return;
  }

  if (path === "/jobs") {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderJobDescriptionList();
    return;
  }

  if (path === "/matches/new") {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderMatchRunner();
    return;
  }

  const readinessPreviewMatch = /^\/readiness\/([^/]+)$/.exec(path);
  if (readinessPreviewMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderReadinessReport(readinessPreviewMatch[1]);
    return;
  }

  const optimizationPreviewMatch = /^\/optimizations\/([^/]+)$/.exec(path);
  if (optimizationPreviewMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderOptimizationReview(optimizationPreviewMatch[1]);
    return;
  }

  const resumeVersionsMatch = /^\/resumes\/([^/]+)\/versions$/.exec(path);
  if (resumeVersionsMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderVersionHistory(resumeVersionsMatch[1]);
    return;
  }

  if (path === "/applications") {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderApplicationList();
    return;
  }

  const applicationPreviewMatch = /^\/applications\/([^/]+)$/.exec(path);
  if (applicationPreviewMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderApplicationDetail(applicationPreviewMatch[1]);
    return;
  }

  const versionPreviewMatch = /^\/versions\/([^/]+)$/.exec(path);
  if (versionPreviewMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderVersionDetail(versionPreviewMatch[1]);
    return;
  }

  const matchReportPreviewMatch = /^\/matches\/([^/]+)$/.exec(path);
  if (matchReportPreviewMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderMatchReport(matchReportPreviewMatch[1]);
    return;
  }

  const jobPreviewMatch = /^\/jobs\/([^/]+)$/.exec(path);
  if (jobPreviewMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderJobDescriptionPreview(jobPreviewMatch[1]);
    return;
  }

  const previewMatch = /^\/resumes\/([^/]+)\/parsed-draft$/.exec(path);
  if (previewMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderParsedDraft(previewMatch[1]);
    return;
  }

  const reviewMatch = /^\/resumes\/([^/]+)\/review$/.exec(path);
  if (reviewMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderDraftReview(reviewMatch[1]);
    return;
  }

  const editMatch = /^\/resumes\/([^/]+)\/edit$/.exec(path);
  if (editMatch) {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderResumeEditor(editMatch[1]);
    return;
  }

  if (path === "/dashboard" || path === "/") {
    if (!state.user) {
      navigate("/login", true);
      return;
    }
    renderDashboard();
    return;
  }

  navigate(state.user ? "/dashboard" : "/login", true);
}

function renderLoading() {
  app.innerHTML = `
    <section class="panel">
      <p class="eyebrow">TailorStack</p>
      <h1>Loading</h1>
      <p>Checking your session.</p>
    </section>
  `;
}

function renderLogin() {
  app.innerHTML = authLayout({
    title: "Log in",
    body: `
      ${errorHtml()}
      <form id="login-form" class="stack">
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" required></label>
        <div class="actions">
          <button type="submit">Log in</button>
          <a class="link-button secondary" href="/signup" data-link>Create account</a>
        </div>
      </form>
    `
  });

  bindLinks();
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuthForm(event.target, "/v1/auth/login");
  });
}

function renderSignup() {
  app.innerHTML = authLayout({
    title: "Create account",
    body: `
      ${errorHtml()}
      <form id="signup-form" class="stack">
        <label>Name<input name="displayName" type="text" autocomplete="name"></label>
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <div class="actions">
          <button type="submit">Create account</button>
          <a class="link-button secondary" href="/login" data-link>Log in</a>
        </div>
      </form>
    `
  });

  bindLinks();
  document.querySelector("#signup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAuthForm(event.target, "/v1/auth/signup");
  });
}

function renderDashboard() {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack">
      <p class="eyebrow">Dashboard</p>
      <h1>Welcome${state.user.displayName ? `, ${escapeHtml(state.user.displayName)}` : ""}</h1>
      <p>You are signed in as ${escapeHtml(state.user.email)}.</p>
      <div class="actions">
        <a class="link-button" href="/resumes/upload" data-link>Upload master resume</a>
        <a class="link-button secondary" href="/resumes" data-link>View resumes</a>
        <a class="link-button secondary" href="/jobs/new" data-link>Paste job description</a>
        <a class="link-button secondary" href="/matches/new" data-link>Run match</a>
        <a class="link-button secondary" href="/applications" data-link>Applications</a>
      </div>
    </section>
  `;

  bindAuthenticatedChrome();
}

function renderUploadPage() {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack">
      <p class="eyebrow">Master Resume</p>
      <h1>Upload PDF</h1>
      ${errorHtml()}
      <form id="upload-form" class="stack">
        <label>Resume title<input name="title" type="text" placeholder="Master Resume"></label>
        <label>PDF file<input name="file" type="file" accept="application/pdf,.pdf" required></label>
        <div class="actions">
          <button type="submit">Upload</button>
          <a class="link-button secondary" href="/resumes" data-link>Cancel</a>
        </div>
      </form>
      <div id="upload-status"></div>
    </section>
  `;

  bindLinks();
  bindAuthenticatedChrome();
  document.querySelector("#upload-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitResumeUpload(event.target);
  });
}

async function renderResumeList() {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack">
      <p class="eyebrow">Resumes</p>
      <h1>Uploaded resumes</h1>
      <div class="actions">
        <a class="link-button" href="/resumes/upload" data-link>Upload PDF</a>
      </div>
      <div id="resume-list">Loading resumes.</div>
    </section>
  `;

  bindLinks();
  bindAuthenticatedChrome();
  try {
    const response = await apiFetch("/v1/resumes");
    const resumes = response.data.resumes;
    document.querySelector("#resume-list").innerHTML = resumes.length
      ? `<div class="list">${resumes.map(resumeListItem).join("")}</div>`
      : "<p>No resumes uploaded yet.</p>";
  } catch (error) {
    document.querySelector("#resume-list").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

function renderJobDescriptionUpload() {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Job Intelligence</p>
      <h1>Paste Job Description</h1>
      ${errorHtml()}
      <form id="job-description-form" class="stack">
        <label>Job description<textarea name="rawText" rows="14" required placeholder="Paste the full job description"></textarea></label>
        <label>Upload JD Text<input id="job-text-file" type="file" accept="text/plain,.txt"></label>
        <div class="actions">
          <button type="submit">Parse job</button>
          <a class="link-button secondary" href="/jobs" data-link>View jobs</a>
        </div>
      </form>
      <div id="job-preview"></div>
    </section>
  `;

  bindAuthenticatedChrome();
  document.querySelector("#job-text-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    document.querySelector("textarea[name='rawText']").value = await file.text();
  });
  document.querySelector("#job-description-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitJobDescription(event.target);
  });
}

async function submitJobDescription(form) {
  const button = form.querySelector("button");
  const preview = document.querySelector("#job-preview");
  button.disabled = true;
  preview.innerHTML = "<p>Parsing job description.</p>";
  try {
    const payload = Object.fromEntries(new FormData(form));
    const response = await apiFetch("/v1/job-descriptions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    preview.innerHTML = jobDescriptionPreviewHtml(response.data);
    bindLinks();
  } catch (error) {
    preview.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  } finally {
    button.disabled = false;
  }
}

async function renderJobDescriptionList() {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack">
      <p class="eyebrow">Job Intelligence</p>
      <h1>Job descriptions</h1>
      <div class="actions">
        <a class="link-button" href="/jobs/new" data-link>Paste JD</a>
      </div>
      <div id="job-list">Loading jobs.</div>
    </section>
  `;

  bindAuthenticatedChrome();
  try {
    const response = await apiFetch("/v1/job-descriptions");
    document.querySelector("#job-list").innerHTML = response.data.jobDescriptions.length
      ? `<div class="list">${response.data.jobDescriptions.map(jobListItem).join("")}</div>`
      : "<p>No job descriptions parsed yet.</p>";
    bindLinks();
  } catch (error) {
    document.querySelector("#job-list").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderJobDescriptionPreview(jobDescriptionId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Job Intelligence</p>
      <h1>Structured Preview</h1>
      <div id="job-preview">Loading job model.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  try {
    const response = await apiFetch(`/v1/job-descriptions/${jobDescriptionId}`);
    document.querySelector("#job-preview").innerHTML = jobDescriptionPreviewHtml(response.data);
    bindLinks();
  } catch (error) {
    document.querySelector("#job-preview").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderMatchRunner() {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Resume Matching</p>
      <h1>Run Match</h1>
      <form id="match-form" class="stack">
        <label>Canonical resume<select name="resumeId" required></select></label>
        <label>Job description<select name="jobDescriptionId" required></select></label>
        <div class="actions">
          <button type="submit">Generate match report</button>
          <a class="link-button secondary" href="/jobs" data-link>Cancel</a>
        </div>
      </form>
      <div id="match-status"></div>
    </section>
  `;
  bindAuthenticatedChrome();
  const params = new URLSearchParams(window.location.search);
  const [resumesResponse, jobsResponse] = await Promise.all([
    apiFetch("/v1/resumes"),
    apiFetch("/v1/job-descriptions")
  ]);
  const resumes = resumesResponse.data.resumes.filter((resume) => resume.status === "active");
  const jobs = jobsResponse.data.jobDescriptions;
  document.querySelector("select[name='resumeId']").innerHTML = resumes.length
    ? resumes.map((resume) => `<option value="${resume.id}">${escapeHtml(resume.title)}</option>`).join("")
    : `<option value="">No active canonical resumes</option>`;
  document.querySelector("select[name='jobDescriptionId']").innerHTML = jobs.length
    ? jobs.map((job) => `<option value="${job.id}">${escapeHtml(job.position ?? "Untitled role")} - ${escapeHtml(job.company ?? "Unknown")}</option>`).join("")
    : `<option value="">No parsed job descriptions</option>`;
  if (params.get("jobDescriptionId")) document.querySelector("select[name='jobDescriptionId']").value = params.get("jobDescriptionId");
  document.querySelector("#match-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitMatch(event.target);
  });
}

async function submitMatch(form) {
  const status = document.querySelector("#match-status");
  const button = form.querySelector("button");
  button.disabled = true;
  status.innerHTML = "<p>Generating match report.</p>";
  try {
    const response = await apiFetch("/v1/match-reports", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    navigate(`/matches/${response.data.report.id}`, true);
  } catch (error) {
    status.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  } finally {
    button.disabled = false;
  }
}

async function renderMatchReport(matchReportId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Resume Matching</p>
      <h1>Match Result</h1>
      <div id="match-report">Loading match report.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  try {
    const response = await apiFetch(`/v1/match-reports/${matchReportId}`);
    document.querySelector("#match-report").innerHTML = matchReportHtml(response.data);
    bindLinks();
    document.querySelector("#generate-readiness")?.addEventListener("click", async () => {
      await submitReadiness(matchReportId);
    });
  } catch (error) {
    document.querySelector("#match-report").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function submitReadiness(matchReportId) {
  const container = document.querySelector("#match-report");
  container.innerHTML = "<p>Generating readiness report.</p>";
  try {
    const response = await apiFetch("/v1/readiness-reports", {
      method: "POST",
      body: JSON.stringify({ matchReportId })
    });
    navigate(`/readiness/${response.data.report.id}`, true);
  } catch (error) {
    container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderReadinessReport(readinessReportId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Application Readiness</p>
      <h1>Readiness Report</h1>
      <div id="readiness-report">Loading readiness report.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  try {
    const response = await apiFetch(`/v1/readiness-reports/${readinessReportId}`);
    document.querySelector("#readiness-report").innerHTML = readinessReportHtml(response.data);
    bindLinks();
    document.querySelector("#generate-patch-set")?.addEventListener("click", async () => {
      await submitPatchSet(readinessReportId);
    });
  } catch (error) {
    document.querySelector("#readiness-report").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function submitPatchSet(readinessReportId) {
  const container = document.querySelector("#readiness-report");
  container.innerHTML = "<p>Generating optimization patch set.</p>";
  try {
    const response = await apiFetch("/v1/optimization-patch-sets", {
      method: "POST",
      body: JSON.stringify({ readinessReportId })
    });
    navigate(`/optimizations/${response.data.patchSet.id}`, true);
  } catch (error) {
    container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderOptimizationReview(patchSetId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Optimization Review</p>
      <h1>Optimization Review</h1>
      <div id="optimization-review">Loading optimization patch set.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  await loadOptimizationReview(patchSetId);
}

async function loadOptimizationReview(patchSetId) {
  const container = document.querySelector("#optimization-review");
  try {
    const response = await apiFetch(`/v1/optimization-patch-sets/${patchSetId}`);
    container.innerHTML = optimizationReviewHtml(response.data);
    bindLinks();
    bindOptimizationReviewActions(patchSetId);
  } catch (error) {
    container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

function bindOptimizationReviewActions(patchSetId) {
  for (const button of document.querySelectorAll("[data-review-patch]")) {
    button.addEventListener("click", async () => {
      await apiFetch(`/v1/optimization-patches/${button.dataset.reviewPatch}/review`, {
        method: "POST",
        body: JSON.stringify({ state: button.dataset.state })
      });
      await loadOptimizationReview(patchSetId);
    });
  }
  for (const button of document.querySelectorAll("[data-review-all]")) {
    button.addEventListener("click", async () => {
      await apiFetch(`/v1/optimization-patch-sets/${patchSetId}/review`, {
        method: "POST",
        body: JSON.stringify({ state: button.dataset.reviewAll })
      });
      await loadOptimizationReview(patchSetId);
    });
  }
  document.querySelector("#create-version")?.addEventListener("click", async () => {
    await createVersionFromPatchSet(patchSetId);
  });
}

async function createVersionFromPatchSet(patchSetId) {
  const container = document.querySelector("#optimization-review");
  container.innerHTML = "<p>Creating immutable resume version.</p>";
  try {
    const response = await apiFetch("/v1/resume-versions", {
      method: "POST",
      body: JSON.stringify({ patchSetId })
    });
    navigate(`/versions/${response.data.version.id}`, true);
  } catch (error) {
    container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderVersionHistory(resumeId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Version History</p>
      <h1>Version History</h1>
      <div id="version-history">Loading versions.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  try {
    const response = await apiFetch(`/v1/resumes/${resumeId}/versions`);
    document.querySelector("#version-history").innerHTML = response.data.versions.length
      ? `<div class="list">${response.data.versions.map(versionListItem).join("")}</div>`
      : "<p>No versions available.</p>";
    bindLinks();
  } catch (error) {
    document.querySelector("#version-history").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderVersionDetail(versionId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Resume Version</p>
      <h1>Diff Viewer</h1>
      <div id="version-detail">Loading version.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  try {
    const response = await apiFetch(`/v1/resume-versions/${versionId}`);
    document.querySelector("#version-detail").innerHTML = versionDetailHtml(response.data);
    bindLinks();
    bindDownloadButtons(response.data.renderedResumes);
    bindApplicationCreateForm(versionId, response.data);
  } catch (error) {
    document.querySelector("#version-detail").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderApplicationList() {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Application Workspace</p>
      <h1>Applications</h1>
      <div id="application-list">Loading applications.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  try {
    const response = await apiFetch("/v1/applications");
    document.querySelector("#application-list").innerHTML = response.data.applications.length
      ? `<div class="list">${response.data.applications.map(applicationListItem).join("")}</div>`
      : "<p>No application workspaces yet.</p>";
    bindLinks();
  } catch (error) {
    document.querySelector("#application-list").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function renderApplicationDetail(applicationId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Application Workspace</p>
      <h1>Application Detail</h1>
      <div id="application-detail">Loading application.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  await loadApplicationDetail(applicationId);
}

async function loadApplicationDetail(applicationId) {
  const container = document.querySelector("#application-detail");
  try {
    const response = await apiFetch(`/v1/applications/${applicationId}`);
    container.innerHTML = applicationDetailHtml(response.data);
    bindLinks();
    bindApplicationActions(applicationId);
    bindApplicationArtifactDownloads();
  } catch (error) {
    container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

function bindApplicationArtifactDownloads() {
  for (const button of document.querySelectorAll("[data-download-render]")) {
    button.addEventListener("click", async () => {
      const response = await apiFetch(`/v1/rendered-resumes/${button.dataset.downloadRender}`);
      const blob = new Blob([response.data.content], { type: response.data.renderedResume.contentType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `application-resume.${button.dataset.format}`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}

function bindApplicationActions(applicationId) {
  document.querySelector("#application-status-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target));
    await apiFetch(`/v1/applications/${applicationId}/status`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    await loadApplicationDetail(applicationId);
  });
  document.querySelector("#application-note-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target));
    await apiFetch(`/v1/applications/${applicationId}/notes`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    event.target.reset();
    await loadApplicationDetail(applicationId);
  });
}

function bindApplicationCreateForm(versionId, data) {
  document.querySelector("#application-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = Object.fromEntries(new FormData(event.target));
    const renderedResumeId = data.renderedResumes.find((artifact) => artifact.format === "pdf")?.id ?? data.renderedResumes[0]?.id ?? null;
    const response = await apiFetch("/v1/applications", {
      method: "POST",
      body: JSON.stringify({
        company: formData.company,
        position: formData.position,
        resumeVersionId: versionId,
        renderedResumeId,
        optimizationPatchSetId: data.version.metadata?.patchSetId ?? data.version.metadata?.[legacyPatchSetMetadataKey()] ?? null
      })
    });
    navigate(`/applications/${response.data.application.id}`, true);
  });
}

function bindDownloadButtons(artifacts) {
  for (const button of document.querySelectorAll("[data-download-render]")) {
    button.addEventListener("click", async () => {
      const response = await apiFetch(`/v1/rendered-resumes/${button.dataset.downloadRender}`);
      const artifact = artifacts.find((item) => item.id === button.dataset.downloadRender);
      const blob = new Blob([response.data.content], { type: artifact?.contentType ?? "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resume-${button.dataset.format}.${button.dataset.format}`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}

async function submitResumeUpload(form) {
  const button = form.querySelector("button");
  const status = document.querySelector("#upload-status");
  button.disabled = true;
  state.error = "";
  status.innerHTML = "<p>Uploading PDF.</p>";

  try {
    const formData = new FormData(form);
    const response = await apiFetch("/v1/resumes/uploads", {
      method: "POST",
      body: formData,
      skipJsonContentType: true
    });
    status.innerHTML = `
      <div class="success">
        <strong>Upload complete.</strong>
        <p>Status: ${escapeHtml(response.data.resume.status)}</p>
        <p>Parse job: ${escapeHtml(response.data.parseJob.status)}</p>
      </div>
    `;
    await refreshUploadStatus(response.data.resume.id);
  } catch (error) {
    state.error = error.message;
    status.innerHTML = `
      <div class="error">${escapeHtml(error.message)}</div>
      <div class="actions"><button id="retry-upload" class="secondary" type="button">Retry upload</button></div>
    `;
    document.querySelector("#retry-upload").addEventListener("click", () => {
      state.error = "";
      status.innerHTML = "";
      form.reset();
    });
  } finally {
    button.disabled = false;
  }
}

async function refreshUploadStatus(resumeId) {
  const status = document.querySelector("#upload-status");
  const response = await apiFetch(`/v1/resumes/${resumeId}/upload-status`);
  status.innerHTML += `
    <div class="status-row">
      <p>Upload status: ${escapeHtml(response.data.uploadedFile.status)}</p>
      <p>Queued job: ${escapeHtml(response.data.parseJob.status)}</p>
      <div class="actions">
        <button id="run-parser-button" type="button">Run parser</button>
        <a class="link-button secondary" href="/resumes/${resumeId}/parsed-draft" data-link>View parse status</a>
      </div>
    </div>
  `;
  bindLinks();
  document.querySelector("#run-parser-button")?.addEventListener("click", async () => {
    await runParser(response.data.parseJob.id, resumeId, status);
  });
}

async function renderParsedDraft(resumeId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Parsed Draft</p>
      <h1>Read-only preview</h1>
      <div id="parse-preview">Loading parser status.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  await loadParsedDraft(resumeId);
}

async function loadParsedDraft(resumeId) {
  const preview = document.querySelector("#parse-preview");
  try {
    const response = await apiFetch(`/v1/resumes/${resumeId}/parsed-draft`);
    preview.innerHTML = parsedDraftHtml(response.data);
    document.querySelector("#preview-run-parser")?.addEventListener("click", async () => {
      await runParser(response.data.parseJob.id, resumeId, preview);
    });
    document.querySelector("#preview-retry-parser")?.addEventListener("click", async () => {
      await apiFetch(`/v1/parse-jobs/${response.data.parseJob.id}/retry`, { method: "POST" });
      await loadParsedDraft(resumeId);
    });
    document.querySelector("#parse-progress-retry")?.addEventListener("click", async () => {
      await apiFetch(`/v1/parse-jobs/${response.data.parseJob.id}/retry`, { method: "POST" });
      await runParser(response.data.parseJob.id, resumeId, preview);
    });
    if (response.data.parseJob?.status === "running") {
      await pollParseProgress(resumeId, preview);
    }
  } catch (error) {
    preview.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function runParser(jobId, resumeId, container) {
  clearParsePolling();
  container.innerHTML = `<p>Loading parser status.</p>`;
  apiFetch(`/v1/parse-jobs/${jobId}/run`, { method: "POST" }).catch(() => {});
  await pollParseProgress(resumeId, container);
}

async function renderDraftReview(resumeId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Draft Review</p>
      <h1>Review parsed draft</h1>
      <div id="draft-review">Loading draft.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  await loadDraftReview(resumeId);
}

async function loadDraftReview(resumeId) {
  const container = document.querySelector("#draft-review");
  try {
    const response = await apiFetch(`/v1/resumes/${resumeId}/draft-review`);
    container.innerHTML = draftReviewHtml(response.data);
    bindLinks();
    document.querySelector("#approve-draft")?.addEventListener("click", async () => {
      await approveDraft(resumeId, container);
    });
    document.querySelector("#reject-draft")?.addEventListener("click", async () => {
      await apiFetch(`/v1/resumes/${resumeId}/reject-draft`, { method: "POST" });
      navigate("/resumes", true);
    });
    document.querySelector("#rerun-parser")?.addEventListener("click", async () => {
      await apiFetch(`/v1/parse-jobs/${response.data.parseJob.id}/retry`, { method: "POST" });
      await runParser(response.data.parseJob.id, resumeId, container);
    });
  } catch (error) {
    container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

async function approveDraft(resumeId, container) {
  container.innerHTML = "<p>Promoting draft.</p>";
  try {
    const response = await apiFetch(`/v1/resumes/${resumeId}/promote`, { method: "POST" });
    container.innerHTML = `
      <div class="success">
        <strong>Canonical resume created.</strong>
        <p>Initial version: ${escapeHtml(response.data.version.name)}</p>
        <p>Empty diff operations: ${escapeHtml(response.data.diff.operationCount)}</p>
      </div>
      <div class="actions">
        <a class="link-button" href="/resumes/${resumeId}/edit" data-link>Edit canonical resume</a>
        <a class="link-button" href="/resumes" data-link>Back to resumes</a>
      </div>
    `;
    bindLinks();
  } catch (error) {
    container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

function authLayout({ title, body }) {
  return `
    <section class="panel stack">
      <p class="eyebrow">TailorStack</p>
      <h1>${title}</h1>
      ${body}
    </section>
  `;
}

async function submitAuthForm(form, path) {
  const button = form.querySelector("button");
  button.disabled = true;
  state.error = "";
  try {
    const payload = Object.fromEntries(new FormData(form));
    const response = await apiFetch(path, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.user = response.data.user;
    navigate("/dashboard", true);
  } catch (error) {
    state.error = error.message;
    render();
  } finally {
    button.disabled = false;
  }
}

async function fetchCurrentUser() {
  const response = await apiFetch("/v1/auth/me");
  return response.data.user;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.skipJsonContentType ? {} : { "content-type": "application/json" }),
      ...(options.headers ?? {})
    }
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? body.error?.message ?? "Request failed");
  }
  return body;
}

function navigate(path, replace = false) {
  clearParsePolling();
  if (replace) {
    window.history.replaceState({}, "", path);
  } else {
    window.history.pushState({}, "", path);
  }
  render();
}

function bindLinks() {
  for (const link of document.querySelectorAll("[data-link]")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      state.error = "";
      navigate(link.getAttribute("href"));
    });
  }
}

function bindAuthenticatedChrome() {
  bindLinks();
  document.querySelector("#logout-button")?.addEventListener("click", async () => {
    await apiFetch("/v1/auth/logout", { method: "POST" });
    state.user = null;
    state.error = "";
    navigate("/login", true);
  });
}

function topbar() {
  return `
    <header class="topbar">
      <a class="brand" href="/dashboard" data-link>TailorStack</a>
      <nav class="nav">
        <a href="/resumes" data-link>Resumes</a>
        <a href="/jobs" data-link>Jobs</a>
        <a href="/matches/new" data-link>Matches</a>
        <a href="/applications" data-link>Applications</a>
        <button id="logout-button" class="secondary" type="button">Log out</button>
      </nav>
    </header>
  `;
}

function resumeListItem(resume) {
  return `
    <article class="list-item">
      <strong>${escapeHtml(resume.title)}</strong>
      <p>Status: ${escapeHtml(resume.status)}</p>
      <p>Created: ${escapeHtml(new Date(resume.createdAt).toLocaleString())}</p>
      <div class="actions">
        <a class="link-button secondary" href="/resumes/${resume.id}/parsed-draft" data-link>Parse status</a>
        ${resume.status === "review_required" ? `<a class="link-button" href="/resumes/${resume.id}/review" data-link>Review draft</a>` : ""}
        ${resume.status === "active" ? `<a class="link-button" href="/resumes/${resume.id}/edit" data-link>Edit</a>` : ""}
        ${resume.status === "active" ? `<a class="link-button secondary" href="/resumes/${resume.id}/versions" data-link>Versions</a>` : ""}
      </div>
    </article>
  `;
}

function jobListItem(job) {
  return `
    <article class="list-item">
      <strong>${escapeHtml(job.position ?? "Untitled role")}</strong>
      <p>${escapeHtml(job.company ?? "Unknown company")}</p>
      <p>Confidence: ${formatConfidence(job.parseConfidence)}</p>
      <div class="actions">
        <a class="link-button secondary" href="/jobs/${job.id}" data-link>Preview</a>
        <a class="link-button secondary" href="/matches/new?jobDescriptionId=${job.id}" data-link>Run match</a>
      </div>
    </article>
  `;
}

function applicationListItem(application) {
  return `
    <article class="list-item">
      <strong>${escapeHtml(application.company)}</strong>
      <p>${escapeHtml(application.position ?? "Untitled role")}</p>
      <p>Status: ${escapeHtml(displayStatus(application.status))}</p>
      <p>Updated: ${escapeHtml(new Date(application.updatedAt).toLocaleString())}</p>
      <div class="actions">
        <a class="link-button secondary" href="/applications/${application.id}" data-link>Open workspace</a>
        <a class="link-button secondary" href="/versions/${application.resumeVersionId}" data-link>Resume version</a>
      </div>
    </article>
  `;
}

async function renderResumeEditor(resumeId) {
  app.innerHTML = `
    ${topbar()}
    <section class="panel stack wide">
      <p class="eyebrow">Canonical Resume</p>
      <h1>Resume editor</h1>
      <div id="resume-editor">Loading canonical resume.</div>
    </section>
  `;
  bindAuthenticatedChrome();
  await loadResumeEditor(resumeId);
}

async function loadResumeEditor(resumeId) {
  const container = document.querySelector("#resume-editor");
  try {
    const response = await apiFetch(`/v1/resumes/${resumeId}/canonical`);
    container.innerHTML = resumeEditorHtml(response.data);
    bindLinks();
    bindEditorActions(resumeId, response.data);
  } catch (error) {
    container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
  }
}

function bindEditorActions(resumeId, data) {
  document.querySelector("#add-section")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target));
    await apiFetch(`/v1/resumes/${resumeId}/canonical`, { method: "POST", body: JSON.stringify(payload) });
    await loadResumeEditor(resumeId);
  });

  for (const form of document.querySelectorAll("[data-section-form]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await apiFetch(`/v1/sections/${form.dataset.sectionForm}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadResumeEditor(resumeId);
    });
  }

  for (const form of document.querySelectorAll("[data-entity-form]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await apiFetch(`/v1/entities/${form.dataset.entityForm}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadResumeEditor(resumeId);
    });
  }

  for (const form of document.querySelectorAll("[data-bullet-form]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await apiFetch(`/v1/bullets/${form.dataset.bulletForm}`, {
        method: "PATCH",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadResumeEditor(resumeId);
    });
  }

  for (const button of document.querySelectorAll("[data-delete-section]")) {
    button.addEventListener("click", async () => {
      await apiFetch(`/v1/sections/${button.dataset.deleteSection}`, { method: "DELETE" });
      await loadResumeEditor(resumeId);
    });
  }

  for (const button of document.querySelectorAll("[data-delete-entity]")) {
    button.addEventListener("click", async () => {
      await apiFetch(`/v1/entities/${button.dataset.deleteEntity}`, { method: "DELETE" });
      await loadResumeEditor(resumeId);
    });
  }

  for (const button of document.querySelectorAll("[data-delete-bullet]")) {
    button.addEventListener("click", async () => {
      await apiFetch(`/v1/bullets/${button.dataset.deleteBullet}`, { method: "DELETE" });
      await loadResumeEditor(resumeId);
    });
  }

  for (const button of document.querySelectorAll("[data-toggle-section]")) {
    button.addEventListener("click", async () => {
      await apiFetch(`/v1/sections/${button.dataset.toggleSection}/visibility`, {
        method: "POST",
        body: JSON.stringify({ visibility: button.dataset.visibility === "visible" ? "hidden" : "visible" })
      });
      await loadResumeEditor(resumeId);
    });
  }

  for (const button of document.querySelectorAll("[data-toggle-bullet]")) {
    button.addEventListener("click", async () => {
      await apiFetch(`/v1/bullets/${button.dataset.toggleBullet}/visibility`, {
        method: "POST",
        body: JSON.stringify({ visibility: button.dataset.visibility === "visible" ? "hidden" : "visible" })
      });
      await loadResumeEditor(resumeId);
    });
  }

  for (const form of document.querySelectorAll("[data-add-entity]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await apiFetch(`/v1/sections/${form.dataset.addEntity}/entities`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadResumeEditor(resumeId);
    });
  }

  for (const form of document.querySelectorAll("[data-add-bullet]")) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await apiFetch(`/v1/entities/${form.dataset.addBullet}/bullets`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      await loadResumeEditor(resumeId);
    });
  }

  bindDragReorder(resumeId);
}

function bindDragReorder(resumeId) {
  for (const item of document.querySelectorAll("[draggable='true']")) {
    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", item.dataset.dragId);
    });
    item.addEventListener("dragover", (event) => event.preventDefault());
    item.addEventListener("drop", async (event) => {
      event.preventDefault();
      const fromId = event.dataTransfer.getData("text/plain");
      const toId = item.dataset.dragId;
      const group = item.parentElement;
      const ids = [...group.querySelectorAll("[data-drag-id]")].map((node) => node.dataset.dragId);
      const reordered = moveBefore(ids, fromId, toId);
      if (item.dataset.dragType === "section") {
        await apiFetch(`/v1/resumes/${resumeId}/sections/reorder`, { method: "POST", body: JSON.stringify({ orderedIds: reordered }) });
      }
      if (item.dataset.dragType === "entity") {
        await apiFetch(`/v1/sections/${item.dataset.parentId}/entities/reorder`, { method: "POST", body: JSON.stringify({ orderedIds: reordered }) });
      }
      if (item.dataset.dragType === "bullet") {
        await apiFetch(`/v1/entities/${item.dataset.parentId}/bullets/reorder`, { method: "POST", body: JSON.stringify({ orderedIds: reordered }) });
      }
      await loadResumeEditor(resumeId);
    });
  }
}

function moveBefore(ids, fromId, toId) {
  const without = ids.filter((id) => id !== fromId);
  const index = without.indexOf(toId);
  without.splice(index, 0, fromId);
  return without;
}

function resumeEditorHtml(data) {
  return `
    <form id="add-section" class="inline-form">
      <input name="title" placeholder="New section title" required>
      <input name="sectionType" placeholder="custom">
      <button type="submit">Add section</button>
    </form>
    <div class="editor-list">
      ${data.sections.map(editorSectionHtml).join("")}
    </div>
  `;
}

function editorSectionHtml(section) {
  return `
    <section class="editor-section" draggable="true" data-drag-type="section" data-drag-id="${section.id}">
      <form class="inline-form" data-section-form="${section.id}">
        <input name="title" value="${escapeAttribute(section.title)}" required>
        <input name="sectionType" value="${escapeAttribute(section.sectionType)}">
        <button type="submit">Save section</button>
        <button type="button" class="secondary" data-toggle-section="${section.id}" data-visibility="${section.visibility}">${section.visibility === "visible" ? "Hide" : "Show"}</button>
        <button type="button" class="secondary" data-delete-section="${section.id}">Delete</button>
      </form>
      <form class="inline-form" data-add-entity="${section.id}">
        <input name="title" placeholder="Title">
        <input name="organization" placeholder="Company or project">
        <button type="submit">Add entity</button>
      </form>
      <div class="editor-list">
        ${section.entities.map((entity) => editorEntityHtml(section, entity)).join("")}
      </div>
    </section>
  `;
}

function editorEntityHtml(section, entity) {
  return `
    <article class="editor-entity" draggable="true" data-drag-type="entity" data-parent-id="${section.id}" data-drag-id="${entity.id}">
      <form class="inline-form" data-entity-form="${entity.id}">
        <input name="title" value="${escapeAttribute(entity.title ?? "")}" placeholder="Title">
        <input name="organization" value="${escapeAttribute(entity.organization ?? "")}" placeholder="Company or project">
        <input name="startDate" value="${escapeAttribute(entity.startDate ?? "")}" placeholder="Start YYYY-MM-DD">
        <input name="endDate" value="${escapeAttribute(entity.endDate ?? "")}" placeholder="End YYYY-MM-DD">
        <button type="submit">Save entity</button>
        <button type="button" class="secondary" data-delete-entity="${entity.id}">Delete</button>
      </form>
      <form class="inline-form" data-add-bullet="${entity.id}">
        <input name="text" placeholder="New bullet" required>
        <button type="submit">Add bullet</button>
      </form>
      <ul class="editor-bullets">
        ${entity.bullets.map((bullet) => editorBulletHtml(entity, bullet)).join("")}
      </ul>
    </article>
  `;
}

function editorBulletHtml(entity, bullet) {
  return `
    <li draggable="true" data-drag-type="bullet" data-parent-id="${entity.id}" data-drag-id="${bullet.id}">
      <form class="inline-form" data-bullet-form="${bullet.id}">
        <input name="text" value="${escapeAttribute(bullet.text)}" required>
        <button type="submit">Save bullet</button>
        <button type="button" class="secondary" data-toggle-bullet="${bullet.id}" data-visibility="${bullet.visibility}">${bullet.visibility === "visible" ? "Hide" : "Show"}</button>
        <button type="button" class="secondary" data-delete-bullet="${bullet.id}">Delete</button>
      </form>
    </li>
  `;
}

function draftReviewHtml(data) {
  const validation = data.validation;
  const canApprove = validation.valid;
  return `
    <div class="status-row">
      <p>Resume status: ${escapeHtml(data.resume.status)}</p>
      <p>Parse job: ${escapeHtml(data.parseJob?.status ?? "not queued")}</p>
      ${validation.errors.length ? `<div class="error"><strong>Cannot approve yet.</strong>${validation.errors.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>` : ""}
      ${validation.warnings.length ? `<div class="warning"><strong>Missing information warnings.</strong>${validation.warnings.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>` : ""}
      <div class="actions">
        <button id="approve-draft" type="button" ${canApprove ? "" : "disabled"}>Approve</button>
        <button id="reject-draft" class="secondary" type="button">Reject</button>
        <button id="rerun-parser" class="secondary" type="button">Re-run parser</button>
        <a class="link-button secondary" href="/resumes" data-link>Cancel</a>
      </div>
    </div>
    <div class="parsed-preview">${data.sections.map(parsedSectionHtml).join("")}</div>
  `;
}

const parseStages = [
  { stage: "queued", label: "PDF uploaded" },
  { stage: "reading_pdf", label: "Reading PDF" },
  { stage: "extracting_text", label: "Text extracted" },
  { stage: "parsing_resume", label: "Parsing resume sections" },
  { stage: "generating_draft", label: "Generating draft" },
  { stage: "saving_draft", label: "Saving draft" },
  { stage: "completed", label: "Draft ready" }
];

async function pollParseProgress(resumeId, container) {
  const tick = async () => {
    try {
      const response = await apiFetch(`/v1/resumes/${resumeId}/parsed-draft`);
      const job = response.data.parseJob;
      container.innerHTML = parseProgressHtml(job);

      if (job?.status === "succeeded") {
        clearParsePolling();
        navigate(`/resumes/${resumeId}/review`, true);
        return;
      }

      if (job?.status === "failed") {
        clearParsePolling();
        document.querySelector("#parse-progress-retry")?.addEventListener("click", async () => {
          await apiFetch(`/v1/parse-jobs/${job.id}/retry`, { method: "POST" });
          await runParser(job.id, resumeId, container);
        });
        return;
      }

      state.parsePollTimer = window.setTimeout(tick, 900);
    } catch (error) {
      clearParsePolling();
      container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  };

  await tick();
}

function clearParsePolling() {
  if (state.parsePollTimer) {
    window.clearTimeout(state.parsePollTimer);
    state.parsePollTimer = null;
  }
}

function parseProgressHtml(job) {
  const stage = job?.stage ?? "queued";
  const progress = clampProgress(job?.progress ?? 0);
  const message = job?.message ?? stageLabel(stage);
  const isFailed = job?.status === "failed";
  return `
    <div class="parse-progress ${isFailed ? "failed" : ""}">
      <div class="progress-header">
        <strong>${escapeHtml(stageLabel(stage))}</strong>
        <span>${progress}%</span>
      </div>
      <div class="progress-track" aria-label="Parser progress">
        <div class="progress-bar" style="width: ${progress}%"></div>
      </div>
      <p>${escapeHtml(message)}</p>
      <ol class="stage-list">
        ${parseStages.map((item) => parseStageItemHtml(item, stage, isFailed)).join("")}
      </ol>
      ${isFailed ? `
        <div class="error">
          <strong>Parser failed at ${escapeHtml(stageLabel(stage))}.</strong>
          <p>${escapeHtml(job.errorMessage ?? "The parser could not complete.")}</p>
        </div>
        <div class="actions"><button id="parse-progress-retry" type="button">Retry</button></div>
      ` : ""}
    </div>
  `;
}

function parseStageItemHtml(item, currentStage, failed) {
  const currentIndex = parseStages.findIndex((stage) => stage.stage === currentStage);
  const itemIndex = parseStages.findIndex((stage) => stage.stage === item.stage);
  const marker = failed && item.stage === currentStage
    ? "!"
    : itemIndex < currentIndex
      ? "✓"
      : itemIndex === currentIndex
        ? "▶"
        : "○";
  return `<li class="${itemIndex === currentIndex ? "current" : ""}"><span>${marker}</span>${escapeHtml(item.label)}</li>`;
}

function stageLabel(stage) {
  return parseStages.find((item) => item.stage === stage)?.label ?? stage.split("_").join(" ");
}

function clampProgress(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function parsedDraftHtml(data) {
  const job = data.parseJob;
  const actions = job?.status === "queued"
    ? `<button id="preview-run-parser" type="button">Run parser</button>`
    : job?.status === "failed"
      ? `<button id="preview-retry-parser" type="button">Retry parser</button>`
      : "";
  const sections = data.sections.length
    ? data.sections.map(parsedSectionHtml).join("")
    : "<p>No parsed sections available yet.</p>";
  return `
    <div class="status-row">
      <p>Resume status: ${escapeHtml(data.resume.status)}</p>
      <p>Parse job: ${escapeHtml(job?.status ?? "not queued")}</p>
      ${job && ["running", "failed"].includes(job.status) ? parseProgressHtml(job) : ""}
      ${job?.errorMessage && job.status !== "failed" ? `<div class="error">${escapeHtml(job.errorMessage)}</div>` : ""}
      <div class="actions">${actions}<a class="link-button secondary" href="/resumes" data-link>Back</a></div>
    </div>
    <div class="parsed-preview">${sections}</div>
  `;
}

function parsedSectionHtml(section) {
  return `
    <section class="parsed-section">
      <h2>${escapeHtml(section.title)} <span>confidence ${formatConfidence(section.confidence)}</span></h2>
      ${section.entities.map(parsedEntityHtml).join("")}
    </section>
  `;
}

function parsedEntityHtml(entity) {
  return `
    <article class="parsed-entity">
      <h3>${escapeHtml(entity.title ?? entity.entityType)} <span>confidence ${formatConfidence(entity.confidence)}</span></h3>
      <ul>
        ${entity.bullets.map((bullet) => `
          <li>
            ${escapeHtml(bullet.text)}
            <span>confidence ${formatConfidence(bullet.confidence)}</span>
          </li>
        `).join("")}
      </ul>
    </article>
  `;
}

function jobDescriptionPreviewHtml(data) {
  const job = data.jobDescription;
  const metadata = job.parsedMetadata ?? {};
  const skillList = metadata.normalizedSkills ?? [];
  const responsibilities = (data.requirements ?? []).filter((item) => item.requirementType === "responsibility");
  return `
    <div class="status-row">
      <p>Company: ${escapeHtml(job.company ?? "Unknown")}</p>
      <p>Title: ${escapeHtml(job.position ?? "Unknown")}</p>
      <p>Location: ${escapeHtml(job.location ?? "Unspecified")}</p>
      <p>Employment: ${escapeHtml(job.employmentType ?? "Unspecified")}</p>
      <p>Confidence: ${formatConfidence(job.parseConfidence)}</p>
      <div class="actions">
        <a class="link-button secondary" href="/jobs/${job.id}" data-link>Open saved preview</a>
        <a class="link-button secondary" href="/matches/new?jobDescriptionId=${job.id}" data-link>Run match</a>
        <a class="link-button secondary" href="/jobs" data-link>Back to jobs</a>
      </div>
    </div>
    <section class="parsed-section">
      <h2>Skills <span>${skillList.length}</span></h2>
      <div class="tag-list">${skillList.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>
    </section>
    <section class="parsed-section">
      <h2>Requirements <span>${data.requirements.length}</span></h2>
      <ul>
        ${data.requirements.map((requirement) => `
          <li>
            ${escapeHtml(requirement.normalizedText)}
            <span>${escapeHtml(requirement.importance)} confidence ${formatConfidence(requirement.confidence)}</span>
          </li>
        `).join("")}
      </ul>
    </section>
    <section class="parsed-section">
      <h2>Responsibilities <span>${responsibilities.length}</span></h2>
      <ul>
        ${responsibilities.map((requirement) => `<li>${escapeHtml(requirement.text)}</li>`).join("")}
      </ul>
    </section>
    <section class="parsed-section">
      <h2>Keywords <span>${data.keywords.length}</span></h2>
      <div class="tag-list">
        ${data.keywords.map((keyword) => `<span>${escapeHtml(keyword.normalizedKeyword)} ${formatConfidence(keyword.confidence)}</span>`).join("")}
      </div>
    </section>
  `;
}

function matchReportHtml(data) {
  const report = data.report;
  const categories = Object.entries(report.categoryScores ?? {});
  return `
    <div class="status-row">
      <p>Overall match: ${escapeHtml(report.overallScore)}%</p>
      <p>Matched requirements: ${escapeHtml(report.summary?.matchedRequirementCount ?? 0)} / ${escapeHtml(report.summary?.totalRequirementCount ?? 0)}</p>
      <p>Gaps: ${escapeHtml(report.summary?.gapCount ?? data.gaps.length)}</p>
      <div class="actions">
        <a class="link-button secondary" href="/matches/new" data-link>Run another match</a>
        <button id="generate-readiness" class="secondary" type="button">Assess readiness</button>
      </div>
    </div>
    <section class="parsed-section">
      <h2>Category Breakdown</h2>
      <div class="tag-list">${categories.map(([category, score]) => `<span>${escapeHtml(category)} ${escapeHtml(score)}%</span>`).join("")}</div>
    </section>
    <section class="parsed-section">
      <h2>Matched Skills <span>${data.skillMatches.length}</span></h2>
      <ul>${data.skillMatches.map((item) => `<li>${escapeHtml(item.normalizedSkill)} <span>${escapeHtml(item.matchType)} confidence ${formatConfidence(item.confidence)}</span></li>`).join("")}</ul>
    </section>
    <section class="parsed-section">
      <h2>Missing Skills <span>${data.gaps.length}</span></h2>
      <ul>${data.gaps.map((gap) => `<li>${escapeHtml(gap.normalizedSkill)} <span>${escapeHtml(gap.importance)} confidence ${formatConfidence(gap.confidence)}</span><p>${escapeHtml(gap.reason)}</p></li>`).join("")}</ul>
    </section>
    <section class="parsed-section">
      <h2>Evidence <span>${data.evidence.length}</span></h2>
      ${data.evidence.map((item) => `
        <details class="evidence-item">
          <summary>${escapeHtml(item.requirementText)} matched by ${escapeHtml(item.matchedBy)}</summary>
          <p>${escapeHtml(item.evidenceText)}</p>
          <p>Confidence ${formatConfidence(item.confidence)}</p>
        </details>
      `).join("")}
    </section>
  `;
}

function readinessReportHtml(data) {
  const report = data.report;
  const strengths = data.findings.filter((finding) => finding.severity === "strength");
  const weaknesses = data.findings.filter((finding) => finding.severity === "weakness");
  const warnings = data.findings.filter((finding) => finding.severity === "warning");
  return `
    <div class="status-row">
      <p>Readiness: ${escapeHtml(report.readinessScore)}%</p>
      <p>Strengths: ${escapeHtml(report.summary?.strengthCount ?? strengths.length)}</p>
      <p>Warnings: ${escapeHtml(report.summary?.warningCount ?? warnings.length)}</p>
      <p>Weaknesses: ${escapeHtml(report.summary?.weaknessCount ?? weaknesses.length)}</p>
      <div class="actions">
        <a class="link-button secondary" href="/matches/${report.matchReportId}" data-link>Back to match report</a>
        <button id="generate-patch-set" class="secondary" type="button">Generate patch set</button>
      </div>
    </div>
    ${readinessFindingSection("Strengths", strengths)}
    ${readinessFindingSection("Weaknesses", weaknesses)}
    ${readinessFindingSection("Warnings", warnings)}
    <section class="parsed-section">
      <h2>Recommendations <span>${data.recommendations.length}</span></h2>
      ${data.recommendations.map((item) => `
        <details class="evidence-item">
          <summary>${escapeHtml(item.text)} <span>${escapeHtml(item.priority)} confidence ${formatConfidence(item.confidence)}</span></summary>
          <ul>${item.evidenceRefs.map((ref) => `<li>${escapeHtml(ref.sourceType)}: ${escapeHtml(ref.text)}</li>`).join("")}</ul>
        </details>
      `).join("")}
    </section>
  `;
}

function optimizationReviewHtml(data) {
  const reviewByPatch = new Map(data.reviewStates.map((state) => [state.patchId, state]));
  return `
    <div class="status-row">
      <p>Patch count: ${escapeHtml(data.patchSet.patchCount)}</p>
      <p>Status: ${escapeHtml(data.patchSet.status)}</p>
      <div class="actions">
        <button type="button" data-review-all="accepted">Accept All</button>
        <button type="button" class="secondary" data-review-all="rejected">Reject All</button>
        <button type="button" class="secondary" id="create-version">Create Version</button>
      </div>
    </div>
    <div class="parsed-preview">
      ${data.patches.map((patch) => optimizationPatchHtml(patch, reviewByPatch.get(patch.id))).join("")}
    </div>
  `;
}

function versionListItem(version) {
  return `
    <article class="list-item">
      <strong>${escapeHtml(version.name)}</strong>
      <p>Version: ${escapeHtml(version.metadata?.versionNumber ?? 1)}</p>
      <p>Parent: ${escapeHtml(version.parentVersionId ?? "none")}</p>
      <p>Snapshot: ${escapeHtml(version.resolvedSchemaHash ?? "pending")}</p>
      <div class="actions">
        <a class="link-button secondary" href="/versions/${version.id}" data-link>Compare Versions</a>
      </div>
    </article>
  `;
}

function versionDetailHtml(data) {
  const version = data.version;
  return `
    <div class="status-row">
      <p>Version number: ${escapeHtml(version.metadata?.versionNumber ?? 1)}</p>
      <p>Parent version: ${escapeHtml(version.parentVersionId ?? "none")}</p>
      <p>Patch set: ${escapeHtml(version.metadata?.patchSetId ?? version.metadata?.[legacyPatchSetMetadataKey()] ?? "none")}</p>
      <p>Snapshot hash: ${escapeHtml(data.snapshot?.snapshotHash ?? "none")}</p>
    </div>
    <section class="parsed-section">
      <h2>Patch Summary <span>${escapeHtml(data.diff?.operationCount ?? 0)}</span></h2>
      <ul>${(data.diff?.operations ?? []).map((operation) => `<li>${escapeHtml(operation.operation)}: ${escapeHtml(operation.reason)}</li>`).join("")}</ul>
    </section>
    <section class="parsed-section">
      <h2>Compare Versions</h2>
      <div class="diff-grid">
        <div><p class="eyebrow">Parent</p><p>${escapeHtml(version.parentVersionId ?? "Initial version")}</p></div>
        <div><p class="eyebrow">Current</p><p>${escapeHtml(version.id)}</p></div>
      </div>
    </section>
    <section class="parsed-section">
      <h2>Rendered Downloads</h2>
      <div class="actions">
        ${data.renderedResumes.map((artifact) => `<button type="button" class="secondary" data-format="${artifact.format}" data-download-render="${artifact.id}">${downloadLabel(artifact.format)}</button>`).join("")}
      </div>
    </section>
    <section class="parsed-section">
      <h2>Create Application Workspace</h2>
      <form id="application-create-form" class="inline-form">
        <input name="company" placeholder="Company" required>
        <input name="position" placeholder="Position">
        <button type="submit">Create workspace</button>
      </form>
    </section>
  `;
}

function applicationDetailHtml(data) {
  const application = data.application;
  return `
    <div class="status-row">
      <p>Company: ${escapeHtml(application.company)}</p>
      <p>Position: ${escapeHtml(application.position ?? "Untitled role")}</p>
      <p>Status: ${escapeHtml(displayStatus(application.status))}</p>
      <div class="actions">
        <a class="link-button secondary" href="/versions/${application.resumeVersionId}" data-link>Resume version</a>
        ${application.renderedResumeId ? `<button type="button" class="secondary" data-format="pdf" data-download-render="${application.renderedResumeId}">Download PDF</button>` : ""}
      </div>
    </div>
    <section class="parsed-section">
      <h2>Status Update</h2>
      <form id="application-status-form" class="inline-form">
        <select name="status">
          ${applicationStatusOptions(application.status)}
        </select>
        <button type="submit">Update status</button>
      </form>
    </section>
    <section class="parsed-section">
      <h2>Artifact Links</h2>
      <div class="tag-list">
        <span>Resume Version ${escapeHtml(application.resumeVersionId)}</span>
        ${application.jobDescriptionId ? `<span>Job ${escapeHtml(application.jobDescriptionId)}</span>` : ""}
        ${application.matchReportId ? `<span>Match ${escapeHtml(application.matchReportId)}</span>` : ""}
        ${application.readinessReportId ? `<span>Readiness ${escapeHtml(application.readinessReportId)}</span>` : ""}
        ${application.optimizationPatchSetId ? `<span>Patch Set ${escapeHtml(application.optimizationPatchSetId)}</span>` : ""}
        ${application.renderedResumeId ? `<span>Rendered Resume ${escapeHtml(application.renderedResumeId)}</span>` : ""}
      </div>
    </section>
    <section class="parsed-section">
      <h2>Timeline View <span>${data.events.length}</span></h2>
      <ul>
        ${data.events.map((event) => `<li><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(new Date(event.createdAt).toLocaleString())}</p>${event.body ? `<p>${escapeHtml(event.body)}</p>` : ""}</li>`).join("")}
      </ul>
    </section>
    <section class="parsed-section">
      <h2>Notes <span>${data.notes.length}</span></h2>
      <form id="application-note-form" class="stack">
        <label>Note<textarea name="body" rows="4" required></textarea></label>
        <button type="submit">Add note</button>
      </form>
      <div class="list">${data.notes.map((note) => `<article class="list-item"><p>${escapeHtml(note.body)}</p><p>${escapeHtml(new Date(note.createdAt).toLocaleString())}</p></article>`).join("")}</div>
    </section>
  `;
}

function applicationStatusOptions(currentStatus) {
  return ["draft", "preparing", "applied", "interview", "offer", "rejected", "withdrawn", "archived"]
    .map((status) => `<option value="${status}" ${status === currentStatus ? "selected" : ""}>${displayStatus(status)}</option>`)
    .join("");
}

function displayStatus(status) {
  return String(status ?? "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function downloadLabel(format) {
  if (format === "pdf") return "Download PDF";
  if (format === "html") return "Download HTML";
  if (format === "json") return "Download JSON";
  return "Download";
}

function legacyPatchSetMetadataKey() {
  return ["app", "liedPatchSetId"].join("");
}

function optimizationPatchHtml(patch, reviewState) {
  return `
    <article class="editor-section">
      <div class="status-row">
        <p>Operation: ${escapeHtml(patch.operation)}</p>
        <p>Review: ${escapeHtml(reviewState?.state ?? "pending")}</p>
        <p>Confidence: ${formatConfidence(patch.confidence)}</p>
      </div>
      <div class="diff-grid">
        <div>
          <p class="eyebrow">Before</p>
          <p>${escapeHtml(patch.before ?? "No existing content")}</p>
        </div>
        <div>
          <p class="eyebrow">After</p>
          <p>${escapeHtml(patch.after ?? "No replacement content")}</p>
        </div>
      </div>
      <p>Reason: ${escapeHtml(patch.reason)}</p>
      <details class="evidence-item">
        <summary>Evidence</summary>
        <ul>${patch.evidence.map((item) => `<li>${escapeHtml(item.sourceType)}: ${escapeHtml(item.text)}</li>`).join("")}</ul>
      </details>
      <div class="actions">
        <button type="button" data-review-patch="${patch.id}" data-state="accepted">Accept</button>
        <button type="button" class="secondary" data-review-patch="${patch.id}" data-state="rejected">Reject</button>
      </div>
    </article>
  `;
}

function readinessFindingSection(title, findings) {
  return `
    <section class="parsed-section">
      <h2>${escapeHtml(title)} <span>${findings.length}</span></h2>
      ${findings.map((finding) => `
        <details class="evidence-item">
          <summary>${escapeHtml(finding.category)} <span>confidence ${formatConfidence(finding.confidence)}</span></summary>
          <p>${escapeHtml(finding.reason)}</p>
          <ul>${(finding.evidence ?? []).map((item) => `<li>${escapeHtml(item.sourceType)}: ${escapeHtml(item.text)}</li>`).join("")}</ul>
        </details>
      `).join("")}
    </section>
  `;
}

function formatConfidence(value) {
  return `${Math.round(Number(value ?? 0) * 100)}%`;
}

function errorHtml() {
  return state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
