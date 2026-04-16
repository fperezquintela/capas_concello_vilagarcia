import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Users, UserPlus, Save, LayoutGrid, Tag, Edit3, CheckCircle2, Shield, Upload, X, Check, Trash2, Key, Lock, Loader2, Eye, EyeOff, List, Image as ImageIcon, Sun, Moon, Box } from 'lucide-react';

const AdminPanel = ({ token, isDarkMode, setIsDarkMode, onMetadataUpdate }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [allLayers, setAllLayers] = useState([]);
  const [hiddenLayers, setHiddenLayers] = useState([]);
  const [showHidden, setShowHidden] = useState(false);
  const [layerMetadata, setLayerMetadata] = useState({});
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [editingLayer, setEditingLayer] = useState(null);
  const [availableFields, setAvailableFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newHasPhotos, setNewHasPhotos] = useState(false);
  const [newCustomIcon, setNewCustomIcon] = useState(null);
  const [newDefaultWeight, setNewDefaultWeight] = useState(10);
  const [newColor, setNewColor] = useState('#A41C3A');
  const [newMarkerType, setNewMarkerType] = useState('pin');
  const [newStrokeWidth, setNewStrokeWidth] = useState(2);
  const [newLabelFields, setNewLabelFields] = useState(['']);
  const [newShowFieldLabel, setNewShowFieldLabel] = useState(true);
  const [newColorType, setNewColorType] = useState('fixed');
  const [newCategory, setNewCategory] = useState('Sín Categoría');
  const [newShowOpacity, setNewShowOpacity] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  const PRESET_COLORS = [
    '#A41C3A', // Granate (Brand)
    '#2563EB', // Azul
    '#10B981', // Verde
    '#F59E0B', // Naranja
    '#8B5CF6', // Púrpura
    '#06B6D4', // Cyan
    '#D946EF', // Rosa
    '#64748B', // Pizarra
  ];
  
  // Modal states
  const [userToEditLayers, setUserToEditLayers] = useState(null);
  const [userToChangePass, setUserToChangePass] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [layerToHide, setLayerToHide] = useState(null);
  const [changedPassword, setChangedPassword] = useState('');

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const dirInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const [usersRes, layersRes, metaRes, hiddenRes] = await Promise.all([
        axios.get('/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/all-layers', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/layers/metadata', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/admin/hidden-layers', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setUsers(usersRes.data);
      setAllLayers(layersRes.data);
      setHiddenLayers(hiddenRes.data);
      
      const metaMap = {};
      metaRes.data.forEach(m => { metaMap[m.layerFilename] = m; });
      setLayerMetadata(metaMap);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/admin/users', { username: newUsername, password: newPassword }, { headers: { Authorization: `Bearer ${token}` } });
      setNewUsername('');
      setNewPassword('');
      fetchData();
      setNotification({ type: 'success', message: 'Usuario creado correctamente' });
    } catch (err) { setNotification({ type: 'error', message: err.response?.data?.error || 'Error creating user' }); }
  };

  const deleteUser = async () => {
    if (!userToDelete) return;
    try {
      await axios.delete(`/admin/users/${userToDelete.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setUserToDelete(null);
      fetchData();
      setNotification({ type: 'success', message: 'Usuario eliminado correctamente' });
    } catch (err) { setNotification({ type: 'error', message: err.response?.data?.error || 'Error deleting user' }); }
  };

  const hideLayer = async () => {
    if (!layerToHide) return;
    try {
      await axios.post('/admin/layers/hide', { filename: layerToHide }, { headers: { Authorization: `Bearer ${token}` } });
      setLayerToHide(null);
      fetchData();
      setNotification({ type: 'success', message: 'Capa ocultada correctamente' });
    } catch (err) { setNotification({ type: 'error', message: err.response?.data?.error || 'Error hiding layer' }); }
  };

  const unhideLayer = async (filename) => {
    try {
      await axios.post('/admin/layers/unhide', { filename }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
      setNotification({ type: 'success', message: 'Capa restaurada correctamente' });
    } catch (err) { setNotification({ type: 'error', message: err.response?.data?.error || 'Error unhiding layer' }); }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    if (!userToChangePass) return;
    try {
      await axios.put(`/admin/users/${userToChangePass.id}/password`, { password: changedPassword }, { headers: { Authorization: `Bearer ${token}` } });
      setUserToChangePass(null);
      setChangedPassword('');
      setNotification({ type: 'success', message: 'Contraseña actualizada con éxito' });
    } catch (err) { setNotification({ type: 'error', message: err.response?.data?.error || 'Error updating password' }); }
  };

  const toggleUserLayer = async (userId, layer) => {
    const user = users.find(u => u.id === userId);
    let newLayers = [...(user.layers || [])];
    if (newLayers.includes(layer)) newLayers = newLayers.filter(l => l !== layer);
    else newLayers.push(layer);

    try {
      await axios.put(`/admin/users/${userId}/layers`, { layers: newLayers }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const updateLayerName = async (filename) => {
    try {
      await axios.post('/admin/layers/metadata', { 
        layerFilename: filename, 
        displayName: newDisplayName,
        hasPhotos: newHasPhotos,
        customIcon: newCustomIcon,
        defaultWeight: newDefaultWeight,
        color: newColor,
        markerType: newMarkerType,
        strokeWidth: newStrokeWidth,
        labelField: newLabelFields.filter(f => f).join(','),
        colorType: newColorType,
        showFieldLabel: newShowFieldLabel,
        category: newCategory,
        showOpacity: newShowOpacity
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEditingLayer(null);
      setNewDisplayName('');
      await fetchData();
      if (onMetadataUpdate) onMetadataUpdate();
      setNotification({ type: 'success', message: 'Cambios guardados con éxito' });
    } catch (err) { 
      console.error(err); 
      setNotification({ type: 'error', message: err.response?.data?.error || 'Error al guardar los cambios' });
    }
  };

  useEffect(() => {
    if (editingLayer) {
      const fetchFields = async () => {
        setLoadingFields(true);
        try {
          const res = await axios.get(`/admin/layers/fields/${encodeURIComponent(editingLayer)}`, { headers: { Authorization: `Bearer ${token}` } });
          setAvailableFields(Array.isArray(res.data) ? res.data : []);
        } catch (err) { console.error('Error fetching fields:', err); }
        setLoadingFields(false);
      };
      fetchFields();
    } else {
      setAvailableFields([]);
    }
  }, [editingLayer, token]);

  const handleIconUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewCustomIcon(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
      // Send the relative path in a parallel array to preserve folder structure
      formData.append('paths', file.webkitRelativePath || file.name);
    });

    setUploading(true);
    try {
      await axios.post('/admin/layers/upload', formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      fetchData();
      setNotification({ type: 'success', message: 'Archivo(s) subido(s) correctamente' });
    } catch (err) {
      setNotification({ type: 'error', message: 'Error subiendo archivo(s)' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (dirInputRef.current) dirInputRef.current.value = '';
    }
  };

  if (loading) return <div className="p-12 text-white/50 animate-pulse">Cargando panel de control...</div>;

  const visibleLayers = showHidden ? [...allLayers, ...hiddenLayers] : allLayers;

  return (
    <div className={`w-full h-full transition-colors duration-300 ${isDarkMode ? 'bg-premium-900 text-white' : 'bg-slate-50 text-slate-900'} overflow-y-auto p-12 custom-scrollbar`}>
      <div className="max-w-6xl mx-auto space-y-10 pb-20">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-accent/20 rounded-2xl shadow-inner border border-accent/30">
              <Shield size={36} className="text-accent" />
            </div>
            <div>
              <h1 className={`text-4xl font-black tracking-tight uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Admin Panel</h1>
              <p className={`font-medium ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>Gestión de usuarios y configuración de capas</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-slate-200/50 dark:bg-black/40 p-1.5 rounded-2xl border border-slate-200 dark:border-white/5 h-fit">
            <button 
              onClick={() => setActiveTab('users')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-accent text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              <Users size={16} /> Usuarios
            </button>
            <button 
              onClick={() => setActiveTab('layers')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'layers' ? 'bg-accent text-white shadow-lg' : 'text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white'}`}
            >
              <LayoutGrid size={16} /> Capas
            </button>
            <div className="w-px bg-slate-200 dark:bg-white/10 mx-2 my-2" />
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="px-4 py-2.5 rounded-xl text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white transition-all flex items-center gap-2"
              title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {activeTab === 'users' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-fade-in">
            {/* Create User */}
            <div className={`p-8 rounded-3xl h-fit border transition-all shadow-2xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
              <div className={`flex items-center gap-3 border-b pb-5 mb-6 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <UserPlus className="text-accent" size={20} />
                <h2 className={`text-xl font-bold uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Nuevo Usuario</h2>
              </div>
              <form onSubmit={createUser} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest mb-2 ml-1">Username</label>
                  <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} required className="w-full glass-input px-4 py-4 dark:bg-black/40 border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-accent/50" placeholder="Nombre" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest mb-2 ml-1">Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full glass-input px-4 py-4 dark:bg-black/40 border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:border-accent/50" placeholder="••••••••" />
                </div>
                <button type="submit" className="w-full bg-accent text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-accent/90 transition-all flex items-center justify-center gap-2">
                  <Save size={18} /> Crear Usuario
                </button>
              </form>
            </div>

            {/* User List */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className={`text-xl font-bold uppercase tracking-widest flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                <Users className="text-accent" /> Lista de Usuarios
              </h2>
              <div className="space-y-4">
                {users.filter(u => u.role !== 'admin').map(user => (
                  <div key={user.id} className={`p-6 rounded-3xl border transition-all shadow-xl flex items-center justify-between group hover:border-accent/30 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-accent text-xl uppercase ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                         {user.username.charAt(0)}
                       </div>
                       <div>
                         <div className={`text-lg font-black uppercase tracking-tight leading-none mb-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{user.username}</div>
                         <div className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Capas: <span className="text-accent">{user.layers?.length || 0}</span></div>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={() => setUserToEditLayers(user)} 
                         className="p-3 bg-white/5 hover:bg-accent text-accent hover:text-white rounded-xl transition-all border border-white/5"
                         title="Editar Permisos"
                       >
                         <Edit3 size={18} />
                       </button>
                       <button 
                         onClick={() => setUserToChangePass(user)} 
                         className="p-3 bg-white/5 hover:bg-blue-500 text-blue-500 hover:text-white rounded-xl transition-all border border-white/5"
                         title="Cambiar Contraseña"
                       >
                         <Key size={18} />
                       </button>
                       <button 
                         onClick={() => setUserToDelete(user)} 
                         className="p-3 bg-white/5 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-white/5"
                         title="Eliminar Usuario"
                       >
                         <Trash2 size={18} />
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
              <h2 className={`text-2xl font-black uppercase tracking-widest flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                <Tag className="text-accent" /> Biblioteca de Capas
              </h2>
              
              <div className="flex items-center gap-4">
                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mr-2">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}
                  >
                    <List size={16} />
                  </button>
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white'}`}
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>
                
                <button 
                  onClick={() => setShowHidden(!showHidden)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all border ${showHidden ? 'bg-white text-accent border-white' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20 hover:text-white'}`}
                >
                  {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  {showHidden ? 'Ver Activas' : 'Ver Ocultas'}
                </button>

                <div className="flex gap-2">
                  <div className="relative">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".kml,.shp,.shx,.dbf,.prj,.cpg,.qmd" 
                      multiple
                      className="hidden" 
                    />
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      disabled={uploading}
                      className="bg-white/10 text-white hover:bg-white/20 px-4 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-2 transition-all border border-white/10 disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                      Archivos
                    </button>
                  </div>

                  <div className="relative">
                    <input 
                      type="file" 
                      ref={dirInputRef} 
                      onChange={handleFileUpload} 
                      webkitdirectory=""
                      directory=""
                      className="hidden" 
                    />
                    <button 
                      onClick={() => dirInputRef.current.click()}
                      disabled={uploading}
                      className="bg-white text-accent hover:bg-white/90 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center gap-2 transition-all shadow-xl disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                      Subir Carpeta
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
              {visibleLayers.map(layer => {
                const isItemHidden = hiddenLayers.includes(layer);
                const metadata = layerMetadata[layer] || {};
                const dName = metadata.displayName || layer;
                const cardActiveStyles = isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200';
                const cardHiddenStyles = isDarkMode ? 'bg-black/40 border-dashed border-white/10' : 'bg-slate-100 border-dashed border-slate-300';
                
                return (
                  <div key={layer} className={`p-6 rounded-3xl border transition-all flex flex-col gap-4 group ${isItemHidden ? cardHiddenStyles : cardActiveStyles} hover:border-accent/20`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className={`text-[10px] font-bold uppercase mb-1 tracking-widest ${isDarkMode ? 'text-white/30' : 'text-slate-400'}`}>Archivo Sistema</div>
                        <div className={`text-sm font-mono truncate italic ${isDarkMode ? 'text-white/40' : 'text-slate-500'}`} title={layer}>{layer}</div>
                      </div>
                      <div className="flex gap-2 items-center">
                        {metadata.hasPhotos === 1 && <ImageIcon size={14} className="text-blue-400" title="Busca fotos asociadas" />}
                        {isItemHidden && <span className="px-2 py-1 bg-white/10 rounded text-[9px] font-black tracking-tighter uppercase text-white/40">Oculta</span>}
                      </div>
                    </div>
                    
                    {editingLayer === layer ? (
                      <div className="space-y-4 animate-slide-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase mb-1">Nombre Mostrar</label>
                             <input 
                               autoFocus
                               type="text" 
                               value={newDisplayName} 
                               onChange={e => setNewDisplayName(e.target.value)}
                               className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-accent/50 rounded-xl px-4 py-3 text-sm outline-none text-slate-900 dark:text-white font-bold"
                               placeholder="Escribe el nuevo nombre..."
                               onKeyDown={e => e.key === 'Enter' && updateLayerName(layer)}
                             />
                          </div>

                          <div>
                             <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase mb-1">Categoría</label>
                             <input 
                               type="text" 
                               value={newCategory} 
                               onChange={e => setNewCategory(e.target.value)}
                               className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none text-slate-900 dark:text-white font-bold"
                               placeholder="Ej: Urbanismo, Medio Ambiente..."
                             />
                          </div>
                        </div>
                        
                        <div className="flex items-center pt-4 gap-6">
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={newHasPhotos} 
                                onChange={e => setNewHasPhotos(e.target.checked)}
                                className="w-4 h-4 rounded-md border-slate-300 dark:border-white/20 text-accent focus:ring-accent bg-slate-100 dark:bg-black/40" 
                              />
                              <span className="text-xs font-bold text-slate-600 dark:text-white/70">Buscar Foto Asociada</span>
                           </label>
                           
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={newShowOpacity} 
                                onChange={e => setNewShowOpacity(e.target.checked)}
                                className="w-4 h-4 rounded-md border-slate-300 dark:border-white/20 text-accent focus:ring-accent bg-slate-100 dark:bg-black/40" 
                              />
                              <span className="text-xs font-bold text-slate-600 dark:text-white/70">Slider de Opacidad</span>
                           </label>
                        </div>

                        <div>
                           <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase mb-2">Color de la Capa</label>
                           <div className="flex flex-wrap gap-2 items-center">
                              {PRESET_COLORS.map(c => (
                                <button 
                                  key={c}
                                  onClick={() => setNewColor(c)}
                                  className={`w-6 h-6 rounded-full transition-transform hover:scale-110 border-2 ${newColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                                  style={{ backgroundColor: c }}
                                  title={c}
                                />
                              ))}
                              <div className="w-px h-6 bg-white/10 mx-1" />
                              <div className="relative group/custom">
                                <input 
                                  type="color" 
                                  value={newColor} 
                                  onChange={e => setNewColor(e.target.value)}
                                  className="w-8 h-8 rounded-lg bg-transparent border-none cursor-pointer overflow-hidden p-0"
                                />
                                <div className="absolute top-full left-0 mt-1 hidden group-hover/custom:block bg-black px-2 py-1 rounded text-[8px] font-bold uppercase pointer-events-none z-10">Custom</div>
                              </div>
                           </div>
                        </div>

                        <div>
                           <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase mb-2">Representación Puntos</label>
                           <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => { setNewMarkerType('pin'); if(!newCustomIcon) setNewCustomIcon(null); }}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${newMarkerType === 'pin' ? 'bg-accent text-white border-accent' : 'bg-black/20 text-white/40 border-white/5 hover:border-white/20'}`}
                              >
                                <Box size={14} /> Chincheta
                              </button>
                              <button 
                                onClick={() => setNewMarkerType('circle')}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${newMarkerType === 'circle' ? 'bg-accent text-white border-accent' : 'bg-black/20 text-white/40 border-white/5 hover:border-white/20'}`}
                              >
                                <CheckCircle2 size={14} /> Círculo
                              </button>
                           </div>
                        </div>

                        <div>
                           <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase mb-2">Icono Personalizado (Imagen)</label>
                           <div className="flex gap-2 items-center">
                              {newCustomIcon && (
                                <div className="p-1.5 bg-white/10 rounded-lg relative group/icon">
                                  <img src={newCustomIcon} alt="Icon" className="w-8 h-8 object-contain" />
                                  <button onClick={() => setNewCustomIcon(null)} className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover/icon:opacity-100 transition-opacity"><X size={10} /></button>
                                </div>
                              )}
                              <label className="flex-1 cursor-pointer">
                                <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-white/10 hover:border-white/20 bg-white/5 text-[10px] font-bold uppercase tracking-widest text-white/40 transition-all">
                                   <ImageIcon size={16} /> {newCustomIcon ? 'Cambiar Imagen' : 'Subir Imagen'}
                                </div>
                                <input 
                                  type="file" 
                                  accept="image/png, image/jpeg, image/svg+xml"
                                  onChange={handleIconUpload}
                                  className="hidden"
                                />
                              </label>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase mb-2">Ancho Borde</label>
                              <input 
                                type="number" 
                                value={newStrokeWidth} 
                                onChange={e => setNewStrokeWidth(parseInt(e.target.value) || 0)}
                                className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none text-slate-900 dark:text-white font-bold"
                                min="0" max="20"
                              />
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase mb-2">Campos Etiqueta (Nombre y Color)</label>
                              <div className="space-y-2">
                               {newLabelFields.map((field, index) => (
                                 <div key={index} className="flex gap-2">
                                   <div className="relative flex-1">
                                     <select 
                                       value={field} 
                                       onChange={e => {
                                         const updated = [...newLabelFields];
                                         updated[index] = e.target.value;
                                         setNewLabelFields(updated);
                                       }}
                                       className="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm outline-none text-slate-900 dark:text-white font-bold appearance-none cursor-pointer"
                                     >
                                       <option value="">-- Ninguno --</option>
                                       {availableFields.map(f => (
                                         <option key={f} value={f}>{f}</option>
                                       ))}
                                     </select>
                                     <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                       {loadingFields ? <Loader2 size={14} className="animate-spin" /> : <span>▼</span>}
                                     </div>
                                   </div>
                                   {index === 0 ? (
                                     <button 
                                       onClick={() => setNewLabelFields([...newLabelFields, ''])}
                                       className="p-2 bg-accent/20 text-accent rounded-xl hover:bg-accent/30 transition-all border border-accent/20"
                                       title="Añadir otro campo"
                                     >
                                       <span className="font-bold">+</span>
                                     </button>
                                   ) : (
                                     <button 
                                      onClick={() => {
                                        const updated = [...newLabelFields];
                                        updated.splice(index, 1);
                                        setNewLabelFields(updated);
                                      }}
                                      className="p-2 bg-red-500/20 text-red-500 rounded-xl hover:bg-red-500/30 transition-all border border-red-500/20"
                                     >
                                       <X size={16} />
                                     </button>
                                   )}
                                 </div>
                               ))}
                            </div>
                            <div className="flex items-center mt-3">
                               <label className="flex items-center gap-2 cursor-pointer group">
                                  <input 
                                    type="checkbox" 
                                    checked={newShowFieldLabel} 
                                    onChange={e => setNewShowFieldLabel(e.target.checked)}
                                    className="w-4 h-4 rounded-md border-slate-300 dark:border-white/20 text-accent focus:ring-accent bg-slate-100 dark:bg-black/40" 
                                  />
                                  <span className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase group-hover:text-accent transition-colors">Incluir nombre del campo en etiqueta</span>
                               </label>
                            </div>
                           </div>
                        </div>

                        <div>
                           <label className="block text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase mb-2">Esquema de Color</label>
                           <div className="grid grid-cols-2 gap-2">
                              <button 
                                onClick={() => setNewColorType('fixed')}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${newColorType === 'fixed' ? 'bg-accent text-white border-accent' : 'bg-black/20 text-white/40 border-white/5 hover:border-white/20'}`}
                              >
                                Único Color
                              </button>
                              <button 
                                onClick={() => setNewColorType('unique')}
                                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${newColorType === 'unique' ? 'bg-accent text-white border-accent' : 'bg-black/20 text-white/40 border-white/5 hover:border-white/20'}`}
                              >
                                Color x Campo
                              </button>
                           </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                           <button onClick={() => updateLayerName(layer)} className="flex-1 bg-accent text-white py-2 rounded-lg text-xs font-bold uppercase tracking-widest">Guardar</button>
                           <button onClick={() => setEditingLayer(null)} className="px-4 bg-slate-200 dark:bg-white/10 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase mb-1 tracking-widest">Nombre en el Mapa</div>
                          <div className={`text-lg font-black flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                             {metadata.customIcon && <img src={metadata.customIcon} alt="Icon" className="w-5 h-5 object-contain" />}
                             <div className="w-3 h-3 rounded-full mr-1 shadow-sm" style={{ backgroundColor: metadata.color || '#A41C3A' }} />
                             {dName}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-auto">
                           <button 
                             onClick={() => { 
                               setEditingLayer(layer); 
                               setNewDisplayName(dName);
                               setNewHasPhotos(metadata.hasPhotos === 1);
                               setNewCustomIcon(metadata.customIcon || null);
                               setNewDefaultWeight(metadata.defaultWeight || 10);
                               setNewColor(metadata.color || '#A41C3A');
                               setNewMarkerType(metadata.markerType || 'pin');
                               setNewStrokeWidth(metadata.strokeWidth || 2);
                               setNewLabelFields(metadata.labelField ? metadata.labelField.split(',') : ['']);
                               setNewShowFieldLabel(metadata.showFieldLabel !== 0);
                               setNewColorType(metadata.colorType || 'fixed');
                               setNewCategory(metadata.category || 'Sín Categoría');
                               setNewShowOpacity(metadata.showOpacity !== 0);
                             }}
                             className="p-2 bg-white/5 hover:bg-accent hover:text-white rounded-lg text-accent transition-all border border-white/5"
                             title="Editar Ajustes"
                           >
                             <Edit3 size={18} />
                           </button>
                             {isItemHidden ? (
                               <button 
                                 onClick={() => unhideLayer(layer)}
                                 className="p-2 bg-white/5 hover:bg-white/20 hover:text-white rounded-lg text-white/40 transition-all border border-white/5"
                                 title="Restaurar Capa"
                               >
                                 <Eye size={18} />
                               </button>
                             ) : (
                               <button 
                                 onClick={() => setLayerToHide(layer)}
                                 className="p-2 bg-white/5 hover:bg-red-500 hover:text-white rounded-lg text-red-500 transition-all border border-white/5"
                                 title="Ocultar Capa"
                               >
                                 <EyeOff size={18} />
                               </button>
                             )}
                          </div>
                        </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL: EDIT LAYERS */}
      {userToEditLayers && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-2xl rounded-[2rem] border shadow-3xl overflow-hidden animate-slide-in ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
             <div className={`p-8 border-b flex items-center justify-between ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                <div>
                   <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Editar Permisos</h3>
                   <p className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-white/40' : 'text-slate-400'}`}>Usuario: {userToEditLayers.username}</p>
                </div>
                <button onClick={() => setUserToEditLayers(null)} className={`p-2 rounded-full transition-all ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-100'}`}><X size={24} /></button>
             </div>
             <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allLayers.map(layer => {
                     const isChecked = userToEditLayers.layers?.includes(layer);
                     const displayName = layerMetadata[layer]?.displayName || layer;
                     return (
                        <label key={layer} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer group ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-accent/10 hover:border-accent/40' : 'bg-slate-50 border-slate-200 hover:bg-accent/5 hover:border-accent/30'}`}>
                           <input 
                             type="checkbox" 
                             checked={isChecked || false} 
                             onChange={() => {
                               toggleUserLayer(userToEditLayers.id, layer);
                               const updatedUser = {...userToEditLayers, layers: isChecked ? userToEditLayers.layers.filter(l => l!== layer) : [...(userToEditLayers.layers||[]), layer]};
                               setUserToEditLayers(updatedUser);
                             }} 
                             className="w-6 h-6 rounded-lg border-white/20 bg-transparent text-accent focus:ring-accent" 
                           />
                           <span className={`text-sm font-bold truncate group-hover:text-accent ${isDarkMode ? 'text-white/70' : 'text-slate-600'}`} title={layer}>{displayName}</span>
                        </label>
                     );
                  })}
                </div>
             </div>
             <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end">
                <button onClick={() => setUserToEditLayers(null)} className="bg-accent text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl">Cerrar</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: CHANGE PASSWORD */}
      {userToChangePass && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-md bg-[#1a1a1a] rounded-[2rem] border border-white/10 shadow-3xl overflow-hidden animate-slide-in">
             <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <Lock className="text-blue-500" size={24} />
                   <h3 className="text-xl font-black uppercase text-white tracking-tight">Cambiar Clave</h3>
                </div>
                <button onClick={() => setUserToChangePass(null)} className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-all"><X size={24} /></button>
             </div>
             <form onSubmit={updatePassword} className="p-8 space-y-6">
                <div>
                   <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 ml-1">Nueva Contraseña para {userToChangePass.username}</label>
                   <input 
                     autoFocus
                     type="password" 
                     value={changedPassword} 
                     onChange={e => setChangedPassword(e.target.value)} 
                     required 
                     className="w-full glass-input px-4 py-4 bg-black/40 border-white/10 rounded-2xl outline-none focus:border-blue-500/50 text-white" 
                     placeholder="••••••••" 
                   />
                </div>
                <div className="flex gap-4 pt-2">
                   <button type="submit" className="flex-1 bg-blue-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-blue-600 transition-all">Actualizar</button>
                   <button type="button" onClick={() => setUserToChangePass(null)} className="flex-1 bg-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all">Cancelar</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: USER DELETE CONFIRMATION */}
      {userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-sm bg-[#1a1a1a] rounded-[2rem] border border-white/10 shadow-3xl p-8 space-y-8 animate-slide-in">
             <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                   <Trash2 size={40} />
                </div>
                <h3 className="text-2xl font-black uppercase text-white text-center">¿Eliminar Usuario?</h3>
                <p className="text-white/50 text-sm font-medium text-center">Estás a punto de eliminar al usuario <span className="text-white font-bold">"{userToDelete.username}"</span>. Esta acción no se puede deshacer.</p>
             </div>
             <div className="flex gap-4">
                <button onClick={deleteUser} className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-red-600 transition-all">Eliminar</button>
                <button onClick={() => setUserToDelete(null)} className="flex-1 bg-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all">Cancelar</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: LAYER HIDE CONFIRMATION */}
      {layerToHide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-sm bg-[#1a1a1a] rounded-[2rem] border border-white/10 shadow-3xl p-8 space-y-8 animate-slide-in">
             <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                   <EyeOff size={40} />
                </div>
                <h3 className="text-2xl font-black uppercase text-white text-center">¿Ocultar Capa?</h3>
                <p className="text-white/50 text-sm font-medium text-center">Vas a ocultar la capa <span className="text-white font-bold">"{layerMetadata[layerToHide]?.displayName || layerToHide}"</span>. No aparecerá en los mapas ni en los permisos de usuario, pero el archivo seguirá en el servidor.</p>
             </div>
             <div className="flex gap-4">
                <button onClick={hideLayer} className="flex-1 bg-accent text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-accent/90 transition-all">Ocultar</button>
                <button onClick={() => setLayerToHide(null)} className="flex-1 bg-white/10 text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-all">Cancelar</button>
             </div>
           </div>
        </div>
      )}

      {/* MODAL: NOTIFICATION */}
      {notification && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className={`w-full max-w-sm rounded-[2rem] border shadow-3xl p-8 space-y-8 animate-slide-in ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${notification.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                {notification.type === 'success' ? <CheckCircle2 size={40} /> : <X size={40} />}
              </div>
              <h3 className={`text-2xl font-black uppercase text-center ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {notification.type === 'success' ? '¡Éxito!' : 'Error'}
              </h3>
              <p className={`text-sm font-medium text-center ${isDarkMode ? 'text-white/50' : 'text-slate-500'}`}>
                {notification.message}
              </p>
            </div>
            <button 
              onClick={() => setNotification(null)} 
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all ${notification.type === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
            >
              Aceptar
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
