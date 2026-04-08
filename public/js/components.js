/* NHD Shared Components — injects nav, footer, back-to-top */
(function () {
  'use strict';

  const NAV_HTML = `
  <nav class="navbar">
    <div class="container">
      <a href="/" class="nav-brand">Nina's Homemade Delights</a>
      <div class="nav-links" id="nav-links">
        <div class="nav-dropdown">
          <button class="nav-dropdown-toggle" aria-expanded="false">
            Shop
            <svg viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <div class="nav-dropdown-menu">
            <a href="/category/all-products.html">All Products</a>
            <a href="/category/featured.html">Featured</a>
            <a href="/category/cakes.html">Cakes</a>
            <a href="/category/cakesters.html">Cakesters</a>
            <a href="/category/treats.html">Treats</a>
            <a href="/category/cookies.html">Cookies</a>
            <a href="/category/bundle.html">Bundle</a>
          </div>
        </div>
        <a href="/about.html" class="nav-link">Our Story</a>
        <a href="/order-delivery-pickup.html" class="nav-link">Order &amp; Delivery</a>
        <a href="/contact.html" class="nav-link">Contact</a>
        <a href="/refund.html" class="nav-link">Returns</a>
        <button class="nav-cart" onclick="NHDCart.open()" aria-label="Open cart">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
          <span class="cart-count" style="display:none">0</span>
        </button>
      </div>
      <button class="nav-toggle" id="nav-toggle" aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>
    </div>
  </nav>`;

  const FOOTER_HTML = `
  <footer class="footer">
    <div class="container">
      <div class="footer-grid">
        <div>
          <h4>Nina's Homemade Delights</h4>
          <p>Small-batch cakes and desserts made with premium spirits, real chocolate, and ingredients you can taste.</p>
        </div>
        <div>
          <h4>Shop</h4>
          <div class="footer-links">
            <a href="/category/all-products.html">All Products</a>
            <a href="/category/cakes.html">Cakes</a>
            <a href="/category/cakesters.html">Cakesters</a>
            <a href="/category/treats.html">Treats</a>
            <a href="/category/cookies.html">Cookies</a>
          </div>
        </div>
        <div>
          <h4>Company</h4>
          <div class="footer-links">
            <a href="/about.html">Our Story</a>
            <a href="/contact.html">Contact Us</a>
            <a href="/order-delivery-pickup.html">Order &amp; Delivery</a>
            <a href="/refund.html">Refund Request</a>
          </div>
        </div>
        <div>
          <h4>Stay in Touch</h4>
          <p class="mb-2">Get special offers, recipes, and baking tips.</p>
          <form class="footer-subscribe" id="footer-subscribe">
            <input type="email" placeholder="Your email" required />
            <button type="submit">Join</button>
          </form>
        </div>
      </div>
      <div class="footer-bottom">
        <span>&copy; ${new Date().getFullYear()} Nina's Homemade Delights. All rights reserved.</span>
        <div class="footer-social">
          <a href="https://www.facebook.com/NinasHomemadeDelights/" target="_blank" rel="noopener" aria-label="Facebook">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
        </div>
      </div>
    </div>
  </footer>`;

  function init() {
    // Google Analytics
    var gaId = 'G-PG2PCW7XFP';
    var gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + gaId;
    document.head.appendChild(gaScript);
    var gaConfig = document.createElement('script');
    gaConfig.textContent = 'window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","' + gaId + '");';
    document.head.appendChild(gaConfig);

    // Inject nav at top of body
    document.body.insertAdjacentHTML('afterbegin', NAV_HTML);

    // Inject footer before end of body (before scripts)
    const scripts = document.body.querySelectorAll('script');
    if (scripts.length) {
      scripts[0].insertAdjacentHTML('beforebegin', FOOTER_HTML);
    } else {
      document.body.insertAdjacentHTML('beforeend', FOOTER_HTML);
    }

    // Back to top button
    const btt = document.createElement('a');
    btt.href = '#';
    btt.className = 'back-to-top';
    btt.innerHTML = '&uarr;';
    btt.setAttribute('aria-label', 'Back to top');
    btt.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btt);

    window.addEventListener('scroll', function () {
      btt.classList.toggle('visible', window.scrollY > 400);
    });

    // Mobile menu toggle
    const toggle = document.getElementById('nav-toggle');
    const links = document.getElementById('nav-links');

    // Create scrim overlay as a sibling (outside the drawer)
    var navScrim = document.createElement('div');
    navScrim.className = 'nav-scrim';
    document.body.appendChild(navScrim);

    function closeMenu() {
      links.classList.remove('open');
      toggle.classList.remove('open');
      navScrim.classList.remove('open');
    }
    function openMenu() {
      links.classList.add('open');
      toggle.classList.add('open');
      navScrim.classList.add('open');
    }

    if (toggle && links) {
      toggle.addEventListener('click', function () {
        if (links.classList.contains('open')) { closeMenu(); }
        else { openMenu(); }
      });
    }

    // Close mobile menu when a nav link is tapped
    document.querySelectorAll('.nav-links .nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 768) closeMenu();
      });
    });

    // Close on scrim tap
    navScrim.addEventListener('click', closeMenu);

    // Dropdown toggles (mobile)
    // Use inline cssText to blast away ALL desktop CSS — no specificity fights
    var MOBILE_MENU_HIDDEN = 'display:none !important;';
    var MOBILE_MENU_VISIBLE = 'display:block !important; position:static !important; opacity:1 !important; visibility:visible !important; transform:none !important; box-shadow:none !important; background:transparent !important; padding:0 !important; min-width:0 !important; border-radius:0 !important; transition:none !important; z-index:auto !important;';
    var MOBILE_LINK_STYLE = 'display:block; padding:0.65rem 0 0.65rem 1.25rem; font-size:0.9rem; font-weight:500; color:#c9a090; letter-spacing:0.02em; text-transform:none; text-decoration:none;';

    document.querySelectorAll('.nav-dropdown-toggle').forEach(function (btn) {
      var menu = btn.nextElementSibling;
      var chevron = btn.querySelector('svg');
      var menuOpen = false;

      function applyMobileStyles() {
        if (window.innerWidth <= 768 && menu) {
          // Style the sub-links
          var subLinks = menu.querySelectorAll('a');
          subLinks.forEach(function (a) { a.style.cssText = MOBILE_LINK_STYLE; });
          // Hide menu
          menu.style.cssText = MOBILE_MENU_HIDDEN;
          menuOpen = false;
        }
      }

      // Apply on load
      applyMobileStyles();
      // Re-apply on resize
      window.addEventListener('resize', applyMobileStyles);

      btn.addEventListener('click', function (e) {
        if (window.innerWidth <= 768 && menu) {
          e.preventDefault();
          e.stopPropagation();
          if (menuOpen) {
            menu.style.cssText = MOBILE_MENU_HIDDEN;
            menuOpen = false;
            if (chevron) chevron.style.transform = '';
          } else {
            menu.style.cssText = MOBILE_MENU_VISIBLE;
            menuOpen = true;
            if (chevron) chevron.style.transform = 'rotate(180deg)';
          }
        }
      });
    });

    // Highlight current nav link
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(function (link) {
      if (link.getAttribute('href') === path) {
        link.style.color = 'var(--color-accent)';
      }
    });

    // Newsletter subscribe
    var subForm = document.getElementById('footer-subscribe');
    if (subForm) {
      subForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var input = this.querySelector('input');
        var email = input.value;
        fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        }).then(function(r) { return r.json(); })
        .then(function(data) {
          input.value = '';
          alert(data.message || 'Thanks for subscribing!');
        }).catch(function() {
          alert('Could not subscribe. Please try again.');
        });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
