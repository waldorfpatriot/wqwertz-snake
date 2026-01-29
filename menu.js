/**
 * Shared navigation menu for qwertz games.
 * Renders once: sidebar on wide screens, burger + overlay on narrow.
 * Dispatches custom events for page-specific handlers (stats, admin, restart, tutorial).
 */
(function () {
    const MENU_BREAKPOINT = 900;
    const SIDEBAR_ID = 'app-menu';
    const BURGER_ID = 'menuBurger';
    const SIDEBAR_OVERLAY_CLASS = 'sidebar-overlay-open';
    const BACKDROP_ID = 'sidebarBackdrop';

    function buildMenuHTML() {
        return `
<button type="button" class="sidebar-close" id="sidebarClose" aria-label="Menü schließen">&times;</button>
<ul class="sidebar-nav">
  <li><a href="#bestenliste" class="menu-item menu-link menu-action" data-action="stats">Bestenliste</a></li>
  <li><a href="#admin" class="menu-item menu-link menu-action" data-action="admin">Admin</a></li>
  <li><a href="#neustart" class="menu-item menu-link menu-action" data-action="restart">Neustart</a></li>
  <li>
    <button type="button" class="menu-item menu-item-with-sub" data-action="tutorial" aria-expanded="true">Hilfe</button>
    <ul class="sidebar-sub open">
      <li><a href="#tutorial-step-1" class="menu-item sub menu-link">Warum dieses Spiel?</a></li>
      <li><a href="#tutorial-step-2" class="menu-item sub menu-link">Spielprinzip</a></li>
      <li><a href="#tutorial-step-3" class="menu-item sub menu-link">Fingerplatzierung und Grundreihe</a></li>
      <li><a href="#tutorial-step-4" class="menu-item sub menu-link">Fingerzuordnung</a></li>
      <li><a href="#tutorial-step-5" class="menu-item sub menu-link">Farbcodierung</a></li>
      <li><a href="#tutorial-step-6" class="menu-item sub menu-link">Die Benutzeroberfläche</a></li>
    </ul>
  </li>
  <li>
    <button type="button" class="menu-item menu-item-with-sub" aria-expanded="true">qwertzpiele</button>
    <ul class="sidebar-sub open">
      <li><a href="index.html" class="menu-item sub menu-link">qwertznake</a></li>
      <li><a href="tetris.html" class="menu-item sub menu-link">qwertzris</a></li>
      <li><span class="menu-item sub disabled">qwertz ball</span></li>
      <li><span class="menu-item sub disabled">qwertz breaker</span></li>
      <li><span class="menu-item sub disabled">qwertz plummer</span></li>
      <li><span class="menu-item sub disabled">qwertz man</span></li>
      <li><span class="menu-item sub disabled">qwertzoids</span></li>
      <li><span class="menu-item sub disabled">qwertztreat</span></li>
      <li><span class="menu-item sub disabled">qwertzout</span></li>
    </ul>
  </li>
</ul>
`;
    }

    function dispatch(name, detail) {
        window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }

    function isWide() {
        return window.matchMedia('(min-width: ' + MENU_BREAKPOINT + 'px)').matches;
    }

    function init() {
        var sidebar = document.getElementById(SIDEBAR_ID);
        if (!sidebar) return;

        sidebar.classList.add('sidebar');
        sidebar.innerHTML = buildMenuHTML();

        var header = document.querySelector('.container header');
        if (!header) return;

        var burger = document.createElement('button');
        burger.type = 'button';
        burger.className = 'menu-burger';
        burger.id = BURGER_ID;
        burger.setAttribute('aria-label', 'Menü öffnen');
        burger.innerHTML = '<span></span><span></span><span></span>';
        header.insertBefore(burger, header.firstChild);

        var closeBtn = sidebar.querySelector('#sidebarClose');
        var nav = sidebar.querySelector('.sidebar-nav');

        function closeOverlay() {
            document.body.classList.remove(SIDEBAR_OVERLAY_CLASS);
            var b = document.getElementById(BACKDROP_ID);
            if (b) b.remove();
        }

        function openOverlay() {
            document.body.classList.add(SIDEBAR_OVERLAY_CLASS);
            var b = document.getElementById(BACKDROP_ID);
            if (!b) {
                b = document.createElement('div');
                b.id = BACKDROP_ID;
                b.className = 'sidebar-backdrop';
                b.setAttribute('aria-hidden', 'true');
                document.body.appendChild(b);
                b.addEventListener('click', closeOverlay);
            }
        }

        function toggleOverlay() {
            if (document.body.classList.contains(SIDEBAR_OVERLAY_CLASS)) {
                closeOverlay();
            } else {
                openOverlay();
            }
        }

        burger.addEventListener('click', function () {
            toggleOverlay();
        });
        if (closeBtn) {
            closeBtn.addEventListener('click', closeOverlay);
        }

        nav.addEventListener('click', function (e) {
            var item = e.target.closest('.menu-item');
            if (!item || item.classList.contains('disabled')) return;
            if (item.classList.contains('menu-link') && !item.classList.contains('menu-action')) return;

            var action = item.getAttribute('data-action');
            var step = item.getAttribute('data-step');

            if (action === 'stats' || action === 'admin' || action === 'restart') {
                closeOverlay();
                return;
            }
            if (item.classList.contains('menu-action')) {
                e.preventDefault();
            }

            if (action === 'tutorial') {
                closeOverlay();
            }
        });

        nav.querySelectorAll('.menu-item-with-sub').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                if (e.target.closest('.menu-link')) return;
                var sub = this.nextElementSibling;
                if (sub && sub.classList.contains('sidebar-sub')) {
                    sub.classList.toggle('open');
                    this.setAttribute('aria-expanded', sub.classList.contains('open'));
                }
            });
        });

        window.addEventListener('resize', function () {
            if (isWide()) {
                closeOverlay();
            }
        });

        window.addEventListener('hashchange', function () {
            var h = window.location.hash.substring(1);
            if (h === 'bestenliste' || h === 'admin' || h === 'neustart' || h.indexOf('tutorial-step-') === 0) closeOverlay();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
