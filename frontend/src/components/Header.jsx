import { useState } from 'react';

const GITHUB_REPO = 'manfredimarzotto/Startup-Market-Update';
const WORKFLOW_FILE = 'pipeline.yml';
const GH_API = 'https://api.github.com';
const TOKEN_KEY = 'nsi_github_token';

export default function Header() {
  const [loading, setLoading] = useState(false);
  const [btnText, setBtnText] = useState('Generate');

  async function handleGenerate() {
    let token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = prompt(
        'Enter a GitHub Personal Access Token with "actions:write" and "contents:read" permissions.\n\n' +
        'Create one at: github.com/settings/tokens\n\n' +
        'The token is stored only for this browser session.'
      );
      if (!token?.trim()) return;
      token = token.trim();
      sessionStorage.setItem(TOKEN_KEY, token);
    }

    setLoading(true);
    try {
      setBtnText('Triggering...');
      const resp = await fetch(
        `${GH_API}/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
          body: JSON.stringify({ ref: 'main' }),
        }
      );
      if (resp.status === 401 || resp.status === 403) {
        sessionStorage.removeItem(TOKEN_KEY);
        throw new Error('Invalid or expired token.');
      }
      if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);

      setBtnText('Pipeline running...');
      await pollWorkflow(token);

      setBtnText('Reloading...');
      await new Promise(r => setTimeout(r, 5000));
      window.location.reload();
    } catch (err) {
      alert('Generate failed: ' + err.message);
      setLoading(false);
      setBtnText('Generate');
    }
  }

  async function pollWorkflow(token) {
    await new Promise(r => setTimeout(r, 3000));
    const startTime = Date.now();
    const TIMEOUT = 5 * 60 * 1000;
    while (Date.now() - startTime < TIMEOUT) {
      const resp = await fetch(
        `${GH_API}/repos/${GITHUB_REPO}/actions/runs?per_page=1&event=workflow_dispatch`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (!resp.ok) throw new Error('Failed to check workflow status');
      const data = await resp.json();
      const run = data.workflow_runs?.[0];
      if (run?.status === 'completed') {
        if (run.conclusion === 'success') return;
        throw new Error(`Workflow finished with: ${run.conclusion}`);
      }
      await new Promise(r => setTimeout(r, 8000));
    }
    throw new Error('Timed out waiting for workflow');
  }

  function handleContextMenu(e) {
    e.preventDefault();
    if (confirm('Clear saved GitHub token?')) {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  }

  return (
    <header className="glass-strong sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="text-2xl">&#x2F2A;</div>
        <h1 className="text-white font-semibold text-lg tracking-tight">
          Startup Intelligence Radar
        </h1>
      </div>
      <button
        onClick={handleGenerate}
        onContextMenu={handleContextMenu}
        disabled={loading}
        aria-label="Generate today's opportunities"
        className={`
          px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
          ${loading
            ? 'bg-white/5 text-white/40 cursor-wait'
            : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30'
          }
        `}
      >
        {loading && (
          <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 align-middle" />
        )}
        {btnText}
      </button>
    </header>
  );
}
