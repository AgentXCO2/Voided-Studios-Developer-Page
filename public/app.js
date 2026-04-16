let token = null;
let currentFile = null;
let currentRepo = null;

// GET TOKEN FROM URL
const params = new URLSearchParams(window.location.search);
if (params.get("token")) {
  token = params.get("token");
  localStorage.setItem("token", token);
  document.getElementById("loginBtn").style.display = "none";
  document.getElementById("app").classList.remove("hidden");
}

token = token || localStorage.getItem("token");

// ------------------ LOAD REPOS ------------------
async function loadRepos() {
  const res = await fetch("/api/repos", {
    headers: { Authorization: token }
  });

  const data = await res.json();

  console.log(data);
}

// ------------------ LOAD TREE ------------------
async function loadTree(owner, repo) {
  currentRepo = { owner, repo };

  const res = await fetch(
    `/api/tree?owner=${owner}&repo=${repo}&token=${token}`
  );

  const data = await res.json();

  const tree = document.getElementById("tree");
  tree.innerHTML = "";

  data.tree.forEach(file => {
    if (file.type === "blob") {
      const div = document.createElement("div");
      div.innerText = file.path;

      div.onclick = () => openFile(file.path);

      tree.appendChild(div);
    }
  });
}

// ------------------ OPEN FILE ------------------
async function openFile(path) {
  currentFile = path;

  const res = await fetch(
    `/api/file?owner=${currentRepo.owner}&repo=${currentRepo.repo}&path=${path}&token=${token}`
  );

  const data = await res.json();

  document.getElementById("editor").value = data.content;
  document.getElementById("fileName").innerText = path;

  currentFile = { path, sha: data.sha };
}

// ------------------ SAVE FILE ------------------
async function saveFile() {
  await fetch("/api/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      owner: currentRepo.owner,
      repo: currentRepo.repo,
      path: currentFile.path,
      message: "Void Studios edit",
      content: document.getElementById("editor").value,
      sha: currentFile.sha
    })
  });

  alert("Saved to GitHub 🔥");
}
