/* ---------------- NAV VIEW ---------------- */
function setView(view, event) {
  currentView = view;

  document.querySelectorAll(".navItem").forEach(n => {
    n.classList.remove("active");
  });

  if (event) event.target.classList.add("active");

  renderView();
}

/* ---------------- MAIN VIEW ---------------- */
async function renderView() {
  const tree = document.getElementById("tree");
  const editor = document.getElementById("editorPanel");

  if (currentView === "code") {
    tree.style.display = "block";
    editor.style.display = "flex";
    return;
  }

  tree.style.display = "none";
  editor.style.display = "flex";

  /* ================= ISSUES (EDITABLE) ================= */
  if (currentView === "issues") {
    const res = await fetch(
      `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/issues`,
      { headers: { Authorization: token } }
    );

    const issues = await res.json();

    document.getElementById("editor").value =
      issues.map(i =>
        `[${i.number}] ${i.title}\n${i.body || ""}\n---`
      ).join("\n");

    document.getElementById("commitMsg").value = "Edit issues (preview mode)";
    return;
  }

  /* ================= PULL REQUESTS (EDITABLE VIEW) ================= */
  if (currentView === "pulls") {
    const res = await fetch(
      `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/pulls`,
      { headers: { Authorization: token } }
    );

    const pulls = await res.json();

    document.getElementById("editor").value =
      pulls.map(p =>
        `[PR ${p.number}] ${p.title}\n${p.body || ""}\nSTATE: ${p.state}\n---`
      ).join("\n");

    document.getElementById("commitMsg").value = "PR view (read-only unless merged via API)";
    return;
  }

  /* ================= ACTIONS ================= */
  if (currentView === "actions") {
    document.getElementById("editor").value =
      "Actions are logs only.\n(Real GitHub Actions API needed for editing workflows)";
    return;
  }

  /* ================= SETTINGS (NOW EDITABLE) ================= */
  if (currentView === "settings") {
    const res = await fetch(
      `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}`,
      { headers: { Authorization: token } }
    );

    const repo = await res.json();

    document.getElementById("editor").value = JSON.stringify({
      name: repo.name,
      description: repo.description || "",
      homepage: repo.homepage || "",
      visibility: repo.private ? "private" : "public"
    }, null, 2);

    document.getElementById("commitMsg").value = "Update repo settings JSON";
    return;
  }

  document.getElementById("editor").value =
    `${currentView} coming soon`;
}

/* ---------------- SAVE SYSTEM (NOW SMART) ---------------- */
async function saveFile() {
  const msg = document.getElementById("commitMsg").value;
  if (!msg) return;

  /* ================= SETTINGS UPDATE ================= */
  if (currentView === "settings") {
    const data = JSON.parse(document.getElementById("editor").value);

    await fetch(
      `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}`,
      {
        method: "PATCH",
        headers: {
          Authorization: token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          homepage: data.homepage
        })
      }
    );

    alert("Settings updated 🔥");
    return;
  }

  /* ================= FILE SAVE (UNCHANGED) ================= */
  const tab = openTabs.find(t => t.path === activeTab);
  if (!tab) return;

  await fetch("/api/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      owner: currentRepo.owner,
      repo: currentRepo.repo,
      path: tab.path,
      message: msg,
      content: tab.content,
      sha: tab.sha
    })
  });

  tab.dirty = false;
  renderTabs();
}