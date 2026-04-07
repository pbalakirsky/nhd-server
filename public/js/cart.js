/* NHD Cart System — localStorage-based, vanilla JS */
(function () {
  'use strict';

  const CART_KEY = 'nhd_cart';

  /* ---- helpers ---- */
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }

  function cartKey(item) {
    const opts = (item.options || []).slice().sort().join('|');
    return item.name + '::' + opts;
  }

  /* ---- public API ---- */
  window.NHDCart = {
    getItems: getCart,

    addItem(item) {
      // item: { name, price, image, quantity, options[] }
      const cart = getCart();
      const key = cartKey(item);
      const existing = cart.find(i => cartKey(i) === key);
      if (existing) {
        existing.quantity += (item.quantity || 1);
      } else {
        cart.push({ ...item, quantity: item.quantity || 1 });
      }
      saveCart(cart);
      this.render();
      this.open();
    },

    removeItem(index) {
      const cart = getCart();
      cart.splice(index, 1);
      saveCart(cart);
      this.render();
    },

    updateQuantity(index, qty) {
      const cart = getCart();
      if (qty < 1) { cart.splice(index, 1); }
      else { cart[index].quantity = qty; }
      saveCart(cart);
      this.render();
    },

    clear() { saveCart([]); this.render(); },

    getTotal() {
      return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0);
    },

    getCount() {
      return getCart().reduce((sum, i) => sum + i.quantity, 0);
    },

    /* ---- checkout ---- */
    async checkout() {
      const cart = getCart();
      if (!cart.length) return;
      const btn = document.getElementById('cart-checkout-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }
      try {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: cart.map(i => ({
            name: i.name + (i.options && i.options.length ? ' (' + i.options.join(', ') + ')' : ''),
            price: i.price,
            quantity: i.quantity,
            image: i.image
          })) })
        });
        const data = await res.json();
        if (data.url) { window.location.href = data.url; }
        else { alert('Something went wrong. Please try again.'); }
      } catch (err) {
        console.error(err);
        alert('Could not connect to checkout. Please try again.');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Checkout'; }
      }
    },

    /* ---- UI rendering ---- */
    open() {
      const sidebar = document.getElementById('cart-sidebar');
      const overlay = document.getElementById('cart-overlay');
      if (sidebar) sidebar.classList.add('open');
      if (overlay) overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    },

    close() {
      const sidebar = document.getElementById('cart-sidebar');
      const overlay = document.getElementById('cart-overlay');
      if (sidebar) sidebar.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      document.body.style.overflow = '';
    },

    render() {
      const cart = getCart();
      const count = this.getCount();
      const total = this.getTotal();

      // badge
      document.querySelectorAll('.cart-count').forEach(el => {
        el.textContent = count;
        el.style.display = count > 0 ? '' : 'none';
      });

      // sidebar list
      const list = document.getElementById('cart-items');
      if (!list) return;

      if (!cart.length) {
        list.innerHTML = '<p class="cart-empty">Your cart is empty.</p>';
        const footer = document.getElementById('cart-footer');
        if (footer) footer.style.display = 'none';
        return;
      }

      const footer = document.getElementById('cart-footer');
      if (footer) footer.style.display = '';

      list.innerHTML = cart.map((item, i) => `
        <div class="cart-item">
          <img src="${item.image}" alt="${item.name}" class="cart-item-img" />
          <div class="cart-item-info">
            <p class="cart-item-name">${item.name}</p>
            ${item.options && item.options.length ? '<p class="cart-item-options">' + item.options.join(', ') + '</p>' : ''}
            <p class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</p>
            <div class="cart-item-qty">
              <button onclick="NHDCart.updateQuantity(${i}, ${item.quantity - 1})" aria-label="Decrease quantity">&minus;</button>
              <span>${item.quantity}</span>
              <button onclick="NHDCart.updateQuantity(${i}, ${item.quantity + 1})" aria-label="Increase quantity">&plus;</button>
              <button class="cart-item-remove" onclick="NHDCart.removeItem(${i})" aria-label="Remove item">&times;</button>
            </div>
          </div>
        </div>
      `).join('');

      // total
      const totalEl = document.getElementById('cart-total');
      if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
    }
  };

  /* ---- inject sidebar HTML ---- */
  function injectCartUI() {
    if (document.getElementById('cart-sidebar')) return;

    const overlay = document.createElement('div');
    overlay.id = 'cart-overlay';
    overlay.addEventListener('click', () => NHDCart.close());
    document.body.appendChild(overlay);

    const sidebar = document.createElement('div');
    sidebar.id = 'cart-sidebar';
    sidebar.innerHTML = `
      <div class="cart-header">
        <h3>Your Cart</h3>
        <button class="cart-close" onclick="NHDCart.close()" aria-label="Close cart">&times;</button>
      </div>
      <div id="cart-items" class="cart-items"></div>
      <div id="cart-footer" class="cart-footer" style="display:none">
        <div class="cart-total-row">
          <span>Subtotal</span>
          <span id="cart-total">$0.00</span>
        </div>
        <button id="cart-checkout-btn" class="btn btn-primary btn-full" onclick="NHDCart.checkout()">Checkout</button>
        <p class="cart-note">Shipping calculated at checkout</p>
      </div>
    `;
    document.body.appendChild(sidebar);
  }

  /* ---- init ---- */
  document.addEventListener('DOMContentLoaded', function () {
    injectCartUI();
    NHDCart.render();
  });
})();
