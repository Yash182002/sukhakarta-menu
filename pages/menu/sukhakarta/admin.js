// pages/menu/sukhakarta/admin.js
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const STORAGE_BUCKET = 'menu-images';

export default function AdminPanel() {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('signin');
  const [authMessage, setAuthMessage] = useState('');

  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySort, setNewCategorySort] = useState(0);

  const [items, setItems] = useState([]);

  /* ---------- New Item State ---------- */
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    min_qty: 1,
    veg: true,
    category_id: '',
    image_url: '',
  });
  const [newItemFile, setNewItemFile] = useState(null);

  /* ---------- Edit Item State ---------- */
  const [editingItemId, setEditingItemId] = useState(null);
  const [editedItem, setEditedItem] = useState({
    name: '',
    description: '',
    price: '',
    min_qty: 1,
    veg: true,
    category_id: '',
    image_url: '',
  });
  const [editedItemFile, setEditedItemFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ---------- Category Edit ---------- */
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [editedCategorySort, setEditedCategorySort] = useState(0);
  const [categoryBusy, setCategoryBusy] = useState(false);

  /* ---------- AUTH ---------- */
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) loadData();
      else setLoading(false);
    };

    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadData();
      else setLoading(false);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  /* ---------- LOAD DATA ---------- */
  const loadData = async () => {
    setLoading(true);

    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');

    const { data: menu } = await supabase
      .from('menu_items')
      .select('*')
      .order('created_at');

    setCategories(cats || []);
    setItems(menu || []);
    setLoading(false);
  };

  /* ---------- AUTH FORMS ---------- */
  const handleAuth = async (e) => {
    e.preventDefault();
    let res;

    if (authMode === 'signin') {
      res = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
    } else {
      res = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
    }

    setAuthMessage(res.error ? res.error.message : "Success.");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  /* ---------- CATEGORY CRUD ---------- */
  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setCategoryBusy(true);

    await supabase.from('categories').insert({
      name: newCategoryName.trim(),
      sort_order: Number(newCategorySort) || 0,
    });

    setNewCategoryName('');
    setNewCategorySort(0);

    setCategoryBusy(false);
    loadData();
  };

  const deleteCategory = async (id) => {
    if (!confirm("Delete category?")) return;

    await supabase.from('categories').delete().eq('id', id);
    loadData();
  };

  const startEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setEditedCategoryName(cat.name);
    setEditedCategorySort(cat.sort_order || 0);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
  };

  const saveCategoryEdit = async () => {
    await supabase
      .from('categories')
      .update({
        name: editedCategoryName.trim(),
        sort_order: Number(editedCategorySort) || 0,
      })
      .eq('id', editingCategoryId);

    cancelEditCategory();
    loadData();
  };

  /* ---------- IMAGE HELPERS ---------- */
  const compressImage = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          const max = 800;
          if (w > h && w > max) { h *= max / w; w = max; }
          else if (h > max) { w *= max / h; h = max; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.75);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

  const uploadImage = async (file) => {
    if (!file) return null;

    const blob = await compressImage(file);
    const name = `dishes/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    await supabase.storage.from(STORAGE_BUCKET).upload(name, blob, {
      contentType: "image/jpeg",
    });

    const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(name);
    return publicUrl;
  };

  /* ---------- ADD ITEM ---------- */
  const addItem = async (e) => {
    e.preventDefault();

    setUploading(true);

    const img = newItemFile ? await uploadImage(newItemFile) : newItem.image_url || null;

    await supabase.from('menu_items').insert({
      name: newItem.name.trim(),
      description: newItem.description || null,
      price: Number(newItem.price) || 0,
      min_qty: Number(newItem.min_qty) || 1,
      veg: newItem.veg,
      category_id: newItem.category_id || null,
      image_url: img,
      available: true
    });

    setUploading(false);

    setNewItem({
      name: '',
      description: '',
      price: '',
      min_qty: 1,
      veg: true,
      category_id: '',
      image_url: '',
    });
    setNewItemFile(null);

    loadData();
  };

  /* ---------- EDIT ITEM ---------- */
  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditedItem({
      name: item.name,
      description: item.description,
      price: item.price,
      min_qty: item.min_qty || 1,
      veg: item.veg,
      category_id: item.category_id,
      image_url: item.image_url,
    });
    setEditedItemFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
  };

  const saveItemEdit = async (e) => {
    e.preventDefault();
    setUploading(true);

    const img = editedItemFile ? await uploadImage(editedItemFile) : editedItem.image_url || null;

    await supabase
      .from('menu_items')
      .update({
        name: editedItem.name.trim(),
        description: editedItem.description || null,
        price: Number(editedItem.price) || 0,
        min_qty: Number(editedItem.min_qty) || 1,
        veg: editedItem.veg,
        category_id: editedItem.category_id,
        image_url: img
      })
      .eq('id', editingItemId);

    setUploading(false);
    cancelEditItem();
    loadData();
  };

  /* ---------- DELETE ITEM ---------- */
  const deleteItem = async (id) => {
    if (!confirm("Delete this item?")) return;
    await supabase.from('menu_items').delete().eq('id', id);
    loadData();
  };

  /* ---------- LOGIN SCREEN ---------- */
  if (!session) {
    return (
      <div className="page">
        <div className="auth-card">
          <h2>Sukhakarta Menu – Admin</h2>

          <form onSubmit={handleAuth} className="auth-form">
            <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            <button type="submit">{authMode === "signin" ? "Sign In" : "Sign Up"}</button>
          </form>

          <button className="ghost-btn" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
            Switch to {authMode === "signin" ? "Sign Up" : "Sign In"}
          </button>

          {authMessage && <p className="msg">{authMessage}</p>}
        </div>
      </div>
    );
  }

  /* ---------- ADMIN PANEL UI ---------- */
  return (
    <div className="page">
      <div className="admin-card">
        <header className="admin-header">
          <h2>Sukhakarta Menu – Admin Panel</h2>
          <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
        </header>

        {/* ----------------- CATEGORY PANEL ----------------- */}
        <section className="panel">
          <h3>Categories</h3>

          <form onSubmit={addCategory} className="row">
            <input type="text" placeholder="Category name" value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)} />
            <input type="number" placeholder="Sort order" value={newCategorySort}
              onChange={(e) => setNewCategorySort(e.target.value)} />
            <button type="submit">Add</button>
          </form>

          {categories.map((c) => (
            <div key={c.id} className="category-row">
              <span>{c.name} (Sort: {c.sort_order})</span>

              <div>
                <button className="small-btn" onClick={() => startEditCategory(c)}>Edit</button>
                <button className="small-btn danger" onClick={() => deleteCategory(c.id)}>Delete</button>
              </div>
            </div>
          ))}

          {editingCategoryId && (
            <div className="edit-box">
              <input value={editedCategoryName} onChange={(e) => setEditedCategoryName(e.target.value)} />
              <input type="number" value={editedCategorySort} onChange={(e) => setEditedCategorySort(e.target.value)} />
              <button onClick={saveCategoryEdit}>Save</button>
              <button onClick={cancelEditCategory}>Cancel</button>
            </div>
          )}
        </section>

        {/* ----------------- ADD / EDIT ITEM PANEL ----------------- */}
        <section className="panel">
          <h3>{editingItemId ? "Edit Item" : "Add Item"}</h3>

          <form onSubmit={editingItemId ? saveItemEdit : addItem} className="grid">

            {/* Name */}
            <input
              type="text"
              placeholder="Item name"
              value={editingItemId ? editedItem.name : newItem.name}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, name: e.target.value })
                  : setNewItem({ ...newItem, name: e.target.value })
              }
              required
            />

            {/* PRICE + MIN QTY (B1 STYLE — SAME ROW) */}
            <div className="row2">
              <input
                type="number"
                placeholder="Price ₹"
                value={editingItemId ? editedItem.price : newItem.price}
                onChange={(e) =>
                  editingItemId
                    ? setEditedItem({ ...editedItem, price: e.target.value })
                    : setNewItem({ ...newItem, price: e.target.value })
                }
                required
              />

              <input
                type="number"
                placeholder="Min Qty"
                min="1"
                value={editingItemId ? editedItem.min_qty : newItem.min_qty}
                onChange={(e) =>
                  editingItemId
                    ? setEditedItem({ ...editedItem, min_qty: e.target.value })
                    : setNewItem({ ...newItem, min_qty: e.target.value })
                }
                required
              />
            </div>

            {/* Category */}
            <select
              value={editingItemId ? editedItem.category_id : newItem.category_id}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, category_id: e.target.value })
                  : setNewItem({ ...newItem, category_id: e.target.value })
              }
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {/* Veg/Non-Veg */}
            <select
              value={editingItemId ? (editedItem.veg ? "veg" : "nonveg") : (newItem.veg ? "veg" : "nonveg")}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, veg: e.target.value === "veg" })
                  : setNewItem({ ...newItem, veg: e.target.value === "veg" })
              }
            >
              <option value="veg">Veg</option>
              <option value="nonveg">Non-Veg</option>
            </select>

            {/* File upload */}
            <div className="file-wrapper wide">
              <label className="file-label">
                Upload Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    editingItemId ? setEditedItemFile(f) : setNewItemFile(f);
                  }}
                />
              </label>
            </div>

            {/* Description */}
            <textarea
              placeholder="Description"
              className="wide"
              value={editingItemId ? editedItem.description : newItem.description}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, description: e.target.value })
                  : setNewItem({ ...newItem, description: e.target.value })
              }
            />

            {/* SUBMIT */}
            <div className="wide">
              <button type="submit" className="primary-btn">
                {editingItemId ? "Update Item" : "Add Item"}
              </button>

              {editingItemId && (
                <button type="button" className="small-btn" onClick={cancelEditItem}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* ----------------- ITEM TABLE ----------------- */}
        <section className="panel">
          <h3>Existing Items</h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Min Qty</th>
                  <th>Veg</th>
                  <th>Available</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => {
                  const cat = categories.find((c) => c.id === item.category_id);

                  return (
                    <tr key={item.id}>
                      <td>
                        {item.image_url ? (
                          <img src={item.image_url} className="thumb" />
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>{item.name}</td>
                      <td>{cat ? cat.name : "-"}</td>
                      <td>₹{item.price}</td>
                      <td>{item.min_qty || 1}</td>
                      <td>{item.veg ? "Veg" : "Non-Veg"}</td>
                      <td>{item.available ? "Yes" : "No"}</td>

                      <td>
                        <button className="small-btn" onClick={() => startEditItem(item)}>Edit</button>
                        <button className="small-btn danger" onClick={() => deleteItem(item.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ----------------- STYLES ----------------- */}
      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          background: #f3f4f6;
        }

        .admin-card {
          width: 100%;
          max-width: 1100px;
          background: white;
          padding: 20px;
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .panel {
          background: #fafafa;
          padding: 16px;
          border-radius: 14px;
          margin-bottom: 20px;
          border: 1px solid #e5e7eb;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .wide {
          grid-column: 1 / -1;
        }

        .row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        input, select, textarea {
          width: 100%;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
        }

        .primary-btn {
          background: #16a34a;
          color: white;
          padding: 8px 14px;
          border-radius: 10px;
        }

        .small-btn {
          padding: 5px 10px;
          border-radius: 8px;
          background: #e5e7eb;
          margin-right: 6px;
        }

        .small-btn.danger {
          background: #fecaca;
          color: #b91c1c;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 8px;
          border-bottom: 1px solid #e5e7eb;
        }

        .thumb {
          width: 60px;
          height: 45px;
          object-fit: cover;
          border-radius: 6px;
        }
      `}</style>
    </div>
  );
}
