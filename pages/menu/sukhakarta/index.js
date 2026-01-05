// pages/menu/sukhakarta/index.js
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../../../lib/supabaseClient';

const LOGO_URL = '/logo.png';
const WEBSITE_URL = 'https://sukhakarta-menu.vercel.app/menu/sukhakarta';
const WHATSAPP_NUMBER = '918087541496';
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzGgdzhju1saQtH1aDKqVWgp0yFEn2TK-6bgHmDxSlQVsrCdU4UbRv5qd8LgkFU8f_h/exec';

export default function SukhakartaMenu() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [roomNo, setRoomNo] = useState('');
  const [roomError, setRoomError] = useState('');

  const [vegFilter, setVegFilter] = useState('all');
  const [vegSort, setVegSort] = useState('default');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: cats, error: catErr } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      const { data: menu, error: itemErr } = await supabase
        .from('menu_items')
        .select('*')
        .eq('available', true)
        .order('created_at', { ascending: true });

      if (catErr || itemErr) console.error(catErr || itemErr);

      setCategories(cats || []);
      setItems(menu || []);
      if (cats && cats.length > 0) setActiveCategoryId(cats[0].id);
      setLoading(false);
    };

    loadData();
  }, []);

  const filteredItemsByCategory = activeCategoryId
    ? items.filter((i) => i.category_id === activeCategoryId)
    : items;

  const displayItems = (() => {
    let arr = filteredItemsByCategory.slice();

    if (vegFilter === 'veg') {
      arr = arr.filter((i) => i.veg === true);
    } else if (vegFilter === 'nonveg') {
      arr = arr.filter((i) => i.veg === false);
    }

    if (vegSort === 'veg-first') {
      arr.sort((a, b) => {
        if (a.veg === b.veg) return 0;
        return a.veg ? -1 : 1;
      });
    } else if (vegSort === 'nonveg-first') {
      arr.sort((a, b) => {
        if (a.veg === b.veg) return 0;
        return a.veg ? 1 : -1;
      });
    }
    return arr;
  })();

  const getQuantity = (id) => quantities[id] || 0;

  // NEW: Modified to respect minimum quantity
  const changeQuantity = (id, delta) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const minQty = item.min_quantity || 1;
    
    setQuantities((prev) => {
      const current = prev[id] || 0;
      
      // If increasing from 0, set to minimum quantity
      if (current === 0 && delta > 0) {
        return { ...prev, [id]: minQty };
      }
      
      const next = current + delta;
      
      // If decreasing and would go below minimum, remove from cart entirely
      if (next < minQty) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      
      return { ...prev, [id]: next };
    });
  };

  const cartItems = items
    .map((item) => ({
      ...item,
      qty: getQuantity(item.id),
    }))
    .filter((item) => item.qty > 0);

  const cartCount = cartItems.reduce((sum, it) => sum + it.qty, 0);
  const cartTotal = cartItems.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * it.qty,
    0
  );

  const handlePlaceOrder = () => {
    if (typeof window === 'undefined') return;
    if (!cartItems.length) {
      alert('Please add at least one item to the cart.');
      return;
    }

    if (!roomNo) {
      setRoomError('Please select your room number.');
      return;
    }
    setRoomError('');

    const payload = {
      roomNo,
      orderTotal: cartTotal,
      items: cartItems.map((it) => ({
        itemName: it.name,
        qty: it.qty,
        price: Number(it.price) || 0,
        total: (Number(it.price) || 0) * it.qty,
      })),
    };

    const lines = payload.items
      .map(
        (it) => `• ${it.qty} x ${it.itemName} — ₹${it.total.toFixed(0)}`
      )
      .join('\n');

    const message =
      `Hi, I'd like to order from Sukhakarta Holiday Home:\n\n` +
      `Room: ${roomNo}\n\n` +
      `${lines}\n\n` +
      `Total: ₹${cartTotal.toFixed(0)}`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`;

    window.open(url, '_blank');

    try {
      fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to log order to Google Sheet:', err);
    }

    setQuantities({});
  };

  return (
    <div className="page">
      <div className="card">
        <div className="logo-header">
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="logo-link"
          >
            {LOGO_URL ? (
              <Image
                src={LOGO_URL}
                alt="Sukhakarta Holiday Home Logo"
                width={120}
                height={60}
              />
            ) : (
              <span className="placeholder-logo">🏨</span>
            )}
          </a>

          <div className="titles">
            <h1>Sukhakarta Holiday Home</h1>
            <p className="subtitle">Digital Menu · Scan & Order</p>
          </div>
        </div>

        <div className="tabs-wrapper">
          <div className="tabs">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(cat.id)}
                className={`tab ${
                  activeCategoryId === cat.id ? 'tab-active' : ''
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="filters">
            <div className="filter-group">
              <label>Show</label>
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${vegFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setVegFilter('all')}
                >
                  All
                </button>
                <button
                  className={`filter-btn ${vegFilter === 'veg' ? 'active' : ''}`}
                  onClick={() => setVegFilter('veg')}
                >
                  Veg
                </button>
                <button
                  className={`filter-btn ${vegFilter === 'nonveg' ? 'active' : ''}`}
                  onClick={() => setVegFilter('nonveg')}
                >
                  Non-Veg
                </button>
              </div>
            </div>

            <div className="filter-group">
              <label>Sort</label>
              <div className="filter-buttons">
                <button
                  className={`filter-btn ${vegSort === 'default' ? 'active' : ''}`}
                  onClick={() => setVegSort('default')}
                >
                  Default
                </button>
                <button
                  className={`filter-btn ${vegSort === 'veg-first' ? 'active' : ''}`}
                  onClick={() => setVegSort('veg-first')}
                >
                  Veg first
                </button>
                <button
                  className={`filter-btn ${vegSort === 'nonveg-first' ? 'active' : ''}`}
                  onClick={() => setVegSort('nonveg-first')}
                >
                  Non-Veg first
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading && <p className="info">Loading menu…</p>}
        {!loading && !categories.length && (
          <p className="info">
            No categories yet. Please add some from the admin panel.
          </p>
        )}
        {!loading && categories.length > 0 && displayItems.length === 0 && (
          <p className="info">No items in this category / filter yet.</p>
        )}

        <div className="items">
          {displayItems.map((item, index) => {
            const qty = getQuantity(item.id);
            const minQty = item.min_quantity || 1;
            
            return (
              <article
                key={item.id}
                className="item"
                style={{ animationDelay: `${0.04 * index}s` }}
              >
                <div className="item-image">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} />
                  ) : (
                    <div className="image-placeholder">🍽️</div>
                  )}
                </div>

                <div className="item-content">
                  <div className="item-row">
                    <h3>{item.name}</h3>
                    {item.price != null && (
                      <span className="price">
                        ₹{Number(item.price).toFixed(0)}
                      </span>
                    )}
                  </div>

                  {item.description && (
                    <p className="description">{item.description}</p>
                  )}

                  <div className="bottom-row">
                    <div className="tags">
                      <span className={`pill ${item.veg ? 'veg' : 'nonveg'}`}>
                        <span className="dot" /> {item.veg ? 'Veg' : 'Non-Veg'}
                      </span>
                      
                      {/* NEW: Show minimum quantity badge if > 1 */}
                      {minQty > 1 && (
                        <span className="min-qty-badge">
                          Min: {minQty}
                        </span>
                      )}
                    </div>

                    <div className="actions">
                      <div className="qty-wrapper">
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => changeQuantity(item.id, -1)}
                        >
                          −
                        </button>
                        <span className="qty-value">{qty}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => changeQuantity(item.id, +1)}
                        >
                          +
                        </button>
                      </div>
                      {qty > 0 && (
                        <span className="in-cart-tag">In cart</span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Add spacing at bottom when cart is visible */}
        {cartItems.length > 0 && <div style={{ height: '140px' }} />}
      </div>

      {/* Sticky cart bar - now outside main card and always visible when items in cart */}
      {cartItems.length > 0 && (
        <div className="cart-shell">
          <div className="cart-bar">
            <div className="cart-main">
              <div className="cart-info">
                <span>
                  {cartCount} item{cartCount > 1 ? 's' : ''}
                </span>
                <span>₹{cartTotal.toFixed(0)}</span>
              </div>

              <div className="room-select">
                <span className="room-label">Room</span>
                <div className="room-buttons">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`room-btn ${
                        roomNo === String(n) ? 'room-btn-active' : ''
                      }`}
                      onClick={() => setRoomNo(String(n))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="cart-btn"
              onClick={handlePlaceOrder}
            >
              Place Order
            </button>
          </div>
          {roomError && <p className="room-error">{roomError}</p>}
        </div>
      )}

      <style jsx>{`
      </div>

      <style jsx>{`
        * {
          box-sizing: border-box;
        }
        
        .page {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 28px 12px 32px;
          background: radial-gradient(
            circle at top,
            #fff7e6 0%,
            #e5e7eb 60%,
            #f9fafb 100%
          );
          font-family: system-ui, -apple-system, BlinkMacSystemFont,
            'Segoe UI', sans-serif;
        }

        .card {
          width: 100%;
          max-width: 760px;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(16px);
          border-radius: 24px;
          padding: 18px 16px 24px;
          margin-top: 4px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
          animation: floatIn 0.45s ease-out;
          position: relative;
        }

        .logo-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .logo-link {
          text-decoration: none;
        }

        .placeholder-logo {
          font-size: 30px;
        }

        .titles {
          text-align: left;
        }

        h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }

        .subtitle {
          margin: 2px 0 4px;
          font-size: 13px;
          color: #6b7280;
        }

        .tabs-wrapper {
          margin: 4px -4px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 2px 6px;
        }

        .filters {
          display: flex;
          gap: 14px;
          align-items: center;
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .filter-group {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .filter-group label {
          font-size: 12px;
          color: #374151;
          margin-right: 6px;
        }

        .filter-buttons {
          display: inline-flex;
          gap: 6px;
        }

        .filter-btn {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          cursor: pointer;
          font-size: 12px;
        }

        .filter-btn.active {
          background: linear-gradient(135deg, #f97316, #fb923c);
          color: #fff;
          border-color: transparent;
          box-shadow: 0 8px 18px rgba(249, 115, 22, 0.18);
        }

        .tabs::-webkit-scrollbar {
          height: 3px;
        }

        .tabs::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 999px;
        }

        .tab {
          flex-shrink: 0;
          padding: 7px 16px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          font-size: 13px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.18s ease-out;
        }

        .tab-active {
          background: linear-gradient(135deg, #f97316, #fb923c);
          color: white;
          border-color: transparent;
          box-shadow: 0 10px 20px rgba(248, 113, 22, 0.45);
          transform: translateY(-2px);
        }

        .tab:hover:not(.tab-active) {
          background: #f3f4f6;
          transform: translateY(-1px);
        }

        .info {
          text-align: center;
          font-size: 13px;
          color: #6b7280;
          margin: 8px 0 4px;
        }

        .items {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 6px;
        }

        .item {
          display: flex;
          gap: 12px;
          padding: 10px;
          border-radius: 18px;
          background: radial-gradient(circle at top left, #fff7ed, #ffffff);
          border: 1px solid #f3f4f6;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
          transition: transform 0.16s ease-out, box-shadow 0.16s ease-out,
            border-color 0.16s;
          animation: itemIn 0.32s ease-out both;
        }

        .item:hover {
          transform: translateY(-2px) scale(1.01);
          box-shadow: 0 16px 34px rgba(15, 23, 42, 0.16);
          border-color: #fed7aa;
        }

        .item-image {
          width: 110px;
          height: 110px;
          border-radius: 18px;
          overflow: hidden;
          flex-shrink: 0;
          background: #fee2e2;
        }

        .item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          opacity: 0;
          transform: scale(1.03);
          animation: imgFadeIn 0.35s ease-out forwards;
        }

        .image-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #fee2e2, #fffbeb);
          font-size: 26px;
        }

        .item-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 4px;
        }

        .item-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        h3 {
          margin: 0;
          font-size: 15px;
        }

        .price {
          font-weight: 600;
          font-size: 15px;
        }

        .description {
          margin: 3px 0 4px;
          font-size: 13px;
          color: #6b7280;
        }

        .bottom-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .tags {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
        }

        .veg {
          background: #ecfdf3;
          color: #166534;
        }

        .nonveg {
          background: #fef2f2;
          color: #b91c1c;
        }

        .dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: currentColor;
        }

        .min-qty-badge {
          display: inline-flex;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 600;
          background: #fef3c7;
          color: #92400e;
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .qty-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border-radius: 999px;
          padding: 2px 6px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .qty-btn {
          border: none;
          background: transparent;
          font-size: 16px;
          line-height: 1;
          padding: 2px 6px;
          cursor: pointer;
          transition: opacity 0.15s;
        }

        .qty-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .qty-value {
          min-width: 20px;
          text-align: center;
          font-size: 13px;
          font-weight: 500;
        }

        .in-cart-tag {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 999px;
          background: #dcfce7;
          color: #166534;
        }

        .cart-shell {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 0 12px 12px 12px;
          background: transparent;
          z-index: 1000;
          pointer-events: none;
        }

        .cart-bar {
          max-width: 760px;
          margin: 0 auto;
          padding: 14px 16px;
          border-radius: 20px;
          background: rgba(15, 23, 42, 0.97);
          backdrop-filter: blur(16px);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          color: #e5e7eb;
          box-shadow: 0 -10px 40px rgba(15, 23, 42, 0.5),
                      0 4px 20px rgba(0, 0, 0, 0.3);
          pointer-events: auto;
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .cart-main {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .cart-info {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
        }

        .cart-info span:last-child {
          font-weight: 600;
        }

        .room-select {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .room-label {
          opacity: 0.9;
        }

        .room-buttons {
          display: inline-flex;
          gap: 4px;
        }

        .room-btn {
          border-radius: 999px;
          border: 1px solid #4b5563;
          padding: 2px 8px;
          font-size: 11px;
          background: transparent;
          color: #e5e7eb;
          cursor: pointer;
        }

        .room-btn-active {
          background: #22c55e;
          border-color: #22c55e;
          color: #0f172a;
        }

        .cart-btn {
          border: none;
          border-radius: 999px;
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 600;
          background: linear-gradient(135deg, #16a34a, #22c55e);
          color: #f9fafb;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(22, 163, 74, 0.5);
          white-space: nowrap;
        }

        .room-error {
          text-align: center;
          margin: 8px 0 0;
          font-size: 11px;
          color: #fecaca;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(120px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes floatIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes itemIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes imgFadeIn {
          from {
            opacity: 0;
            transform: scale(1.03);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (max-width: 480px) {
          .card {
            border-radius: 20px;
            padding: 14px 12px 20px;
          }
          .item-image {
            width: 90px;
            height: 90px;
          }
          .bottom-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .actions {
            width: 100%;
            justify-content: flex-end;
          }
          .cart-shell {
            padding: 0 8px 8px 8px;
          }
          .cart-bar {
            flex-direction: column;
            align-items: stretch;
            border-radius: 16px;
            padding: 12px;
            gap: 10px;
          }
          .cart-main {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }
          .cart-info {
            width: 100%;
          }
          .room-select {
            width: 100%;
          }
          .cart-btn {
            width: 100%;
            text-align: center;
            padding: 10px 16px;
            font-size: 14px;
          }
          .filters {
            flex-direction: column;
            gap: 6px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
