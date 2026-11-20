# Security

The app runs in the browser. It has no server, accounts or analytics, and nothing a user types is executed: expressions go through a math.js whitelist and everything shown is HTML-escaped.

If you find a vulnerability (script injection through an input, a shared link, an imported notebook or worksheet file, or a scanned image), please report it privately with GitHub's "Report a vulnerability" on this repository rather than in a public issue, and include steps to reproduce.

What is in place:

- A Content-Security-Policy in `vercel.json`: scripts only from this origin plus pinned hashes for the inline ones, no external connections, no plugins. `'unsafe-eval'` is needed because the maths library compiles expressions with `new Function`, which is why input is parsed through the whitelist first.
- The home page, tool pages and 404 page run with no `eval` at all and cannot be framed; only the calculator can be embedded, by design. Responses also carry `Cross-Origin-Opener-Policy`, a restrictive `Permissions-Policy` and `nosniff`, and the policy upgrades insecure requests.
- Tests, scripts and dev files are excluded from the deployment (`.vercelignore`), and `/.well-known/security.txt` says where to report problems.
- Every library is vendored, with no CDN fallback; the pinned versions have no known advisories (checked with `npm audit` and the npm advisory database).
- Worksheet, notebook and question-bank files and links are validated and size-limited, and shown as text.
- The classroom tools are for homework and low-stakes quizzes. In practice mode a student can read the answer key, a student can fabricate a submission code, and the timer runs in the student's browser.
