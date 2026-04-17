import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const CLIENT_ID = process.env.YOUR_CLIENT_ID;
const CLIENT_SECRET = process.env.YOUR_CLIENT_SECRET;

const BASE_URL = "https://voided-studios-developer-page.onrender.com";

// LOGIN
app.get("/login", (req, res) => {
  res.redirect(
    `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo`
  );
});

// CALLBACK
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;

  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code
      })
    }
  );

  const data = await tokenRes.json();

  res.redirect(`${BASE_URL}/index.html?token=${data.access_token}`);
});

// REPOS
app.get("/api/repos", async (req, res) => {
  const token = req.headers.authorization;

  const response = await fetch("https://api.github.com/user/repos", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json"
    }
  });

  res.json(await response.json());
});

// TREE
app.get("/api/tree", async (req, res) => {
  const { owner, repo, token } = req.query;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  res.json(await response.json());
});

// FILE
app.get("/api/file", async (req, res) => {
  const { owner, repo, path, token } = req.query;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );

  const data = await response.json();

  res.json({
    content: Buffer.from(data.content, "base64").toString("utf-8"),
    sha: data.sha
  });
});

// SAVE
app.post("/api/update", async (req, res) => {
  const { token, owner, repo, path, message, content, sha } = req.body;

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      },
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString("base64"),
        sha
      })
    }
  );

  res.json(await response.json());
});

app.listen(3000, () => {
  console.log("Void Studios running");
});
