// pages/menu/sukhakarta/admin.js
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const STORAGE_BUCKET = 'menu-images'; // bucket name in Supabase Storage

export default function AdminPanel() {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [authMessage, setAuthMessage] = useState('');

  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    veg: true,
    category_id: '',
    image_url: '',
  });
  const [newItemFile, setNewItemFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    const { data: menu } = await supabase
      .from('menu_items')
      .select('*')
      .order('created_at', { ascending: true });

    setCategories(cats || []);
    setItems(menu || []);
    setLoading(false);
  };

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      if (session) await loadData();
      else setLoading(false);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) loadData();
        else setLoading(false);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMessage('');

    if (authMode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      setAuthMessage(error ? error.message : 'Signed in.');
    } else {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      setAuthMessage(
        error
          ? error.message
          : 'Sign up complete. Check your email if confirmation is required.'
      );
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCategories([]);
    setItems([]);
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const { error } = await supabase
      .from('categories')
      .insert({ name: newCategoryName.trim() });
    if (error) {
      alert(error.message);
      return;
    }
    setNewCategoryName('');
    await loadData();
  };

  const deleteCategory = async (id) => {
    if (
      !confirm(
        'Delete this category? Items under it will remain uncategorized.'
      )
    )
      return;

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadData();
  };

  // Upload image file to Supabase Storage (if selected)
  const uploadImageIfNeeded = async () => {
    if (!newItemFile) return null; // no file selected

    try {
      setUploading(true);
      const fileExt = newItemFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}.${fileExt}`;
      const filePath = `dishes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, newItemFile);

      if (uploadError) {
        console.error(uploadError);
        alert('Image upload failed: ' + uploadError.message);
        setUploading(false);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

      setUploading(false);
      return publicUrl;
    } catch (err) {
      console.error(err);
      alert('Unexpected error while uploading image.');
      setUploading(false);
      return null;
    }
  };

  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    setUploading(true);

    // 1) Upload file if present
    const uploadedUrl = await uploadImageIfNeeded();

    // 2) If no file, fall back to manual URL (if provided)
    const finalImageUrl =
      uploadedUrl || (newItem.image_url.trim() || null);

    const payload = {
      name: newItem.name.trim(),
      description: newItem.description || null,
      price: newItem.price ? Number(newItem.price) : null,
      veg: newItem.veg,
      category_id: newItem.category_id || null,
      image_url: finalImageUrl,
      available: true,
    };

    const { error } = await supabase.from('menu_items').insert(payload);
    setUploading(false);

    if (error) {
      alert(error.message);
      return;
    }

    // reset form
    setNewItem({
      name: '',
      description: '',
      price: '',
      veg: true,
      category_id: '',
      image_url: '',
    });
    setNewItemFile(null);
    await loadData();
  };

  const toggleAvailable = async (item) => {
    const { error } = await supabase
      .from('menu_items')
      .update({ available: !item.available })
      .eq('id', item.id);
    if (error) {
      alert(error.message);
      return;
    }
    await loadData();
  };

  const deleteItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    await loadData();
  };

  /* ---------- LOGIN VIEW ---------- */
  if (!session) {
    return (
      <div className="page">
        <div className="auth-card">
          <h2>Sukhakarta Menu – Admin</h2>
          <p className="subtitle">Sign in to manage categories & dishes</p>

          <form onSubmit={handleAuth} className="auth-form">
            <input
              type="email"
              placeholder="Admin email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
            />
            <button type="submit">
              {authMode === 'signin' ? 'Sign In' : 'Create Admin Account'}
            </button>
          </form>

          <button
            className="ghost-btn"
            onClick={() =>
              setAuthMode(authMode === 'signin' ? 'signup' : 'signin')
            }
          >
            Switch to {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>

          {authMessage && <p className="msg">{authMessage}</p>}

          <style jsx>{`
            .page {
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              background: radial-gradient(circle at top, #fee2e2, #e5e7eb);
              font-family: system-ui, -apple-system, BlinkMacSystemFont,
                'Segoe UI', sans-serif;
              padding: 16px;
            }
            .auth-card {
              width: 100%;
              max-width: 420px;
              background: rgba(255, 255, 255, 0.96);
              padding: 20px 18px 22px;
              border-radius: 22px;
              box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
              text-align: center;
              animation: fadeIn 0.4s ease-out;
            }
            h2 {
              margin: 0 0 4px;
            }
            .subtitle {
              margin: 0 0 12px;
              font-size: 13px;
              color: #6b7280;
            }
            .auth-form {
              display: flex;
              flex-direction: column;
              gap: 8px;
              margin-bottom: 8px;
            }
            input {
              border-radius: 10px;
              border: 1px solid #e5e7eb;
              padding: 8px 10px;
              font-size: 14px;
            }
            button {
              border-radius: 999px;
              border: none;
              padding: 8px 14px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
            }
            .auth-form button {
              background: linear-gradient(135deg, #f97316, #fb923c);
              color: white;
              box-shadow: 0 10px 22px rgba(248, 113, 22, 0.4);
            }
            .ghost-btn {
              margin-top: 4px;
              background: transparent;
              border: 1px dashed #d1d5db;
              color: #4b5563;
            }
            .msg {
              margin-top: 8px;
              font-size: 12px;
              color: #6b7280;
            }
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      </div>
    );
  }

  /* ---------- ADMIN VIEW ---------- */
  return (
    <div className="page">
      <div className="admin-card">
        <header className="admin-header">
          <div className="admin-title-block">
            <h2>Sukhakarta Menu – Admin Panel</h2>
            <p className="subtitle">
              Manage categories, dishes & photos in real time.
            </p>
          </div>
          <button className="signout-btn" onClick={handleSignOut}>
            Sign Out
          </button>
        </header>

        {loading && <p className="info">Loading…</p>}

        {!loading && (
          <>
            {/* Categories */}
            <section className="panel">
              <div className="panel-header">
                <h3>Categories</h3>
                <span className="badge">{categories.length} total</span>
              </div>

              <form onSubmit={addCategory} className="row">
                <input
                  type="text"
                  placeholder="New category name (e.g. Breakfast)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <button type="submit">Add</button>
              </form>

              <div className="category-list">
                {categories.length ? (
                  categories.map((cat) => (
                    <div key={cat.id} className="category-row">
                      <span className="cat-name">{cat.name}</span>
                      <button
                        className="small-btn danger"
                        type="button"
                        onClick={() => deleteCategory(cat.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="info">No categories yet.</p>
                )}
              </div>
            </section>

            {/* Add Item */}
            <section className="panel">
              <div className="panel-header">
                <h3>Add / Edit Items</h3>
              </div>
              <form onSubmit={addItem} className="grid">
                <input
                  type="text"
                  placeholder="Item name"
                  value={newItem.name}
                  onChange={(e) =>
                    setNewItem({ ...newItem, name: e.target.value })
                  }
                  required
                />
                <input
                  type="number"
                  placeholder="Price (₹)"
                  value={newItem.price}
                  onChange={(e) =>
                    setNewItem({ ...newItem, price: e.target.value })
                  }
                />
                <select
                  value={newItem.category_id}
                  onChange={(e) =>
                    setNewItem({ ...newItem, category_id: e.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option value={cat.id} key={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newItem.veg ? 'veg' : 'nonveg'}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      veg: e.target.value === 'veg',
                    })
                  }
                >
                  <option value="veg">Veg</option>
                  <option value="nonveg">Non-Veg</option>
                </select>

                {/* File upload */}
                <div className="file-wrapper wide">
                  <label className="file-label">
                    Dish Image (upload)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        setNewItemFile(file || null);
                      }}
                    />
                  </label>
                  {newItemFile && (
                    <p className="small-info">
                      Selected: {newItemFile.name}
                    </p>
                  )}
                </div>

                {/* URL fallback */}
                <input
                  type="text"
                  placeholder="OR Image URL (optional)"
                  value={newItem.image_url}
                  onChange={(e) =>
                    setNewItem({ ...newItem, image_url: e.target.value })
                  }
                  className="wide"
                />

                <textarea
                  placeholder="Description (optional)"
                  value={newItem.description}
                  onChange={(e) =>
                    setNewItem({ ...newItem, description: e.target.value })
                  }
                  className="wide"
                />

                <button
                  type="submit"
                  className="wide primary-btn"
                  disabled={uploading}
                >
                  {uploading ? 'Saving…' : 'Save Item'}
                </button>
              </form>
            </section>

            {/* Existing Items */}
            <section className="panel">
              <div className="panel-header">
                <h3>Existing Items</h3>
                <span className="badge">{items.length} items</span>
              </div>
              {items.length === 0 ? (
                <p className="info">No items yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Photo</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Veg</th>
                        <th>Available</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const cat = categories.find(
                          (c) => c.id === item.category_id
                        );
                        return (
                          <tr key={item.id}>
                            <td>
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="thumb"
                                />
                              ) : (
                                <span className="thumb-placeholder">🍽️</span>
                              )}
                            </td>
                            <td>{item.name}</td>
                            <td>{cat ? cat.name : '-'}</td>
                            <td>
                              {item.price != null
                                ? `₹${Number(item.price).toFixed(0)}`
                                : '-'}
                            </td>
                            <td>{item.veg ? 'Veg' : 'Non-Veg'}</td>
                            <td>{item.available ? 'Yes' : 'No'}</td>
                            <td>
                              <button
                                className="small-btn"
                                type="button"
                                onClick={() => toggleAvailable(item)}
                              >
                                {item.available ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                className="small-btn danger"
                                type="button"
                                onClick={() => deleteItem(item.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <style jsx>{`
          .page {
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            background: radial-gradient(circle at top, #fff7e6, #e5e7eb);
            font-family: system-ui, -apple-system, BlinkMacSystemFont,
              'Segoe UI', sans-serif;
            padding: 16px;
          }
          .admin-card {
            width: 100%;
            max-width: 1000px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(16px);
            border-radius: 24px;
            padding: 18px 14px 22px;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.18);
            animation: fadeIn 0.45s ease-out;
          }
          .admin-header {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            text-align: center;
          }
          .admin-title-block h2 {
            margin: 0;
            font-size: 20px;
          }
          .subtitle {
            margin: 4px 0 0;
            font-size: 13px;
            color: #6b7280;
          }
          .signout-btn {
            border-radius: 999px;
            border: none;
            padding: 6px 14px;
            font-size: 12px;
            font-weight: 600;
            background: #fee2e2;
            color: #b91c1c;
            cursor: pointer;
          }
          .panel {
            margin-top: 16px;
            padding: 14px 12px 16px;
            border-radius: 16px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            position: relative;
            z-index: 1;
          }
          .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          h3 {
            margin: 0;
            font-size: 15px;
          }
          .badge {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 999px;
            background: #eef2ff;
            color: #3730a3;
          }
          .row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 6px;
          }
          input,
          select,
          textarea {
            border-radius: 10px;
            border: 1px solid #d1d5db;
            padding: 7px 9px;
            font-size: 13px;
            width: 100%;
            box-sizing: border-box;
            position: relative;
            z-index: 1;
          }
          textarea {
            min-height: 60px;
            resize: vertical;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            position: relative;
          }
          .grid .wide {
            grid-column: 1 / -1;
          }
          @media (max-width: 640px) {
            .grid {
              grid-template-columns: 1fr;
            }
            .grid .wide {
              grid-column: 1;
            }
          }
          button {
            cursor: pointer;
          }
          .row button,
          .primary-btn {
            border-radius: 999px;
            border: none;
            padding: 7px 14px;
            font-size: 13px;
            font-weight: 600;
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
          }
          .info {
            font-size: 12px;
            color: #6b7280;
          }
          .file-wrapper {
            display: flex;
            flex-direction: column;
            gap: 4px;
            position: relative;
            z-index: 1;
          }
          .file-label {
            font-size: 12px;
            display: inline-flex;
            flex-direction: column;
            gap: 4px;
          }
          .file-label input[type='file'] {
            padding: 4px;
            border-radius: 999px;
            border: 1px dashed #d1d5db;
            background: #f3f4f6;
            font-size: 12px;
          }
          .small-info {
            font-size: 11px;
            color: #6b7280;
          }
          .category-list {
            margin-top: 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .category-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
          }
          .cat-name {
            font-size: 13px;
            font-weight: 500;
          }
          .table-wrap {
            margin-top: 6px;
            overflow-x: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th,
          td {
            padding: 6px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: middle;
          }
          th {
            background: #f3f4f6;
          }
          .thumb {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            object-fit: cover;
          }
          .thumb-placeholder {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border-radius: 10px;
            background: #fee2e2;
          }
          .small-btn {
            border: none;
            border-radius: 999px;
            padding: 4px 8px;
            font-size: 11px;
            margin-right: 4px;
            background: #e5e7eb;
          }
          .small-btn.danger {
            background: #fee2e2;
            color: #b91c1c;
          }
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @media (min-width: 768px) {
            .admin-header {
              flex-direction: row;
              justify-content: space-between;
              align-items: center;
              text-align: left;
            }
            .admin-title-block {
              text-align: left;
            }
          }
          @media (max-width: 480px) {
            .admin-card {
              padding: 14px 10px 18px;
              border-radius: 18px;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
