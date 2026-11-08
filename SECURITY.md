# Security policy

The app runs entirely in the browser; it has no server, accounts or tracking, and user input is never executed (expressions are parsed through a math.js AST whitelist, and all text shown is HTML-escaped).

If you find a vulnerability (for example script injection through an input, a shared link, an imported notebook file or a scanned image), please **do not open a public issue**. Report it privately through GitHub's *Security → Report a vulnerability* for this repository, with steps to reproduce. We aim to acknowledge reports within a few days.

## What is in place

- **No server, no accounts, no analytics.** Nothing a user types leaves their browser. Classroom worksheets travel inside links and student answers travel back as codes the teacher pastes in; the answer key stays on the teacher's device unless the teacher switches on practice mode.
- **Untrusted input is never executed.** Expressions (including students' answers) go through a math.js AST whitelist; text is HTML-escaped; worksheet and notebook files are validated and size-limited; mode names from links and files are looked up in a prototype-free table.
- **Content-Security-Policy** (see `vercel.json`): scripts only from this origin plus three pinned inline-script hashes, no plugins, no external connections, no `<base>` tricks, forms only to this origin. The classroom pages cannot be framed by other sites; the calculator can (on purpose, for the embed feature).
- **No third-party scripts at runtime.** Every library is vendored, and there is no CDN fallback.
- **Known trade-off:** the policy needs `'unsafe-eval'` because the maths library compiles expressions with `new Function`; this is why input is parsed through the whitelist first. `'unsafe-inline'` is allowed for styles only (KaTeX and Plotly set inline styles).
- **Classroom limits (by design):** a student can read the key in practice-mode worksheets, can fabricate a submission code, and can bypass the browser-side timer. Use it for homework, practice and low-stakes quizzes.

Last reviewed with a manual and automated scan: dependency audit (no known advisories for the shipped versions), static analysis, fuzzing of every tool, hostile-link and hostile-file probes, and a full browser run under the policy.
