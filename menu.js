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
    const NEUSTART_CONFIRM_ID = 'neustartConfirmOverlay';

    function buildMenuHTML() {
        return `
<button type="button" class="sidebar-close" id="sidebarClose" aria-label="Menü schließen">&times;</button>
<ul class="sidebar-nav">
  <li><a href="#bestenliste" class="menu-item menu-link menu-action" data-action="stats">Bestenliste</a></li>
  <li><a href="#einstellungen" class="menu-item menu-link menu-action" data-action="settings">Einstellungen</a></li>
  <li><a href="#admin" class="menu-item menu-link menu-action" data-action="admin">Admin</a></li>
  <li><a href="#neustart" class="menu-item menu-link menu-action" data-action="restart">Neustart</a></li>
  <li>
    <button type="button" class="menu-item menu-item-with-sub" data-action="tutorial" aria-expanded="false">Hilfe</button>
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
    <button type="button" class="menu-item menu-item-with-sub" aria-expanded="false">qwertzpiele</button>
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
        document.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
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

        function showNeustartConfirm(callback) {
            var existing = document.getElementById(NEUSTART_CONFIRM_ID);
            if (existing) return;
            var overlay = document.createElement('div');
            overlay.id = NEUSTART_CONFIRM_ID;
            overlay.className = 'neustart-confirm-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-labelledby', 'neustart-confirm-title');
            overlay.innerHTML = '<div class="neustart-confirm-box">' +
                '<p id="neustart-confirm-title" class="neustart-confirm-message">Möchtest du wirklich das Spiel von vorne beginnen, ohne dich in die Bestenliste einzutragen?</p>' +
                '<div class="neustart-confirm-buttons">' +
                '<button type="button" class="neustart-confirm-btn neustart-confirm-ja">Ja</button>' +
                '<button type="button" class="neustart-confirm-btn neustart-confirm-abbrechen">Abbrechen</button>' +
                '</div></div>';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) {
                    overlay.remove();
                    if (callback) callback(false);
                }
            });
            overlay.querySelector('.neustart-confirm-ja').addEventListener('click', function () {
                overlay.remove();
                if (callback) callback(true);
            });
            overlay.querySelector('.neustart-confirm-abbrechen').addEventListener('click', function () {
                overlay.remove();
                if (callback) callback(false);
            });
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
            /* Don’t close overlay when only expanding/collapsing a submenu */
            if (item.classList.contains('menu-item-with-sub')) return;

            var action = item.getAttribute('data-action');
            var step = item.getAttribute('data-step');

            if (action === 'stats' || action === 'admin' || action === 'settings') {
                closeOverlay();
                return;
            }
            if (action === 'restart') {
                e.preventDefault();
                closeOverlay();
                showNeustartConfirm(function (confirmed) {
                    if (confirmed) dispatch('menu-restart');
                });
                return;
            }
            if (item.classList.contains('menu-action')) {
                e.preventDefault();
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
            if (h === 'bestenliste' || h === 'einstellungen' || h === 'admin' || h === 'neustart' || h.indexOf('tutorial-step-') === 0) closeOverlay();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
