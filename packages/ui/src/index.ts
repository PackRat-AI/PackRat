/**
 * Simple HTML Web UI for SwarmBoard
 * Uses Elysia + @elysiajs/html + juice.css
 */

import { html as htmlTemplate } from "@elysiajs/html";
import Elysia from "elysia";

const app = new Elysia()
	.get("/", () => {
		const html = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>SwarmBoard</title>
	<link rel="stylesheet" href="https://juicecss.app/dist/juice.css">
	<style>
		:root {
			--color-primary: #6366f1;
			--color-bg: #0f172a;
			--color-surface: #1e293b;
			--color-text: #f8fafc;
		}
		body {
			background: var(--color-bg);
			color: var(--color-text);
			font-family: system-ui, sans-serif;
			max-width: 900px;
			margin: 0 auto;
			padding: 2rem;
		}
		h1 { color: var(--color-primary); margin-bottom: 1rem; }
		.board { display: grid; gap: 1rem; }
		.story {
			background: var(--color-surface);
			padding: 1rem;
			border-radius: 8px;
			border-left: 4px solid var(--color-primary);
		}
		.story.done { border-left-color: #22c55e; opacity: 0.7; }
		.story.todo { border-left-color: #f59e0b; }
		.story-header { display: flex; justify-content: space-between; align-items: center; }
		.story-id { font-size: 0.8rem; color: #94a3b8; }
		.story-title { font-weight: 600; margin: 0.5rem 0; }
		.story-meta { font-size: 0.85rem; color: #64748b; }
		.btn {
			background: var(--color-primary);
			color: white;
			border: none;
			padding: 0.5rem 1rem;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.9rem;
		}
		.btn:hover { opacity: 0.9; }
		.actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
		.login-form {
			max-width: 400px;
			margin: 4rem auto;
			background: var(--color-surface);
			padding: 2rem;
			border-radius: 12px;
		}
		input {
			width: 100%;
			padding: 0.75rem;
			margin: 0.5rem 0;
			border-radius: 6px;
			border: 1px solid #334155;
			background: #0f172a;
			color: var(--color-text);
		}
		.status-todo { color: #f59e0b; }
		.status-in_progress { color: #3b82f6; }
		.status-done { color: #22c55e; }
	</style>
</head>
<body>
	<h1>SwarmBoard</h1>
	<p>Multi-agent task management</p>
	<div id="app"></div>

	<script type="module">
		const API_URL = window.location.origin;
		let token = localStorage.getItem('swarmboard_token') || '';
		let agent = localStorage.getItem('swarmboard_agent') || '';

		async function api(path, options = {}) {
			const headers = {
				'Content-Type': 'application/json',
				...options.headers
			};
			if (token) headers['X-API-Key'] = token;
			if (agent) headers['X-Agent'] = agent;

			const res = await fetch(API_URL + path, { ...options, headers });
			if (!res.ok) throw new Error(await res.text());
			return res.json();
		}

		function renderLogin() {
			return \`
				<div class="login-form">
					<h2>Login</h2>
					<form id="login-form">
						<input type="text" id="agent" placeholder="Agent ID" value="\${agent}" required>
						<input type="password" id="token" placeholder="API Token" value="\${token}" required>
						<button type="submit" class="btn" style="width:100%;margin-top:1rem;">Login</button>
					</form>
				</div>
			\`;
		}

		function renderBoard(stories) {
			if (!stories || stories.length === 0) {
				return \`<p style="color:#64748b">No stories yet. Use the CLI to add tasks.</p>\`;
			}
			return \`
				<div class="board">
					\${stories.map(story => \`
						<div class="story \${story.status?.toLowerCase().replace('_', '-') || 'todo'}">
							<div class="story-header">
								<span class="story-id">\${story.id}</span>
								<span class="status-\${story.status?.toLowerCase().replace('_', '-')}">\${story.status || 'TODO'}</span>
							</div>
							<h3 class="story-title">\${story.title}</h3>
							<p class="story-meta">\${story.description || ''}</p>
							\${story.assignee ? \`<p class="story-meta">Assigned to: \${story.assignee}</p>\` : ''}
							<div class="actions">
								<button class="btn" onclick="claim('\${story.id}')">Claim</button>
								<button class="btn" onclick="done('\${story.id}')">Done</button>
							</div>
						</div>
					\`).join('')}
				</div>
			\`;
		}

		async function loadBoard() {
			try {
				const data = await api('/board');
				document.getElementById('app').innerHTML = renderBoard(data.userStories || []);
			} catch (e) {
				document.getElementById('app').innerHTML = renderLogin();
			}
		}

		document.addEventListener('submit', async (e) => {
			if (e.target.id === 'login-form') {
				e.preventDefault();
				agent = document.getElementById('agent').value;
				token = document.getElementById('token').value;
				localStorage.setItem('swarmboard_agent', agent);
				localStorage.setItem('swarmboard_token', token);
				loadBoard();
			}
		});

		window.claim = async (id) => {
			try {
				await api('/stories/' + id + '/claim', { method: 'POST' });
				loadBoard();
			} catch (e) {
				alert('Failed: ' + e.message);
			}
		};

		window.done = async (id) => {
			try {
				await api('/stories/' + id, {
					method: 'PATCH',
					body: JSON.stringify({ status: 'DONE' })
				});
				loadBoard();
			} catch (e) {
				alert('Failed: ' + e.message);
			}
		};

		loadBoard();
	</script>
</body>
</html>`;
		return new Response(htmlTemplate(html), {
			headers: { "Content-Type": "text/html" },
		});
	})
	.listen(3000);

console.log("SwarmBoard UI: http://localhost:3000");

export type App = typeof app;
