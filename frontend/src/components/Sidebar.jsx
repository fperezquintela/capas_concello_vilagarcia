import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { Layers, Shield, LogOut, Settings2, Eye, EyeOff, Map as MapIcon, Box, Info, Search, Type, ChevronDown, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

const Sidebar = ({ token, user, layers, activeLayers, toggleLayer, onLogout, geoJsonData, onFocusFeature }) => {
  const location = useLocation();
  const isMap = location.pathname === '/';
  const isAdmin = location.pathname === '/admin';
  const [searchQueries, setSearchQueries] = useState({});
  const [searchResults, setSearchResults] = useState({});
  const [lastClickedLayer, setLastClickedLayer] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  
  // Custom Map Options State - Load from LocalStorage
  const [mapConfig, setMapConfig] = useState(() => {
    const saved = localStorage.getItem('mapConfig');
    const initial = saved ? JSON.parse(saved) : {
      showLabels: false,
      showPOI: true,
      terrain: false,
      grayscale: false,
      showIGN: false,
      layerLabels: {}
    };
    if (!saved) return { ...initial, showLabels: false };
    return { ...initial, showPOI: true, grayscale: false, showIGN: initial.showIGN ?? false };
  });

  // Broadcast and Save map config
  useEffect(() => {
    localStorage.setItem('mapConfig', JSON.stringify(mapConfig));
    window.dispatchEvent(new CustomEvent('mapConfigChange', { detail: mapConfig }));
  }, [mapConfig]);

  const handleSearch = (filename, query) => {
    setSearchQueries(p => ({ ...p, [filename]: query }));
    if (!query || query.trim().length < 2) {
      setSearchResults(p => ({ ...p, [filename]: [] }));
      return;
    }
    
    const data = geoJsonData?.[filename];
    if (!data || !data.features) return;
    
    const lowerQuery = query.toLowerCase();
    const results = [];
    
    for (const feature of data.features) {
       if (!feature.properties) continue;
       
       let matched = false;
       let label = '';
       
       for (const [key, value] of Object.entries(feature.properties)) {
          if (value && String(value).toLowerCase().includes(lowerQuery)) {
             matched = true;
             label = feature.properties.nbruaunido || feature.properties.NBRUAUNIDO || feature.properties.name || feature.properties.Name || feature.properties.NOMBRE || feature.properties.nombre || feature.properties.text || String(value);
             break;
          }
       }
       if (matched) {
          results.push({ feature, label: String(label) });
          if (results.length > 20) break;
       }
    }
    
    setSearchResults(p => ({ ...p, [filename]: results }));
  };

  const clearSearch = (filename) => {
      setSearchQueries(p => ({ ...p, [filename]: '' }));
      setSearchResults(p => ({ ...p, [filename]: [] }));
  };

  // Group layers by category
  const layersByCategory = layers?.reduce((acc, layer) => {
    const cat = layer.category || 'Sín Categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(layer);
    return acc;
  }, {}) || {};

  const toggleCategory = (cat) => {
    setExpandedCategories(p => ({ ...p, [cat]: !p[cat] }));
  };

  if (isSidebarHidden) {
    return (
      <button 
        onClick={() => setIsSidebarHidden(false)}
        className="absolute top-6 left-6 z-[2000] p-4 bg-accent text-white rounded-2xl shadow-2xl border border-white/20 hover:scale-110 transition-all"
        title="Mostrar Panel"
      >
        <Maximize2 size={24} />
      </button>
    );
  }

  return (
    <div className="w-80 h-full z-[1001] flex flex-col pt-3 backdrop-blur-3xl bg-accent dark:bg-accent border-r border-white/10 shadow-2xl relative transition-all duration-300">
      
      <button 
        onClick={() => setIsSidebarHidden(true)}
        className="absolute -right-3 top-10 w-6 h-6 bg-accent border border-white/10 rounded-full flex items-center justify-center text-white/50 hover:text-white z-20 shadow-lg"
        title="Ocultar Panel"
      >
        <ChevronRight className="rotate-180" size={14} />
      </button>
      
      {/* Header with Logo */}
      <div className="px-6 pb-2 flex flex-col items-center gap-2 border-b border-white/10 mb-2">
        <div className="w-40 flex items-center justify-center">
          <img src="/logo.png" alt="Logo" className="max-w-full h-auto" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4 custom-scrollbar">
        {isMap && (
          <>
            {/* Base map layers section */}
            <div className="pt-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2 pl-1">Capas base</p>
              <div
                className="flex items-center justify-between p-4 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition-all shadow-sm cursor-pointer"
                onClick={() => setMapConfig(p => ({ ...p, showIGN: !p.showIGN }))}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">IGN Base</span>
                  <span className="text-[10px] text-white/50 mt-0.5">Instituto Geográfico Nacional</span>
                </div>
                <button
                  className={`w-10 h-6 p-1 rounded-full transition-all flex items-center flex-shrink-0 ${mapConfig.showIGN ? 'bg-white' : 'bg-black/20'}`}
                  onClick={(e) => { e.stopPropagation(); setMapConfig(p => ({ ...p, showIGN: !p.showIGN })); }}
                >
                  <div className={`w-4 h-4 rounded-full transition-all ${mapConfig.showIGN ? 'translate-x-4 bg-[#A41C3A]' : 'translate-x-0 bg-white'}`} />
                </button>
              </div>
            </div>
          </>
        )}

        {!layers && <div className="text-white/60 animate-pulse text-sm">Cargando capas...</div>}
        
        {layers && layers.length === 0 && (
          <div className="text-white/40 text-sm italic py-4 text-center">
            No hay capas disponibles.
          </div>
        )}

        {isMap && Object.entries(layersByCategory).map(([category, catLayers]) => {
          const isExpanded = expandedCategories[category] !== false; // Default expanded
          
          return (
            <div key={category} className="space-y-2">
              <button 
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between py-2 px-1 hover:bg-white/5 rounded-lg transition-all group"
              >
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 group-hover:text-white/60">{category}</span>
                {isExpanded ? <ChevronDown size={14} className="text-white/20" /> : <ChevronRight size={14} className="text-white/20" />}
              </button>

              {isExpanded && catLayers.map(layer => {
                const isActive = activeLayers.includes(layer.filename);
                const showDetails = isActive && lastClickedLayer === layer.filename;
                
                return (
                  <div 
                    key={layer.filename} 
                    onClick={() => {
                       if (isActive) setLastClickedLayer(layer.filename);
                    }}
                    className="flex flex-col p-4 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition-all group shadow-sm cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold truncate pr-4 text-white group-hover:text-white flex items-center gap-2" title={layer.filename}>
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: layer.color || '#A41C3A' }} />
                        {layer.displayName || 'Sin nombre'}
                      </span>
                      
                      <div className="flex items-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isActive) {
                                setLastClickedLayer(layer.filename);
                            } else {
                                // Clear search state when layer is turned off
                                setSearchQueries(p => ({ ...p, [layer.filename]: '' }));
                                setSearchResults(p => ({ ...p, [layer.filename]: [] }));
                                if (lastClickedLayer === layer.filename) {
                                   setLastClickedLayer(null);
                                }
                            }
                            toggleLayer(layer.filename);
                          }}
                          className={`w-10 h-6 p-1 rounded-full transition-all flex items-center ${isActive ? 'bg-white' : 'bg-black/20'}`}
                        >
                          <div className={`w-4 h-4 rounded-full transition-all ${isActive ? 'translate-x-4 bg-[#A41C3A]' : 'translate-x-0 bg-white'}`} />
                        </button>
                      </div>
                    </div>

                    {showDetails && (
                      <div className="mt-3 space-y-3">
                        {/* Opacity Slider */}
                        {layer.showOpacity !== 0 && (
                          <div className="px-1">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Opacidad</span>
                              <span className="text-[10px] text-white/60">{Math.round((mapConfig.layerOpacities?.[layer.filename] ?? 1) * 100)}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0.1" max="1" step="0.05"
                              value={mapConfig.layerOpacities?.[layer.filename] ?? 1}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                 setMapConfig(p => ({
                                    ...p,
                                    layerOpacities: {
                                      ...(p.layerOpacities || {}),
                                      [layer.filename]: parseFloat(e.target.value)
                                    }
                                 }));
                              }}
                              className="w-full accent-white h-1 bg-black/40 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        )}

                        {geoJsonData && geoJsonData[layer.filename] && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1 flex items-center bg-black/20 border border-white/10 rounded-lg overflow-hidden">
                                <Search className="w-4 h-4 text-white/50 ml-2" />
                                <input 
                                  type="text" 
                                  placeholder="Buscar..."
                                  className="w-full text-xs bg-transparent px-2 py-2 outline-none text-white placeholder:text-white/40"
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => handleSearch(layer.filename, e.target.value)}
                                  value={searchQueries[layer.filename] || ''}
                                />
                              </div>
                              
                              {layer.showFieldLabel === 1 && (
                                <button
                                  title={mapConfig.layerLabels?.[layer.filename] !== false ? "Desactivar etiquetas" : "Activar etiquetas"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentVal = mapConfig.layerLabels?.[layer.filename] !== false;
                                    setMapConfig(p => ({
                                      ...p,
                                      layerLabels: {
                                        ...(p.layerLabels || {}),
                                        [layer.filename]: !currentVal
                                      }
                                    }));
                                  }}
                                  className={`flex-shrink-0 p-2 rounded-lg transition-all flex items-center justify-center border ${mapConfig.layerLabels?.[layer.filename] !== false ? 'bg-white/20 border-white/30 text-white' : 'bg-black/20 border-white/5 text-white/30 hover:text-white/60'}`}
                                >
                                  <Type size={14} />
                                </button>
                              )}
                            </div>
                            
                            {searchResults[layer.filename]?.length > 0 && (
                              <div className="mt-2 bg-black/30 rounded-lg border border-white/10 max-h-40 overflow-y-auto custom-scrollbar">
                                 {searchResults[layer.filename].map((res, i) => (
                                   <div 
                                     key={i} 
                                     className="px-3 py-2 text-xs text-white hover:bg-[#A41C3A]/50 cursor-pointer border-b border-white/5 last:border-0 truncate transition-colors"
                                     onClick={(e) => { e.stopPropagation(); onFocusFeature(res.feature); }}
                                     title={res.label}
                                   >
                                     {res.label}
                                   </div>
                                 ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        
        {isAdmin && (
          <div className="text-white/40 text-[10px] font-black uppercase tracking-widest text-center py-10">
            Modo Edición Activado
          </div>
        )}
      </div>

      {/* Footer Settings */}
      <div className="px-6 py-6 border-t border-white/10 space-y-3">
        {isMap && user?.role === 'admin' && (
           <Link 
             to="/admin" 
             className="flex items-center gap-3 w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-bold border border-white/5 shadow-inner group"
           >
             <Shield size={18} className="text-white/60 group-hover:text-white" /> Panel Administración
           </Link>
        )}
        
        {isAdmin && (
           <Link 
             to="/" 
             className="flex items-center gap-3 w-full p-3 rounded-xl bg-accent text-white hover:bg-white/10 transition-all text-sm font-bold border border-white/5 shadow-inner group"
           >
             <MapIcon size={18} className="text-white/60 group-hover:text-white" /> Volver al Mapa
           </Link>
        )}

        <button 
          onClick={onLogout}
          className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all text-sm font-bold border border-white/5 group ${user?.username === 'guest' ? 'bg-accent hover:bg-white/10 text-white' : 'bg-black/20 hover:bg-red-500/20 text-white'}`}
        >
          {user?.username === 'guest' ? (
            <Shield size={18} className="text-white/60 group-hover:text-white" />
          ) : (
            <LogOut size={18} className="text-white/60 group-hover:text-red-400" />
          )}
          {user?.username === 'guest' ? 'Acceso Autorizado' : 'Cerrar Sesión'}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
