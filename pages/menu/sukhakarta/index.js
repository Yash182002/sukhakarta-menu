// pages/menu/sukhakarta/index.js
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../../../lib/supabaseClient';

const LOGO_URL = '/logo.png'; // put logo file in /public/logo.png
const WEBSITE_URL = 'https://sukhakarta-menu.vercel.app/menu/sukhakarta'; // TODO: change to your real site
const WHATSAPP_NUMBER = '918087541496'; // TODO: change to your real WhatsApp number

export default function SukhakartaMenu() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState({}); // item.id -> quantity
  const [selectedRoom, setSelectedRoom] = useState('1'); // selected room number

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

  // Quantity helpers
  const getQuantity = (id) => quantities[id] || 1;

  const changeQuantity = (id, delta) => {
    setQuantities((prev) => {
      const current = prev[id] || 1;
      const next = current + delta;
      return { ...prev, [id]: next < 1 ? 1 : next };
    });
  };

  const handleOrder = (item) => {
    const qty = getQuantity(item.id);
    const message = `Hi, I'd like to order ${qty} x *${item.name}* from Sukhakarta Holiday Home menu. Room No: ${selectedRoom}`;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="page">
      <div className="card">
        {/* ---------- LOGO + HEADER ---------- */}
        <header className="logo-header">
          <div className="logo-header-inner">
            {LOGO_URL && (
              <a
                href={WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="logo-link"
              >
                <Image
                  src={LOGO_URL}
                  alt="Sukhakarta Holiday Home Logo"
                  className="logo"
                  width={120}
                  height={52}
                />
              </a>
            )}
            <div className="titles">
              <h1>Sukhakarta Holiday Home</h1>
              <p className="subtitle">Digital Menu · Scan &amp; Order</p>
            </div>
          </div>
          <div className="room-selector-wrapper">
            <div className="room-selector">
              <label htmlFor="room-select" className="room-label">
                Room
              </label>
              <select
                id="room-select"
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="room-select"
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          </div>
        </header>

        {/* ---------- CATEGORY TABS ---------- */}
        <div className="tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`tab ${activeCategoryId === cat.id ? 'tab-active' : ''}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {loading && <p className="info">Loading menu…</p>}
        {!loading && !categories.length && (
          <p className="info">No categories yet. Please add some from the admin panel.</p>
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
                style={{ animationDelay: `${0.04 * index}s` }}
              >
                <div className="item-image">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      width={80}
                      height={80}
                    />
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

                      <button
                        type="button"
                        className="order-btn"
                        onClick={() => handleOrder(item)}
                      >
                        Order Now
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* ---------- STYLES ---------- */}
      <style jsx>{`
        .page {
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 24px 12px;
          background: radial-gradient(circle at top, #fff7e6 0%, #e5e7eb 60%, #f9fafb 100%);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
            sans-serif;
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
        }

        /* Header */
        .logo-header {
          margin-bottom: 8px;
        }

        .logo-header-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-align: center;
        }

        .logo-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .logo {
          height: 52px;
          width: auto;
          object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 8px 18px rgba(248, 113, 22, 0.35);
        }

        .titles h1 {
          margin: 4px 0 2px;
          font-size: 20px;
        }

        .subtitle {
          margin: 0;
          font-size: 13px;
          color: #6b7280;
        }

        .room-selector-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          margin-top: 12px;
        }

        .room-selector {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #fff7ed, #ffffff);
          border: 2px solid #f97316;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(248, 113, 22, 0.2);
          transition: all 0.2s ease;
        }

        .room-selector:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(248, 113, 22, 0.3);
        }

        .room-icon {
          font-size: 18px;
        }

        .room-label {
          font-size: 13px;
          font-weight: 600;
          color: #f97316;
          white-space: nowrap;
        }

        .room-select {
          padding: 4px 12px;
          border-radius: 8px;
          border: 1px solid #fed7aa;
          background: #ffffff;
          font-size: 14px;
          font-weight: 600;
          color: #f97316;
          cursor: pointer;
          transition: all 0.16s ease;
          min-width: 50px;
        }

        .room-select:hover {
          border-color: #f97316;
          background: #fff7ed;
        }

        .room-select:focus {
          outline: none;
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
          background: #fff7ed;
        }

        /* Tabs */
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

        .tab:hover:not(.tab-active)) {
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
          width: 80px;
          height: 80px;
          border-radius: 16px;
          overflow: hidden;
          flex-shrink: 0;
          background: #fee2e2;
        }

        .item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
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

        .order-btn {
          border: none;
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 600;
          background: linear-gradient(135deg, #16a34a, #22c55e);
          color: #f9fafb;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(22, 163, 74, 0.4);
          transition: transform 0.16s ease, box-shadow 0.16s ease,
            filter 0.16s ease;
          white-space: nowrap;
        }

        .order-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 26px rgba(22, 163, 74, 0.55);
          filter: brightness(1.05);
        }

        .order-btn:active {
          transform: translateY(0);
          box-shadow: 0 6px 14px rgba(22, 163, 74, 0.5);
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

        @media (max-width: 480px) {
          .card {
            border-radius: 20px;
            padding: 14px 12px 20px;
          }
          .item-image {
            width: 70px;
            height: 70px;
          }
          .bottom-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .actions {
            width: 100%;
            justify-content: flex-end;
          }
        }

        @media (min-width: 640px) {
          .logo-header-inner {
            flex-direction: row;
            justify-content: flex-start;
            text-align: left;
            gap: 12px;
          }
          .room-selector-wrapper {
            margin-top: 0;
            justify-content: flex-end;
          }
          .room-selector {
            margin-left: auto;
          }
        }
      `}</style>
    </div>
  );
}
