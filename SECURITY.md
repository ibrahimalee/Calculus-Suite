# Security

The app runs in the browser. It has no server, accounts or analytics, and nothing a user types is executed: expressions go through a math.js whitelist and everything shown is HTML-escaped.

If you find a vulnerability (script injection through an input, a shared link, an imported notebook or worksheet file, or a scanned image), please report it privately with GitHub's "Report a vulnerability" on this repository rather than in a public issue, and include steps to reproduce.

What is in place:

- A Content-Security-Policy in `vercel.json`: scripts only from this origin plus pinned hashes for the inline ones, no external connections, no plugins. `'unsafe-eval'` is needed because the maths library compiles expressions with `new Function`, which is why input is parsed through the whitelist first.
- Every library is vendored, with no CDN fallback.
- Worksheet, notebook and question-bank files and links are validated and size-limited, and shown as text.
- The classroom tools are for homework and low-stakes quizzes. In practice mode a student can read the answer key, a student can fabricate a submission code, and the timer runs in the student's browser.
