import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Marker } from 'react-leaflet';
import { GoogleMap, StreetViewPanorama } from '@react-google-maps/api';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { kml } from '@mapbox/togeojson';
import L from 'leaflet';
import ReactDOM from 'react-dom';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001/api`;
const MEDIA_URL = API_URL.endsWith('/api') ? API_URL + '/media/' : API_URL.replace(/\/$/, '') + '/api/media/';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const center = [42.595, -8.765]; // Vilagarcia de Arousa

// Security: Escape HTML to prevent XSS
const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Helper to build popup content
const buildPopupContent = (props, layerMeta, token, layerName) => {
  const lowerLayerName = (layerName || '').toLowerCase();
  const lowerDisplayName = (layerMeta?.displayName || '').toLowerCase();
  const isAparcamientos = lowerLayerName.includes('aparcamientos_disuasorios') || 
                         lowerDisplayName.includes('aparcamientos disuasorios');

  let title = escapeHtml(props.nombre || props.NOMBRE || props.name || props.Name || props.nbruaunido || props.NBRUAUNIDO || 'Detalles');
  
  // Custom header for Aparcamientos
  let headerTitle = isAparcamientos ? 'Detalles' : title;

  let popupContent = `
    <div class="bg-[#A41C3A] text-white px-4 py-3 font-bold flex items-center gap-3 shadow-md">
        <img src="/logo2.png" class="w-7 h-7 object-contain" alt="Concello" />
        <span class="tracking-wide uppercase text-[11px] truncate" title="${headerTitle}">${headerTitle}</span>
    </div>
    <div class="p-4 max-h-72 overflow-auto popup-scroll bg-[#fdfbf7]">
  `;
  
  if (isAparcamientos) {
    popupContent += `<div class="mb-1 text-sm text-gray-700 font-bold">${title}</div>`;
    popupContent += '</div>';
    return popupContent;
  }

  const isCatastro = lowerLayerName.includes('catastro') || 
                     lowerDisplayName.includes('catastro') || 
                     props.REFCAT !== undefined || 
                     props.refcat !== undefined;
  const isVados = lowerLayerName.includes('vados') || 
                  lowerDisplayName.includes('vados');
  const isLimiteConcello = lowerLayerName.includes('limite concello') || 
                           lowerDisplayName.includes('limite concello');
  const isParroquias = lowerLayerName.includes('parroquias') || 
                       lowerDisplayName.includes('parroquias');

  const ignoredKeys = [
      'name', 'nombre', 'tipo via', 'nb via', 'titularidad', 'titularida', 
      'dataalta', 'nb_complet', 'revis_vaos', 'corre_padr', 'nb_via_map', 'nb_compl_1', 'nb_compl_!',
      'foto'
  ];
  const catastroWhiteList = ['via', 'numero', 'refcat'];

  const aliases = {
      'nbruaunido': 'Nombre vía',
      'nb_anterior': 'Nombre anterior',
      'nb_anteior': 'Nombre anterior',
      'nlicnuetax': 'Licencia',
      'nbparro': 'parroquia'
  };

  let photoHtml = '';
  let photoFound = false;

  Object.entries(props).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    const strVal = String(value);

    // Identify photo but don't add to popupContent yet
    if (layerMeta?.hasPhotos === 1 && !photoFound && (strVal.toLowerCase().endsWith('.jpg') || strVal.toLowerCase().endsWith('.png') || strVal.toLowerCase().endsWith('.jpeg'))) {
      const baseUrl = MEDIA_URL;
      let photoPath = strVal.replace(/\\/g, '/');
      if (photoPath.toUpperCase().startsWith('CAPAS/')) {
        const parts = photoPath.split('/');
        photoPath = 'layers/' + parts.slice(1).map(p => encodeURIComponent(p)).join('/');
      } else if (!photoPath.toLowerCase().startsWith('layers/')) {
        const layerDir = layerName?.split('/')[0] || '';
        photoPath = `layers/${encodeURIComponent(layerDir)}/${encodeURIComponent(photoPath)}`;
      }
      photoHtml = `<div class="mt-3 pt-2 border-t border-gray-100 text-center flex justify-center"><img src="${baseUrl}${photoPath}?token=${token}" style="min-width: 250px; width: 100%; height: auto; max-height: 400px; object-fit: contain;" class="rounded-md border border-gray-200 shadow-xl" alt="Foto" /></div>`;
      photoFound = true;
    }

    // Process text metadata if not ignored
    let showKey = !ignoredKeys.includes(lowerKey);
    if (isCatastro) {
      showKey = catastroWhiteList.includes(lowerKey);
    } else if (isVados) {
      showKey = lowerKey === 'nlicnuetax';
    } else if (isLimiteConcello) {
      showKey = ['country', 'concello'].includes(lowerKey);
    } else if (isParroquias) {
      showKey = ['nbparro', 'cod_postal'].includes(lowerKey);
    }

    if (showKey && value !== undefined && value !== null && value !== '') {
      const displayKey = escapeHtml(aliases[lowerKey] || key);
      let extraContent = '';
      
      // Add Cadastre link if it's the reference field
      if (lowerKey === 'refcat') {
        const rc1 = encodeURIComponent(props.PCAT1 || props.pcat1 || '');
        const rc2 = encodeURIComponent(props.PCAT2 || props.pcat2 || '');
        const rcCompleta = encodeURIComponent(value);

        const cartoUrl = `https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?RC1=${rc1}&RC2=${rc2}&RC3=&RC4=&esBice=&RCBice1=&RCBice2=&DenoBice=&pest=rc&final=&RCCompleta=${rcCompleta}&from=OVCBusqueda&tipoCarto=nuevo&ZV=NO&ZR=NO&anyoZV=&strFechaVR=&tematicos=&anyotem=&historica=&coordinadas=&cartografia=True&ListaBienes=TRUE`;

        extraContent = `
          <a href="${cartoUrl}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="inline-flex items-center ml-2 text-[#A41C3A] hover:scale-110 transition-transform" 
             title="Ver Cartografía en Sede Electrónica del Catastro">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: -2px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
        `;
      }

      popupContent += `<div class="mb-1 flex items-center"><span class="font-semibold text-gray-400 text-[10px] uppercase tracking-wider">${displayKey}:</span> <span class="text-xs text-gray-700 font-medium ml-1 flex items-center">${escapeHtml(value)}${extraContent}</span></div>`;
    }
  });

  popupContent += photoHtml;
  
  popupContent += '</div>';
  return popupContent;
};

// Helper component to handle layer loading
const KmlLayers = ({ token, layers, activeLayers, mapConfig, geoJsonData, setGeoJsonData, onFocusFeature }) => {
  const fetchedLayers = React.useRef(new Set());

  useEffect(() => {
    const loadLayers = async () => {
      let changed = false;
      const newData = {};

      for (const layerName of activeLayers) {
        if (!geoJsonData[layerName] && !fetchedLayers.current.has(layerName)) {
          fetchedLayers.current.add(layerName);
          try {
            if (layerName.endsWith('.kml')) {
              const res = await axios.get(`/layers/${layerName}`, { 
                responseType: 'text',
                headers: { Authorization: `Bearer ${token}` }
              });
              const dom = new DOMParser().parseFromString(res.data, 'text/xml');
              newData[layerName] = kml(dom);
            } else if (layerName.endsWith('.shp')) {
              const res = await axios.get(`/layers/${layerName}`, { 
                responseType: 'json',
                headers: { Authorization: `Bearer ${token}` }
              });
              newData[layerName] = res.data;
            }
            changed = true;
          } catch (err) {
            console.error('Error loading layer:', layerName, err);
            fetchedLayers.current.delete(layerName);
          }
        }
      }

      if (changed) {
        setGeoJsonData(prev => ({ ...prev, ...newData }));
      }
    };

    if (activeLayers.length > 0) {
      loadLayers();
    }
  }, [activeLayers, token, geoJsonData, setGeoJsonData]);

  return (
    <>
      {activeLayers.map(layerName => {
        const layerMeta = layers.find(l => l.filename === layerName) || {};
        return geoJsonData[layerName] && (
          <GeoJSON 
            key={`${layerName}-${mapConfig.showPOI}-${layerMeta.strokeWidth}-${layerMeta.colorType}-${layerMeta.labelField}-${mapConfig.layerLabels?.[layerName]}-${mapConfig.layerOpacities?.[layerName]}`} 
            data={geoJsonData[layerName]} 
            style={(feature) => {
              const currentZoom = mapConfig.zoom || 14;
              const baseWeight = layerMeta.strokeWidth !== undefined ? layerMeta.strokeWidth : 2;
              
              // Scale weight based on zoom
              let weight = baseWeight * (0.5 + (currentZoom - 14) * 0.4);
              const dynamicWeight = Math.min(15, Math.max(1, weight));
              
              let color = layerMeta.color || '#A41C3A';
              
              // Generate unique color if requested AND fields have value
              if (layerMeta.colorType === 'unique' && layerMeta.labelField) {
                  const fields = layerMeta.labelField.split(',').map(f => f.trim()).filter(f => f);
                  
                  if (fields.length > 0) {
                      // Color depends on the LAST field selected (as requested)
                      const targetField = fields[fields.length - 1];
                      
                      // Case-insensitive lookup for the property value
                      let val = feature.properties[targetField];
                      if (val === undefined) {
                          const actualKey = Object.keys(feature.properties).find(k => k.toLowerCase() === targetField.toLowerCase());
                          if (actualKey) val = feature.properties[actualKey];
                      }
                      
                      const strVal = String(val || '');
                      if (strVal) {
                          // Enhanced hash function with a larger prime for better distribution
                          let hash = 0;
                          for (let i = 0; i < strVal.length; i++) {
                              hash = ((hash << 5) - hash) + strVal.charCodeAt(i);
                              hash |= 0; 
                          }
                          
                          // Use a prime multiplier to spread the hue across the spectrum
                          const hueBase = Math.abs(hash * 137.5) % 360; 
                          const s = 65 + (Math.abs((hash * 7) % 20)); 
                          const l = 45 + (Math.abs((hash * 3) % 10)); 
                          color = `hsl(${hueBase}, ${s}%, ${l}%)`;
                      }
                  }
              }
              
              const opacity = mapConfig.layerOpacities?.[layerName] ?? 0.9;
              const fillOpacity = (mapConfig.layerOpacities?.[layerName] ?? 0.35) * 0.4; // Scaled fill

              return {
                color: color,
                weight: dynamicWeight,
                opacity: opacity,
                fillColor: color,
                fillOpacity: fillOpacity
              };
            }}
            onEachFeature={(feature, layer) => {
              // Add popup if enabled
              if (feature.properties && mapConfig.showPOI) {
                const popupContent = buildPopupContent(feature.properties, layerMeta, token, layerName);
                layer.bindPopup(popupContent, { maxWidth: 400, minWidth: 280 });
              }
              
              // Add label if configured and not hidden in sidebar
              const isLabelVisibleByConfig = mapConfig.layerLabels?.[layerName] !== false;
              if (layerMeta.labelField && isLabelVisibleByConfig) {
                  const fields = layerMeta.labelField.split(',');
                  const showFieldLabel = layerMeta.showFieldLabel !== 0;
                  
                  const labelParts = fields.map(f => {
                      const val = feature.properties[f];
                      if (val === undefined || val === null || val === '') return null;
                      return showFieldLabel ? `${f}: ${val}` : `${val}`;
                  }).filter(p => p !== null);

                  if (labelParts.length > 0) {
                      layer.bindTooltip(labelParts.join(', '), {
                          permanent: true,
                          direction: 'center',
                          className: 'premium-map-label'
                      }).openTooltip();
                  }
              }

              layer.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                onFocusFeature(feature);
              });
            }}
            pointToLayer={(feature, latlng) => {
              // 1. If custom icon is uploaded, use it (always overrides everything else)
              if (layerMeta.customIcon) {
                   const icon = L.icon({
                       iconUrl: layerMeta.customIcon,
                       iconSize: [32, 32],
                       iconAnchor: [16, 32],
                       popupAnchor: [0, -32]
                   });
                   return L.marker(latlng, { icon });
              }
              
              // 2. If marker type is 'circle', use colored dot
              if (layerMeta.markerType === 'circle') {
                return L.circleMarker(latlng, {
                  radius: 6,
                  fillColor: layerMeta.color || '#A41C3A',
                  color: '#fff',
                  weight: 1,
                  opacity: 1,
                  fillOpacity: 0.8
                });
              }

              // 3. Default: Traditional Pin (Leaflet Marker)
              return L.marker(latlng);
            }}
          />
        )
      })}
    </>
  );
};

const PegmanControl = ({ active, onToggle, onCustomDragStart, pegmanImgUrl }) => {
  const map = useMap();
  const divRef = useRef(null);

  useEffect(() => {
    const el = divRef.current;
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);

      const handleDown = (e) => {
        L.DomEvent.stopPropagation(e);
        L.DomEvent.preventDefault(e);
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        onCustomDragStart({ clientX, clientY });
      };

      L.DomEvent.on(el, 'mousedown touchstart', handleDown);
      
      return () => {
        L.DomEvent.off(el, 'mousedown touchstart', handleDown);
      };
    }
  }, [onCustomDragStart]);

  return (
    <div className="leaflet-bottom leaflet-left" style={{ marginBottom: '25px', marginLeft: '12px', zIndex: 2000, pointerEvents: 'auto' }}>
      <div 
        ref={divRef}
        className={`p-3 rounded-full shadow-2xl border-2 transition-all flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-md ${active ? 'bg-yellow-400 border-yellow-500 scale-110' : 'bg-black/60 border-white/20 hover:bg-black/80 text-white'}`}
        title="Mantén calcado y arrastra el muñeco al mapa para ver la calle"
        onClick={onToggle}
      >
        <img src={pegmanImgUrl} draggable="false" className="w-8 h-8 pointer-events-none select-none" alt="Pegman" />
      </div>
    </div>
  );
};

// Component to handle custom Pegman dragging and custom Dymamic cursor
const PegmanCustomCursor = ({ isDragging, onDrop, onToggle, startPos }) => {
  const map = useMap();
  // Initialize position right away if provided, avoiding ugly jumps
  const [pos, setPos] = useState({ x: startPos?.x || -100, y: startPos?.y || -100 });
  const [direction, setDirection] = useState('neutro');
  const lastMouseInfo = useRef({ x: startPos?.x || 0, y: startPos?.y || 0, dir: 'neutro' });
  const dragStartTime = useRef(0);

  useEffect(() => {
    if (!isDragging) return;

    setDirection('neutro');
    dragStartTime.current = Date.now();
    
    const onMove = (e) => {
      // prevent default to stop scrolling
      if (e.cancelable) e.preventDefault();
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const dx = clientX - lastMouseInfo.current.x;
      const dy = clientY - lastMouseInfo.current.y;
      
      let newDir = lastMouseInfo.current.dir;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 3) newDir = 'derecha';
        else if (dx < -3) newDir = 'izquierda';
      } else {
         if (dy > 3) newDir = 'abajo';
         else if (dy < -3) newDir = 'arriba';
      }
      
      lastMouseInfo.current = { x: clientX, y: clientY, dir: newDir };
      setDirection(newDir);
      setPos({ x: clientX, y: clientY });
    };

    const onUp = (e) => {
      document.body.style.cursor = '';
      
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
      
      // If it was a quick click, just toggle and cancel drag
      if (Date.now() - dragStartTime.current < 200) {
         onToggle();
         onDrop(null); 
         return;
      }
      
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      
      // Check if dropped inside map
      if (
        clientX >= rect.left && clientX <= rect.right &&
        clientY >= rect.top && clientY <= rect.bottom
      ) {
         const latlng = map.mouseEventToLatLng({ clientX, clientY });
         onDrop({ active: true, pos: [latlng.lat, latlng.lng] });
      } else {
         onDrop(null); // Cancel
      }
    };

    const oldCursor = document.body.style.cursor;
    document.body.style.cursor = 'none';

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    return () => {
      document.body.style.cursor = oldCursor;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, [isDragging, map, onDrop, onToggle]);

  if (!isDragging) return null;

  let bgPosition = '0% 0%';
  switch (direction) {
    case 'neutro': bgPosition = '0% 0%'; break;
    case 'derecha': bgPosition = '100% 0%'; break;
    case 'izquierda': bgPosition = '0% 50%'; break;
    case 'arriba': bgPosition = '100% 50%'; break;
    case 'abajo': bgPosition = '50% 100%'; break;
  }

  return ReactDOM.createPortal(
    <div 
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        pointerEvents: 'none',
        zIndex: 999999,
        willChange: 'left, top'
      }}
    >
      {/* Custom dashed circle cursor */}
      <div style={{
        position: 'absolute',
        width: '32px',
        height: '32px',
        transform: 'translate(-50%, -50%)',
        border: '2px dashed #FFF',
        borderRadius: '50%',
        boxShadow: '0 0 8px rgba(0,0,0,0.5)',
        background: 'rgba(255, 255, 255, 0.2)',
        animation: 'spin 4s linear infinite'
      }} />

      {/* Pegman person offset to the top-right to be visible */}
      <div 
        style={{
          position: 'absolute',
          left: '8px',   // Move right slightly (adjusted from 24px)
          top: '-64px',   // Move up
          width: '64px',
          height: '64px',
          backgroundImage: "url('/image_5.png')",
          backgroundSize: '200% 300%',
          backgroundPosition: bgPosition,
          backgroundRepeat: 'no-repeat',
          filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.4))',
          willChange: 'background-position'
        }}
      />
      
      {/* Inline style for the spin animation if not present elsewhere */}
      <style>{`
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body
  );
};

// Helper component to track and broadcast zoom level
const ZoomHandler = ({ setMapConfig }) => {
  const map = useMap();
  
  useEffect(() => {
    const onZoom = () => {
      const zoom = map.getZoom();
      setMapConfig(prev => {
        if (prev.zoom === zoom) return prev;
        const next = { ...prev, zoom };
        localStorage.setItem('mapConfig', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('mapConfigChange', { detail: next }));
        return next;
      });
    };
    
    map.on('zoom', onZoom);
    // Initial zoom
    onZoom();
    
    return () => map.off('zoom', onZoom);
  }, [map, setMapConfig]);

  return null;
};

const MapResizeHandler = ({ isStreetViewActive }) => {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      // Use a small delay inside observer if preferred, but map.invalidateSize() is synchronous
      map.invalidateSize();
    });
    // Add event listener to the map container to invalidate size on any changes
    observer.observe(container);

    // Use a small delay to ensure container dimensions are set for specific prop changes
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [isStreetViewActive, map]);
  return null;
};

// Keeps the satellite map centred on the Street View position in real time
const StreetViewTracker = ({ pos }) => {
  const map = useMap();
  const lastPos = useRef(null);
  useEffect(() => {
    if (!pos) return;
    const [lat, lng] = pos;
    // Only pan if position actually changed to avoid feedback loop with dragging
    if (lastPos.current && lastPos.current[0] === lat && lastPos.current[1] === lng) return;
    lastPos.current = pos;
    map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }, [pos, map]);
  return null;
};

// Filter component to apply global styles to map
const MapFilter = ({ config }) => {
  const map = useMap();
  useEffect(() => {
      if (config.grayscale) {
          map.getContainer().style.filter = 'grayscale(100%)';
      } else {
          map.getContainer().style.filter = 'none';
      }
  }, [config.grayscale, map]);
  return null;
}

// FocusHandler: zoom to selected feature AND render highlight in one step
// This eliminates the "flying" effect where the GeoJSON renders at old coords before zoom completes.
const FocusHandler = ({ feature, token }) => {
  const map = useMap();
  const highlightRef = useRef(null);

  useEffect(() => {
    // Remove old highlight layer
    if (highlightRef.current) {
      map.removeLayer(highlightRef.current);
      highlightRef.current = null;
    }

    if (!feature) return;

    // Build and add highlight layer directly to the map (not via React)
    const highlight = L.geoJSON(feature, {
      style: () => ({
        color: '#00FF00',
        weight: 6,
        opacity: 1,
        fillColor: '#00FF00',
        fillOpacity: 0.4
      }),
      pointToLayer: (f, latlng) => {
        return L.circleMarker(latlng, {
          radius: 12,
          color: '#00FF00',
          weight: 4,
          fillColor: '#00FF00',
          fillOpacity: 0.3
        });
      }
    });

    // Zoom first, THEN add the layer so it renders at the correct position after pan completes
    if (feature.geometry?.type === 'Point') {
      const [lng, lat] = feature.geometry.coordinates;
      map.flyTo([lat, lng], 18, { animate: true, duration: 1.2 });
      map.once('moveend', () => { highlight.addTo(map); highlightRef.current = highlight; });
    } else if (feature.geometry) {
      const bounds = highlight.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 18, animate: true, duration: 1.2 });
        map.once('moveend', () => { highlight.addTo(map); highlightRef.current = highlight; });
      }
    }
  }, [feature, map]);

  return null;
};

const Map = ({ token, layers, activeLayers, geoJsonData, setGeoJsonData, focusFeature, onFocusFeature, isStreetViewActive, setIsStreetViewActive }) => {
  const [mapConfig, setMapConfig] = useState(() => {
    const saved = localStorage.getItem('mapConfig');
    const initial = saved ? JSON.parse(saved) : {
      showLabels: false,
      showPOI: true,
      terrain: false,
      grayscale: false
    };
    if (!saved) return { ...initial, showLabels: false };
    return { ...initial, showPOI: true, grayscale: false };
  });

  const [isDraggingPegman, setIsDraggingPegman] = useState(false);
  const [streetViewPos, setStreetViewPos] = useState(center);
  const mapRef = useRef(null);
  // Prevents feedback loop: flag set when user drags Leaflet marker
  const isDraggingMarker = useRef(false);
  const dragTimeoutRef = useRef(null);
  // Debounce ref for Street View position updates (prevents crash from rapid fires)
  const posUpdateTimeout = useRef(null);
  const svPanoramaRef = useRef(null);

  useEffect(() => {
    const handleConfigChange = (e) => {
      setMapConfig(e.detail);
    };
    window.addEventListener('mapConfigChange', handleConfigChange);
    return () => window.removeEventListener('mapConfigChange', handleConfigChange);
  }, []);

  const toggleStreetView = () => {
    setIsStreetViewActive(prev => !prev);
  };

  const onPegmanDrag = (e) => {
    if (e.target && e.target.getLatLng) {
      const { lat, lng } = e.target.getLatLng();
      setStreetView(prev => ({ ...prev, pos: [lat, lng] }));
    }
  };

  const pegmanIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  // Use a reliable SVG for the Pegman icon to ensure it always loads
  const pegmanImgUrl = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cGF0aCBmaWxsPSIjZjRiNDAwIiBkPSJNMjAgMmMtMy4zIDAtNiAyLjctNiA2czIuNyA2IDYgNiA2LTIuNyA2LTYtMi43LTYtNi02em0wIDE0Yy00LjQgMC04IDMuNi04IDh2MTRoMTZWMjRjMC00LjQtMy42LTgtOC04eiIvPjwvc3ZnPg==`;

  return (
    <div className={`w-full h-full bg-[#111] flex ${isStreetViewActive ? 'flex-col md:flex-row' : ''}`}>
      <div className={`${isStreetViewActive ? 'w-full md:w-1/2 h-1/2 md:h-full' : 'w-full h-full'} relative border-r border-[#222]`}>
        <MapContainer 
          center={center} 
          zoom={14} 
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          ref={mapRef}
        >
          <MapFilter config={mapConfig} />
          <FocusHandler feature={focusFeature} token={token} />
          <ZoomHandler setMapConfig={setMapConfig} />
          
          <PegmanCustomCursor 
             isDragging={isDraggingPegman} 
             startPos={isDraggingMarker.current}
             onToggle={toggleStreetView}
             onDrop={(data) => {
                setIsDraggingPegman(false);
                if (data) {
                  setIsStreetViewActive(data.active);
                  setStreetViewPos(data.pos);
                }
             }} 
          />

          <MapResizeHandler isStreetViewActive={isStreetViewActive} />
          {isStreetViewActive && <StreetViewTracker pos={streetViewPos} />}
          
          {mapConfig.showLabels ? (
              <TileLayer
                  attribution='&copy; Google'
                  url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                  maxPoints={22}
                  maxZoom={22}
                  maxNativeZoom={20}
              />
          ) : (
              <TileLayer
                  attribution='&copy; Esri &mdash; Source: Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={22}
                  maxNativeZoom={18}
              />
          )}
          
          {mapConfig.wmsLayers && mapConfig.wmsLayers.map(wms => (
            <TileLayer.WMS
              key={wms.url}
              url={wms.url}
              layers={wms.layers}
              format="image/png"
              transparent={true}
              attribution={wms.attribution}
            />
          ))}

          {/* IGN Base layer from Spain's National Geographic Institute */}
          {mapConfig.showIGN && (
            <TileLayer
              attribution='&copy; <a href="https://www.ign.es" target="_blank">Instituto Geográfico Nacional de España</a>'
              url="https://www.ign.es/wmts/ign-base?layer=IGNBaseTodo&style=default&tilematrixset=GoogleMapsCompatible&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/jpeg&TileMatrix={z}&TileCol={x}&TileRow={y}"
              maxZoom={20}
              opacity={1}
            />
          )}

          <KmlLayers token={token} layers={layers} activeLayers={activeLayers} mapConfig={mapConfig} geoJsonData={geoJsonData} setGeoJsonData={setGeoJsonData} onFocusFeature={onFocusFeature} />

          {isStreetViewActive && (
            <Marker 
              position={streetViewPos} 
              draggable={true} 
              icon={pegmanIcon}
              eventHandlers={{
                dragstart: () => {
                  // Signal that the move is coming from the Leaflet side, not Street View
                  isDraggingMarker.current = true;
                  if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
                },
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  setStreetViewPos([lat, lng]);
                  // Give Street View ~1.5s to load and settle before re-enabling callback
                  dragTimeoutRef.current = setTimeout(() => {
                    isDraggingMarker.current = false;
                  }, 1500);
                }
              }}
            />
          )}

          <PegmanControl 
            active={isStreetViewActive} 
            onToggle={toggleStreetView} 
            onCustomDragStart={(e) => {
              // Now we pass the initial click coordinates so the cursor starts there!
              isDraggingMarker.current = { x: e.clientX, y: e.clientY }; 
              setIsDraggingPegman(true);
            }}
            pegmanImgUrl={pegmanImgUrl}
          />
        </MapContainer>
      </div>

      {isStreetViewActive && (
        <div className="w-full md:w-1/2 h-1/2 md:h-full bg-black relative">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={{ lat: streetViewPos[0], lng: streetViewPos[1] }}
            zoom={14}
          >
            <StreetViewPanorama
              position={{ lat: streetViewPos[0], lng: streetViewPos[1] }}
              visible={true}
              options={{
                enableCloseButton: false,
                addressControl: true,
                imageDateControl: true
              }}
              onLoad={(panorama) => {
                svPanoramaRef.current = panorama;
                // Use native Google Maps event listener instead of React prop
                // This lets us debounce and guard without re-rendering issues
                panorama.addListener('position_changed', () => {
                  if (isDraggingMarker.current) return;
                  if (posUpdateTimeout.current) clearTimeout(posUpdateTimeout.current);
                  posUpdateTimeout.current = setTimeout(() => {
                    try {
                      const pos = panorama.getPosition();
                      if (pos) setStreetViewPos([pos.lat(), pos.lng()]);
                    } catch(e) {}
                  }, 600); // debounce: only update after 600ms of no movement
                });
              }}
            />
          </GoogleMap>
        </div>
      )}
    </div>
  );
};

export default Map;
