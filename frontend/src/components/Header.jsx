import { useState } from 'react';

const GITHUB_REPO = 'manfredimarzotto/Startup-Market-Update';
const WORKFLOW_FILE = 'pipeline.yml';
const GH_API = 'https://api.github.com';
const TOKEN_KEY = 'nsi_github_token';

export default function Header() {
  const [loading, setLoading] = useState(false);
  const [btnText, setBtnText] = useState('Refresh');

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
      alert('Refresh failed: ' + err.message);
      setLoading(false);
      setBtnText('Refresh');
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
    <header className="glass-strong sticky top-0 z-50 px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {/* S logo */}
        <div className="w-[22px] h-[22px] rounded-[5px] bg-[#0f172a] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
          S
        </div>
        <span className="text-[13px] font-semibold text-[#0f172a] tracking-tight">
          Startup Intelligence Radar
        </span>
        <span className="text-[9px] font-medium text-[#94a3b8] bg-[#f1f5f9] px-1.5 py-0.5 rounded">
          beta
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10.5px] text-[#cbd5e1]">
          {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button
          onClick={handleGenerate}
          onContextMenu={handleContextMenu}
          disabled={loading}
          aria-label="Refresh signals"
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium
            border transition-all duration-150
            ${loading
              ? 'bg-[#f8fafc] text-[#94a3b8] border-[#e2e8f0] cursor-wait'
              : 'bg-white text-[#475569] border-[#e2e8f0] hover:border-[#cbd5e1] cursor-pointer'
            }
          `}
        >
          {loading ? (
            <span className="inline-block w-3 h-3 border-[1.5px] border-[#cbd5e1] border-t-[#475569] rounded-full animate-spin" />
          ) : (
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M14 8A6 6 0 114.8 3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M5 1l-1 3 3 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {btnText}
        </button>
      </div>
    </header>
  );
}
