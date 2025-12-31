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

  // NEW ITEM
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: '',
    veg: true,
    category_id: '',
    image_url: '',
    min_qty: 1, // NEW FIELD
  });
  const [newItemFile, setNewItemFile] = useState(null);

  // EDIT ITEM
  const [editingItemId, setEditingItemId] = useState(null);
  const [editedItem, setEditedItem] = useState({
    name: '',
    description: '',
    price: '',
    veg: true,
    category_id: '',
    image_url: '',
    min_qty: 1,
  });
  const [editedItemFile, setEditedItemFile] = useState(null);

  // CATEGORY EDIT
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [editedCategorySort, setEditedCategorySort] = useState(0);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);

  // ---------- AUTH ----------
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session) await loadData();
      else setLoading(false);
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        session ? loadData() : setLoading(false);
      }
    );

    return () => {
      try { listener.subscription.unsubscribe(); } catch (e) {}
    };
  }, []);

  // ---------- LOAD DATA ----------
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
      setAuthMessage(error ? error.message : 'Admin created. Check email.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCategories([]);
    setItems([]);
  };

  // ---------- CATEGORY CRUD ----------
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

  const startEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setEditedCategoryName(cat.name);
    setEditedCategorySort(cat.sort_order ?? 0);
  };

  const saveCategoryEdit = async () => {
    await supabase
      .from('categories')
      .update({
        name: editedCategoryName.trim(),
        sort_order: Number(editedCategorySort) || 0,
      })
      .eq('id', editingCategoryId);

    setEditingCategoryId(null);
    loadData();
  };

  const deleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return;

    await supabase.from('categories').delete().eq('id', id);
    loadData();
  };

  // ---------- IMAGE HANDLING ----------
  const compressImage = (file, maxSize = 800, quality = 0.75) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    });

  const uploadImageToStorage = async (file) => {
    if (!file) return null;

    const blob = await compressImage(file, 800, 0.75);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(`dishes/${fileName}`, blob, { contentType: 'image/jpeg' });

    if (error) throw new Error(error.message);

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(`dishes/${fileName}`);

    return publicUrl;
  };

  // ---------- ADD ITEM ----------
  const addItem = async (e) => {
    e.preventDefault();
    setUploading(true);

    let imageUrl = newItem.image_url || null;
    if (newItemFile) imageUrl = await uploadImageToStorage(newItemFile);

    await supabase.from('menu_items').insert({
      name: newItem.name.trim(),
      description: newItem.description || null,
      price: Number(newItem.price) || null,
      veg: newItem.veg,
      category_id: newItem.category_id || null,
      image_url: imageUrl,
      available: true,
      min_qty: Number(newItem.min_qty) || 1, // NEW
    });

    setNewItem({
      name: '',
      description: '',
      price: '',
      veg: true,
      category_id: '',
      image_url: '',
      min_qty: 1,
    });
    setNewItemFile(null);
    setUploading(false);
    loadData();
  };

  // ---------- EDIT ITEM ----------
  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditedItem({
      name: item.name,
      description: item.description,
      price: item.price,
      veg: item.veg,
      category_id: item.category_id,
      image_url: item.image_url,
      min_qty: item.min_qty ?? 1, // NEW
    });
    setEditedItemFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveItemEdit = async (e) => {
    e.preventDefault();
    setUploading(true);

    let imageUrl = editedItem.image_url || null;
    if (editedItemFile) imageUrl = await uploadImageToStorage(editedItemFile);

    await supabase
      .from('menu_items')
      .update({
        name: editedItem.name.trim(),
        description: editedItem.description,
        price: Number(editedItem.price) || null,
        veg: editedItem.veg,
        category_id: editedItem.category_id,
        image_url: imageUrl,
        min_qty: Number(editedItem.min_qty) || 1, // NEW
      })
      .eq('id', editingItemId);

    setEditedItemFile(null);
    setEditingItemId(null);
    setUploading(false);
    loadData();
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
  };

  // ---------- DELETE ITEM ----------
  const deleteItem = async (id) => {
    if (!confirm('Delete this item?')) return;
    await supabase.from('menu_items').delete().eq('id', id);
    loadData();
  };

  // ---------- ADMIN LOGIN VIEW ----------
  if (!session) {
    return (
      <div className="page">
        <div className="auth-card">
          <h2>Sukhakarta Menu – Admin</h2>
          <form onSubmit={handleAuth} className="auth-form">
            <input type="email" placeholder="Email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            <button type="submit">{authMode === 'signin' ? 'Sign In' : 'Create Admin'}</button>
          </form>
          <button className="ghost-btn" onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>
            Switch to {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    );
  }

  // ---------- ADMIN PANEL ----------
  return (
    <div className="page">
      <div className="admin-card">
        <header className="admin-header">
          <h2>Sukhakarta Menu – Admin Panel</h2>
          <button className="signout-btn" onClick={handleSignOut}>Sign Out</button>
        </header>

        {/* CATEGORY SECTION */}
        <section className="panel">
          <h3>Categories</h3>

          <form onSubmit={addCategory} className="row">
            <input type="text" placeholder="Category name" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            <input type="number" placeholder="Sort Order" value={newCategorySort} onChange={(e) => setNewCategorySort(e.target.value)} />
            <button type="submit">Add</button>
          </form>

          {editingCategoryId && (
            <div className="edit-category-box">
              <input type="text" value={editedCategoryName} onChange={(e) => setEditedCategoryName(e.target.value)} />
              <input type="number" value={editedCategorySort} onChange={(e) => setEditedCategorySort(e.target.value)} />
              <button onClick={saveCategoryEdit}>Save</button>
              <button onClick={() => setEditingCategoryId(null)}>Cancel</button>
            </div>
          )}

          {categories.map((cat) => (
            <div key={cat.id} className="category-row">
              <span>{cat.name}</span>
              <div>
                <button onClick={() => startEditCategory(cat)}>Edit</button>
                <button onClick={() => deleteCategory(cat.id)}>Delete</button>
              </div>
            </div>
          ))}
        </section>

        {/* ADD / EDIT ITEM */}
        <section className="panel">
          <h3>{editingItemId ? 'Edit Item' : 'Add Item'}</h3>

          <form onSubmit={editingItemId ? saveItemEdit : addItem} className="grid">

            <input
              type="text"
              placeholder="Item name"
              value={editingItemId ? editedItem.name : newItem.name}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, name: e.target.value })
                  : setNewItem({ ...newItem, name: e.target.value })
              }
            />

            <input
              type="number"
              placeholder="Price"
              value={editingItemId ? editedItem.price : newItem.price}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, price: e.target.value })
                  : setNewItem({ ...newItem, price: e.target.value })
              }
            />

            {/* NEW: MIN QTY */}
            <input
              type="number"
              placeholder="Minimum Qty"
              value={editingItemId ? editedItem.min_qty : newItem.min_qty}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, min_qty: e.target.value })
                  : setNewItem({ ...newItem, min_qty: e.target.value })
              }
            />

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

            <select
              value={editingItemId ? (editedItem.veg ? 'veg' : 'nonveg') : (newItem.veg ? 'veg' : 'nonveg')}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, veg: e.target.value === 'veg' })
                  : setNewItem({ ...newItem, veg: e.target.value === 'veg' })
              }
            >
              <option value="veg">Veg</option>
              <option value="nonveg">Non-Veg</option>
            </select>

            {/* FILE UPLOAD */}
            <div className="file-wrapper wide">
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  editingItemId
                    ? setEditedItemFile(e.target.files?.[0] || null)
                    : setNewItemFile(e.target.files?.[0] || null)
                }
              />
            </div>

            <input
              type="text"
              className="wide"
              placeholder="Image URL (optional)"
              value={editingItemId ? editedItem.image_url : newItem.image_url}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, image_url: e.target.value })
                  : setNewItem({ ...newItem, image_url: e.target.value })
              }
            />

            <textarea
              className="wide"
              placeholder="Description"
              value={editingItemId ? editedItem.description : newItem.description}
              onChange={(e) =>
                editingItemId
                  ? setEditedItem({ ...editedItem, description: e.target.value })
                  : setNewItem({ ...newItem, description: e.target.value })
              }
            />

            <button type="submit" className="primary-btn wide">
              {editingItemId ? 'Update Item' : 'Add Item'}
            </button>

            {editingItemId && (
              <button type="button" className="small-btn" onClick={cancelEditItem}>
                Cancel
              </button>
            )}
          </form>
        </section>

        {/* EXISTING ITEMS */}
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
                          <span className="thumb-placeholder">🍽️</span>
                        )}
                      </td>
                      <td>{item.name}</td>
                      <td>{cat ? cat.name : '-'}</td>
                      <td>₹{item.price}</td>
                      <td>{item.veg ? 'Veg' : 'Non-Veg'}</td>
                      <td>{item.available ? 'Yes' : 'No'}</td>
                      <td>
                        <button className="small-btn" onClick={() => startEditItem(item)}>Edit</button>
                        <button className="small-btn" onClick={() => toggleAvailable(item)}>
                          {item.available ? 'Disable' : 'Enable'}
                        </button>
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

      {/* ---------- STYLES ---------- */}
      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 20px;
          background: #f3f4f6;
          display: flex;
          justify-content: center;
        }
        .admin-card {
          width: 100%;
          max-width: 1000px;
          background: white;
          padding: 20px;
          border-radius: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .admin-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .panel {
          background: #fafafa;
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1px solid #e5e7eb;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .wide {
          grid-column: 1 / 3;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 8px;
          border-bottom: 1px solid #ddd;
        }
        .thumb {
          width: 50px;
          height: 40px;
          object-fit: cover;
          border-radius: 6px;
        }
        .thumb-placeholder {
          display: inline-flex;
          width: 50px;
          height: 40px;
          justify-content: center;
          align-items: center;
          background: #eee;
        }
        .primary-btn {
          background: green;
          color: white;
          padding: 10px;
          border: none;
          border-radius: 10px;
        }
        .small-btn {
          padding: 6px 12px;
          margin-right: 6px;
          border-radius: 10px;
          border: none;
        }
        .danger {
          background: #fee2e2;
          color: #b91c1c;
        }
      `}</style>
    </div>
  );
}
