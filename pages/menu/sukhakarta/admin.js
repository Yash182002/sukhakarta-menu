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
  const [newCategorySort, setNewCategorySort] = useState(0);

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

  // Edit item states
  const [editingItemId, setEditingItemId] = useState(null);
  const [editedItem, setEditedItem] = useState({
    name: '',
    description: '',
    price: '',
    veg: true,
    category_id: '',
    image_url: '',
  });
  const [editedItemFile, setEditedItemFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Category edit state
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [editedCategorySort, setEditedCategorySort] = useState(0);
  const [categoryBusy, setCategoryBusy] = useState(false);

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
      try {
        listener.subscription.unsubscribe();
      } catch (e) {}
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: cats, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });

    const { data: menu, error: menuErr } = await supabase
      .from('menu_items')
      .select('*')
      .order('created_at', { ascending: true });

    if (catErr) console.error('categories load error', catErr);
    if (menuErr) console.error('menu load error', menuErr);

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

  // Create category (supports optional sort order)
  const addCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setCategoryBusy(true);
    try {
      const payload = {
        name: newCategoryName.trim(),
      };
      if (newCategorySort !== '' && newCategorySort != null) {
        payload.sort_order = Number(newCategorySort) || 0;
      }

      const { error } = await supabase.from('categories').insert(payload);
      if (error) {
        alert(error.message);
        setCategoryBusy(false);
        return;
      }
      setNewCategoryName('');
      setNewCategorySort(0);
      await loadData();
    } catch (err) {
      console.error('addCategory error', err);
      alert('Failed to add category');
    } finally {
      setCategoryBusy(false);
    }
  };

  const deleteCategory = async (id) => {
    if (
      !confirm(
        'Delete this category? Items under it will remain uncategorized.'
      )
    )
      return;

    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);

      if (error) {
        alert(error.message);
        return;
      }

      await loadData();
    } catch (err) {
      console.error('deleteCategory error', err);
      alert('Delete failed');
    }
  };

  // ---------- Category Edit helpers ----------
  const startEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setEditedCategoryName(cat.name || '');
    setEditedCategorySort(cat.sort_order ?? 0);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditedCategoryName('');
    setEditedCategorySort(0);
  };

  const saveCategoryEdit = async () => {
    if (!editedCategoryName.trim()) {
      alert('Category name required');
      return;
    }
    setCategoryBusy(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: editedCategoryName.trim(),
          sort_order: Number(editedCategorySort) || 0,
        })
        .eq('id', editingCategoryId);

      if (error) {
        alert(error.message);
        setCategoryBusy(false);
        return;
      }

      cancelEditCategory();
      await loadData();
    } catch (err) {
      console.error('saveCategoryEdit error', err);
      alert('Update failed');
    } finally {
      setCategoryBusy(false);
    }
  };

  // Compress image on the client before uploading to Supabase
  const compressImage = (file, maxSize = 800, quality = 0.75) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // maintain aspect ratio, limit to maxSize x maxSize
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Image compression failed'));
              } else {
                resolve(blob);
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = (err) => reject(err);
        img.src = event.target.result;
      };

      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

  // Upload image file to Supabase Storage (if selected)
  const uploadImageToStorage = async (file) => {
    if (!file) return null;
    try {
      // 1) Compress image
      const compressedBlob = await compressImage(file, 800, 0.75);

      // 2) Unique path/name
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)}.jpg`;
      const filePath = `dishes/${fileName}`;

      // 3) Upload
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, compressedBlob, {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.error(uploadError);
        throw new Error('Image upload failed: ' + uploadError.message);
      }

      // 4) Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Add item
  const addItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    setUploading(true);

    try {
      // upload image if present
      const uploadedUrl = newItemFile ? await uploadImageToStorage(newItemFile) : null;
      const finalImageUrl = uploadedUrl || (newItem.image_url.trim() || null);

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
      if (error) {
        alert(error.message);
        setUploading(false);
        return;
      }

      // reset
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
    } catch (err) {
      alert(err.message || 'Failed to add item');
    } finally {
      setUploading(false);
    }
  };

  // Start editing an existing item — prefill editedItem
  const startEditItem = (item) => {
    setEditingItemId(item.id);
    setEditedItem({
      name: item.name || '',
      description: item.description || '',
      price: item.price != null ? String(item.price) : '',
      veg: !!item.veg,
      category_id: item.category_id || '',
      image_url: item.image_url || '',
    });
    setEditedItemFile(null);
    // scroll to form (optional)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditedItem({
      name: '',
      description: '',
      price: '',
      veg: true,
      category_id: '',
      image_url: '',
    });
    setEditedItemFile(null);
  };

  const saveItemEdit = async (e) => {
    e && e.preventDefault && e.preventDefault();
    if (!editedItem.name.trim()) {
      alert('Item name required');
      return;
    }

    setUploading(true);
    try {
      // if a new file is selected for edit, upload it and use that URL.
      const uploadedUrl = editedItemFile ? await uploadImageToStorage(editedItemFile) : null;
      const finalImageUrl = uploadedUrl || (editedItem.image_url.trim() || null);

      const payload = {
        name: editedItem.name.trim(),
        description: editedItem.description || null,
        price: editedItem.price ? Number(editedItem.price) : null,
        veg: editedItem.veg,
        category_id: editedItem.category_id || null,
        image_url: finalImageUrl,
      };

      const { error } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', editingItemId);

      if (error) {
        alert(error.message);
        setUploading(false);
        return;
      }

      cancelEditItem();
      await loadData();
    } catch (err) {
      alert(err.message || 'Failed to update item');
    } finally {
      setUploading(false);
    }
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
                <input
                  type="number"
                  placeholder="Sort order (optional)"
                  value={newCategorySort}
                  onChange={(e) => setNewCategorySort(e.target.value)}
                  style={{ width: 140 }}
                />
                <button type="submit" disabled={categoryBusy}>
                  {categoryBusy ? 'Adding…' : 'Add'}
                </button>
              </form>

              <div className="category-list">
                {categories.length ? (
                  categories.map((cat) => (
                    <div key={cat.id} className="category-row">
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <span className="cat-name">{cat.name}</span>
                        <span className="cat-meta">Sort: {cat.sort_order ?? 0}</span>
                      </div>

                      <div>
                        <button
                          className="small-btn"
                          type="button"
                          onClick={() => startEditCategory(cat)}
                        >
                          Edit
                        </button>

                        <button
                          className="small-btn danger"
                          type="button"
                          onClick={() => deleteCategory(cat.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="info">No categories yet.</p>
                )}
              </div>

              {/* Inline category editor */}
              {editingCategoryId && (
                <div className="edit-category-box">
                  <h4>Edit Category</h4>
                  <div className="row" style={{ alignItems: 'center' }}>
                    <input
                      type="text"
                      value={editedCategoryName}
                      onChange={(e) => setEditedCategoryName(e.target.value)}
                    />
                    <input
                      type="number"
                      value={editedCategorySort}
                      onChange={(e) => setEditedCategorySort(e.target.value)}
                      style={{ width: 140 }}
                    />
                    <button
                      onClick={saveCategoryEdit}
                      disabled={categoryBusy}
                      className="primary-btn"
                    >
                      {categoryBusy ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={cancelEditCategory} className="small-btn">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Add / Edit Item */}
            <section className="panel">
              <div className="panel-header">
                <h3>{editingItemId ? 'Edit Item' : 'Add Item'}</h3>
              </div>

              <form
                onSubmit={editingItemId ? saveItemEdit : addItem}
                className="grid"
                style={{ alignItems: 'start' }}
              >
                {/* Left column */}
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

                <input
                  type="number"
                  placeholder="Price (₹)"
                  value={editingItemId ? editedItem.price : newItem.price}
                  onChange={(e) =>
                    editingItemId
                      ? setEditedItem({ ...editedItem, price: e.target.value })
                      : setNewItem({ ...newItem, price: e.target.value })
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
                    <option value={cat.id} key={cat.id}>
                      {cat.name}
                    </option>
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

                {/* File upload (wide) */}
                <div className="file-wrapper wide">
                  <label className="file-label">
                    {editingItemId ? 'Dish Image (replace)' : 'Dish Image (upload)'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        if (editingItemId) setEditedItemFile(file || null);
                        else setNewItemFile(file || null);
                      }}
                    />
                  </label>

                  {editingItemId ? (
                    <>
                      {editedItemFile ? (
                        <p className="small-info">Selected: {editedItemFile.name}</p>
                      ) : editedItem.image_url ? (
                        <p className="small-info">Current: (will keep existing if no file selected)</p>
                      ) : (
                        <p className="small-info">No image set</p>
                      )}
                    </>
                  ) : (
                    newItemFile && <p className="small-info">Selected: {newItemFile.name}</p>
                  )}
                </div>

                {/* URL fallback (wide) */}
                <input
                  type="text"
                  placeholder="OR Image URL (optional)"
                  value={editingItemId ? editedItem.image_url : newItem.image_url}
                  onChange={(e) =>
                    editingItemId
                      ? setEditedItem({ ...editedItem, image_url: e.target.value })
                      : setNewItem({ ...newItem, image_url: e.target.value })
                  }
                  className="wide"
                />

                <textarea
                  placeholder="Description (optional)"
                  value={editingItemId ? editedItem.description : newItem.description}
                  onChange={(e) =>
                    editingItemId
                      ? setEditedItem({ ...editedItem, description: e.target.value })
                      : setNewItem({ ...newItem, description: e.target.value })
                  }
                  className="wide"
                />

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="wide">
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={uploading}
                  >
                    {uploading ? (editingItemId ? 'Updating…' : 'Saving…') : (editingItemId ? 'Update Item' : 'Save Item')}
                  </button>

                  {editingItemId && (
                    <button
                      type="button"
                      className="small-btn"
                      onClick={cancelEditItem}
                    >
                      Cancel
                    </button>
                  )}

                  {/* extra small helper when adding */}
                  {!editingItemId && (
                    <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280' }}>
                      Tip: use image upload OR URL.
                    </div>
                  )}
                </div>
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
                                onClick={() => startEditItem(item)}
                              >
                                Edit
                              </button>

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
            margin-top: 12px;
            padding: 12px;
            border-radius: 16px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            box-sizing: border-box;
            overflow: visible;
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
            padding: 8px 10px;
            font-size: 13px;
            width: 100%;
            box-sizing: border-box;
          }
          textarea {
            min-height: 70px;
            resize: vertical;
          }
          /* Use a robust grid for add/edit form to avoid overlapping */
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
            align-items: start;
          }
          /* wide elements span full width */
          .grid .wide {
            grid-column: 1 / -1;
          }
          button {
            cursor: pointer;
          }
          .row button,
          .primary-btn {
            border-radius: 999px;
            border: none;
            padding: 8px 14px;
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
            gap: 6px;
          }
          .file-label {
            font-size: 12px;
            display: inline-flex;
            flex-direction: column;
            gap: 6px;
          }
          .file-label input[type='file'] {
            padding: 6px;
            border-radius: 10px;
            border: 1px dashed #d1d5db;
            background: #f3f4f6;
            font-size: 12px;
          }
          .small-info {
            font-size: 12px;
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
            padding: 8px 10px;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
          }
          .cat-name {
            font-size: 13px;
            font-weight: 500;
          }
          .cat-meta {
            font-size: 12px;
            color: #6b7280;
          }
          .edit-category-box {
            margin-top: 10px;
            padding: 10px;
            border-radius: 10px;
            background: #fff;
            border: 1px solid #eef2f6;
          }
          .table-wrap {
            margin-top: 6px;
            overflow-x: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th,
          td {
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
            text-align: left;
            vertical-align: middle;
          }
          th {
            background: #f3f4f6;
          }
          .thumb {
            width: 56px;
            height: 44px;
            border-radius: 8px;
            object-fit: cover;
          }
          .thumb-placeholder {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 56px;
            height: 44px;
            border-radius: 8px;
            background: #fee2e2;
          }
          .small-btn {
            border: none;
            border-radius: 999px;
            padding: 6px 10px;
            font-size: 12px;
            margin-right: 6px;
            background: #e5e7eb;
          }
          .small-btn.danger {
            background: #fee2e2;
            color: #b91c1c;
          }
          .primary-btn {
            background: linear-gradient(135deg, #16a34a, #22c55e);
            color: #fff;
            border: none;
            padding: 8px 14px;
            border-radius: 999px;
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
          @media (max-width: 640px) {
            .grid {
              grid-template-columns: 1fr;
            }
            .table-wrap {
              font-size: 12px;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
