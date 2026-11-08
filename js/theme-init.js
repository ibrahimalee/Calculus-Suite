/* Runs before first paint so the page never flashes the wrong theme. */
(function () {
    try {
        var m = localStorage.getItem('themeMode') || localStorage.getItem('theme') || 'auto';
        var dark = m === 'dark' || (m === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
})();
