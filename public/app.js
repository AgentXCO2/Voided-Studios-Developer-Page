let token = localStorage.getItem("token");
let currentRepo = null;

let currentView = "code";

let openTabs = [];
let activeTab = null;

/* ---------------- SAFETY FETCH WRAPPER ---------------- */
async function ghFetch(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });

  const data = await res.json();

  if (!res.ok) {
    return {
      error: true,
      status: res.status,
      data
    };
  }

  return data;
}

/* ---------------- ORGS ---------------- */
async function loadOrgs() {
  const data = await ghFetch("https://api.github.com/user/orgs");

  const box = document.getElementById("orgList");
  box.innerHTML = "";

  if (data.error) {
    box.innerText = "Org load failed";
    return;
  }

  data.forEach(o => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerText = o.login;
    box.appendChild(div);
  });
}

/* ---------------- REPOS ---------------- */
async function loadRepos() {
  const data = await ghFetch("https://api.github.com/user/repos");

  const box = document.getElementById("repoList");
  box.innerHTML = "";

  if (data.error) {
    box.innerText = "Repo load failed";
    return;
  }

  data.forEach(r => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerText = r.name;

    div.onclick = () => loadTree(r.owner.login, r.name);

    box.appendChild(div);
  });
}

/* ---------------- TREE ---------------- */
async function loadTree(owner, repo) {
  currentRepo = { owner, repo };

  document.getElementById("repoTitle").innerText = repo;

  const data = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`
  );

  const tree = document.getElementById("tree");
  tree.innerHTML = "";

  if (data.error) {
    tree.innerText = "Tree load failed";
    return;
  }

  data.tree.forEach(f => {
    if (f.type === "blob") {
      const div = document.createElement("div");
      div.className = "item";
      div.innerText = f.path;
      div.onclick = () => openFile(f.path);
      tree.appendChild(div);
    }
  });

  renderView();
}

/* ---------------- FILE OPEN ---------------- */
async function openFile(path) {
  let existing = openTabs.find(t => t.path === path);
  if (existing) return setActiveTab(path);

  const data = await ghFetch(
    `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${path}`
  );

  if (data.error) return;

  const content = atob(data.content.replace(/\n/g, ""));

  openTabs.push({
    path,
    content,
    sha: data.sha,
    dirty: false
  });

  setActiveTab(path);
  renderTabs();
}

/* ---------------- TABS ---------------- */
function renderTabs() {
  const bar = document.getElementById("tabsBar");
  bar.innerHTML = "";

  openTabs.forEach(tab => {
    const div = document.createElement("div");
    div.className = "tab";

    if (tab.path === activeTab) div.classList.add("active");

    div.innerHTML = `${tab.path}${tab.dirty ? " *" : ""} <span class="closeTab">x</span>`;

    div.onclick = () => setActiveTab(tab.path);

    div.querySelector(".closeTab").onclick = (e) => {
      e.stopPropagation();
      closeTab(tab.path);
    };

    bar.appendChild(div);
  });
}

function setActiveTab(path) {
  const tab = openTabs.find(t => t.path === path);
  if (!tab) return;

  activeTab = path;

  document.getElementById("editor").value = tab.content;
  document.getElementById("fileName").innerText = tab.path;

  renderTabs();
}

function closeTab(path) {
  openTabs = openTabs.filter(t => t.path !== path);

  if (activeTab === path) {
    activeTab = openTabs[0]?.path || null;

    if (activeTab) setActiveTab(activeTab);
    else {
      document.getElementById("editor").value = "";
      document.getElementById("fileName").innerText = "No file";
    }
  }

  renderTabs();
}

/* ---------------- EDIT TRACKING ---------------- */
document.getElementById("editor").addEventListener("input", () => {
  const tab = openTabs.find(t => t.path === activeTab);
  if (!tab) return;

  tab.content = document.getElementById("editor").value;
  tab.dirty = true;

  renderTabs();
});

/* ---------------- SAVE FILE ---------------- */
async function saveFile() {
  const msg = document.getElementById("commitMsg").value;
  const tab = openTabs.find(t => t.path === activeTab);

  if (!tab || !msg) return;

  await fetch(
    `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${tab.path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: msg,
        content: btoa(tab.content),
        sha: tab.sha
      })
    }
  );

  tab.dirty = false;
  renderTabs();
}

/* ---------------- DELETE FILE ---------------- */
async function deleteFile() {
  const tab = openTabs.find(t => t.path === activeTab);
  if (!tab) return;

  await fetch(
    `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${tab.path}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "delete file",
        sha: tab.sha
      })
    }
  );

  closeTab(tab.path);
}

/* ---------------- RENAME FILE ---------------- */
async function renameFileInline() {
  const tab = openTabs.find(t => t.path === activeTab);
  if (!tab) return;

  const newPath = prompt("New name:");
  if (!newPath || newPath === tab.path) return;

  // create new file
  await fetch(
    `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/contents/${newPath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "rename file",
        content: btoa(tab.content)
      })
    }
  );

  // delete old
  await deleteFile();

  closeTab(tab.path);
}

/* ---------------- VIEW SYSTEM ---------------- */
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

  /* ---------------- ISSUES ---------------- */
  if (currentView === "issues") {
    const data = await ghFetch(
      `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/issues`
    );

    document.getElementById("editor").value =
      data.error
        ? "Issues failed to load"
        : data.map(i => `#${i.number} ${i.title}`).join("\n");

    return;
  }

  /* ---------------- PULL REQUESTS ---------------- */
  if (currentView === "pulls") {
    const data = await ghFetch(
      `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}/pulls`
    );

    document.getElementById("editor").value =
      data.error
        ? "PRs failed to load"
        : data.map(p => `PR #${p.number} ${p.title}`).join("\n");

    return;
  }

  /* ---------------- SETTINGS ---------------- */
  if (currentView === "settings") {
    const repo = await ghFetch(
      `https://api.github.com/repos/${currentRepo.owner}/${currentRepo.repo}`
    );

    document.getElementById("editor").value = repo.error
      ? "Settings failed to load"
      : JSON.stringify(
          {
            name: repo.name,
            description: repo.description,
            private: repo.private,
            default_branch: repo.default_branch
          },
          null,
          2
        );

    return;
  }

  document.getElementById("editor").value = `${currentView} coming soon`;
}
