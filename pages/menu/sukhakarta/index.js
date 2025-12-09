// pages/menu/sukhakarta/index.js
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../../../lib/supabaseClient';

const LOGO_URL = '/logo.png'; // put logo file in /public/logo.png
const WEBSITE_URL = 'https://sukhakarta-menu.vercel.app/menu/sukhakarta'; // TODO: change to your real site
const WHATSAPP_NUMBER = '918087541496'; // your WhatsApp number
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxCsG4qfcHe1n0aY4J6j-mRgY7CnmoKUVNOghsC904GmnCvc0TWigpgSCp-GZ9u4QLl/exec'; 
// e.g. 'https://script.google.com/macros/s/AKfycbx.../exec'

export default function SukhakartaMenu() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({}); // item.id -> quantity

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

  const filteredItems = activeCategoryId
    ? items.filter((i) => i.category_id === activeCategoryId)
    : items;

  // --------- Quantity helpers ----------
  const getQuantity = (id) => quantities[id] || 0;

  const changeQuantity = (id, delta) => {
    setQuantities((prev) => {
      const current = prev[id] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  // --------- Cart derived values ----------
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

  const handlePlaceOrder = async () => {
    if (typeof window === 'undefined') return;
    if (!cartItems.length) {
      alert('Please add at least one item to the cart.');
      return;
    }
  
    const roomNo = window.prompt('Please enter your room number:');
    if (!roomNo) return;
  
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
  
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to log order:', err);
    }
  
    const lines = payload.items
      .map((it) => `• ${it.qty} x ${it.itemName} – ₹${it.total.toFixed(0)}`)
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
    setQuantities({});
  };
  return (
    <div className="page">
      <div className="card">
        {/* ---------- LOGO + HEADER ---------- */}
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

        {/* ---------- CATEGORY TABS ---------- */}
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

        {loading && <p className="info">Loading menu…</p>}
        {!loading && !categories.length && (
          <p className="info">
            No categories yet. Please add some from the admin panel.
          </p>
        )}
        {!loading && categories.length > 0 && filteredItems.length === 0 && (
          <p className="info">No items in this category yet.</p>
        )}

        {/* ---------- MENU ITEMS ---------- */}
        <div className="items">
          {filteredItems.map((item, index) => {
            const qty = getQuantity(item.id);
            return (
              <article
                key={item.id}
                className="item"
                style={{ animationDelay: `${0.04 * index}s` }} // staggered animation
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
                    <span className={`pill ${item.veg ? 'veg' : 'nonveg'}`}>
                      <span className="dot" /> {item.veg ? 'Veg' : 'Non-Veg'}
                    </span>

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

        {/* ---------- CART BAR ---------- */}
        {cartItems.length > 0 && (
          <div className="cart-bar">
            <div className="cart-info">
              <span>
                {cartCount} item{cartCount > 1 ? 's' : ''}
              </span>
              <span>₹{cartTotal.toFixed(0)}</span>
            </div>
            <button
              type="button"
              className="cart-btn"
              onClick={handlePlaceOrder}
            >
              Place Order
            </button>
          </div>
        )}
      </div>

      {/* ---------- STYLES ---------- */}
      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 24px 12px 32px;
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
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.18);
          animation: floatIn 0.45s ease-out;
          position: relative;
        }

        /* Header with logo */
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

        .tabs {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          margin: 10px -2px 14px;
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

        /* Cart bar */
        .cart-bar {
          position: sticky;
          bottom: 0;
          margin-top: 16px;
          padding: 8px 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.85);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          color: #e5e7eb;
        }

        .cart-info {
          display: flex;
          flex-direction: column;
          font-size: 13px;
        }

        .cart-info span:last-child {
          font-weight: 600;
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
          .cart-bar {
            border-radius: 16px;
          }
        }
      `}</style>
    </div>
  );
}
