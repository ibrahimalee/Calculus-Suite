# Security policy

The app runs entirely in the browser; it has no server, accounts or tracking, and user input is never executed (expressions are parsed through a math.js AST whitelist, and all text shown is HTML-escaped).

If you find a vulnerability (for example script injection through an input, a shared link, an imported notebook file or a scanned image), please **do not open a public issue**. Report it privately through GitHub's *Security → Report a vulnerability* for this repository, with steps to reproduce. We aim to acknowledge reports within a few days.
