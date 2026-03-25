// Persist & state vars declared early so functions below can reference them
// (map is assigned after Leaflet loads)
const RATINGS = [
  { r: 1, color: "#ff3b3b", label: "Terrible", emoji: "💀", weight: 5 },
  { r: 2, color: "#ff8c00", label: "Poor", emoji: "😬", weight: 5 },
  { r: 3, color: "#f5d800", label: "Okay", emoji: "🙂", weight: 5 },
  { r: 4, color: "#a3e635", label: "Good", emoji: "😎", weight: 5 },
  { r: 5, color: "#22c55e", label: "Perfect", emoji: "🔥", weight: 5 },
];

let segments = loadSegments();
let mode = "view";
let drawingPoints = [];
let tempPolyline = null;
let tempMarkers = [];
let selectedRating = null;
let activeSegmentId = null;
let layerMap = {};
let filterSet = new Set([1, 2, 3, 4, 5]);
let map; // assigned once Leaflet is ready
let locationMarker = null;
let locationWatcher = null;
let segmentHandles = {};

// ─── Leaflet dynamic loader ─────────────────────────────────────
(function loadLeaflet() {
  const script = document.createElement("script");
  script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  script.onload = function () {
    // ── Map init ─────────────────────────────────────────────────
    map = L.map("map", { zoomControl: true }).setView([52.06, 5.12], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", onMapClick);
    init();
  };
  script.onerror = function () {
    document.getElementById("map").innerHTML =
      '<div style="color:#ff6b6b;padding:40px;font-family:monospace">Failed to load Leaflet. Check your internet connection.</div>';
  };
  document.head.appendChild(script);
})();

// ─── Rendering ─────────────────────────────────────────────────
function ratingInfo(r) {
  return RATINGS.find((x) => x.r === r);
}

function renderAllSegments() {
  // Clear existing
  Object.values(layerMap).forEach((l) => map.removeLayer(l));
  layerMap = {};

  segments.forEach((seg) => {
    const info = ratingInfo(seg.rating);
    if (!filterSet.has(seg.rating)) return;

    const line = L.polyline(seg.points, {
      color: info.color,
      weight: seg.id === activeSegmentId ? 10 : info.weight,
      opacity: 0.8,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    line.bindPopup(buildPopup(seg));
    line.on("click", () => selectSegment(seg.id));

    layerMap[seg.id] = line;
  });

  renderSidebar();
}

function buildPopup(seg) {
  const info = ratingInfo(seg.rating);
  return `
<div style="min-width:160px">
<div style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.95rem;margin-bottom:6px;color:${info.color}">
  ${info.emoji} ${seg.name || "Unnamed segment"}
</div>
<div style="color:#9ca3af;font-size:0.7rem;margin-bottom:4px;">${"★".repeat(seg.rating)}${"☆".repeat(5 - seg.rating)} · ${info.label}</div>
<div style="color:#6b7280;font-size:0.65rem;">${new Date(seg.created).toLocaleDateString()}</div>
<div style="margin-top:8px;display:flex;gap:6px">
  <button onclick="deleteSegment('${seg.id}')" style="background:none;border:1px solid #374151;border-radius:5px;padding:3px 8px;color:#9ca3af;font-size:0.65rem;cursor:pointer;font-family:'DM Mono',monospace">Delete</button>
</div>
</div>`;
}

function renderSidebar() {
  // Legend
  const legend = document.getElementById("legend");
  legend.innerHTML = "";
  RATINGS.forEach((info) => {
    const count = segments.filter((s) => s.rating === info.r).length;
    const filtered = !filterSet.has(info.r);
    legend.innerHTML += `
<div class="legend-item ${filtered ? "filtered" : ""}" onclick="toggleFilter(${info.r})" title="Click to toggle">
  <div class="legend-dot" style="background:${info.color}"></div>
  <div class="legend-stars">${"★".repeat(info.r)}</div>
  <div class="legend-label">${info.label}</div>
  <div class="count-badge">${count}</div>
</div>`;
  });

  // Stats
  document.getElementById("stat-total").textContent = segments.length;
  const avg = segments.length
    ? (segments.reduce((a, s) => a + s.rating, 0) / segments.length).toFixed(1)
    : "—";
  document.getElementById("stat-avg").textContent = avg;

  // Segments list
  const list = document.getElementById("segments-list");
  if (segments.length === 0) {
    list.innerHTML = `<div class="empty-state">No segments yet.<br>Switch to <strong>Edit</strong> mode to add your first road rating.</div>`;
    return;
  }

  list.innerHTML = "";
  [...segments].reverse().forEach((seg) => {
    const info = ratingInfo(seg.rating);
    const card = document.createElement("div");
    card.className = `segment-card ${seg.id === activeSegmentId ? "active" : ""}`;
    card.dataset.id = seg.id;
    card.innerHTML = `
<div class="seg-color-bar" style="background:${info.color}"></div>
<div class="seg-info">
  <div class="seg-name">${seg.name || "Unnamed segment"}</div>
  <div class="seg-meta">${"★".repeat(seg.rating)} · ${info.label}</div>
</div>
<button class="seg-delete" onclick="deleteSegment('${seg.id}', event)" title="Delete">✕</button>`;
    card.addEventListener("click", () => selectSegment(seg.id));
    list.appendChild(card);
  });
}

function selectSegment(id) {
  // Reset previous selection weight
  if (activeSegmentId && layerMap[activeSegmentId]) {
    const prevInfo = ratingInfo(
      segments.find((s) => s.id === activeSegmentId)?.rating,
    );
    if (prevInfo)
      layerMap[activeSegmentId].setStyle({ weight: prevInfo.weight });
  }

  activeSegmentId = id;
  const seg = segments.find((s) => s.id === id);
  if (!seg) return;

  // Thicken selected segment
  if (layerMap[id]) {
    layerMap[id].setStyle({ weight: 10 });
  }

  // Pan to center of segment
  const bounds = L.latLngBounds(seg.points);
  map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });

  // Open popup
  if (layerMap[id]) {
    layerMap[id].openPopup();
  }

  renderSidebar();
}

// ─── Filter ────────────────────────────────────────────────────
function toggleFilter(r) {
  if (filterSet.has(r)) filterSet.delete(r);
  else filterSet.add(r);
  renderAllSegments();
}

// ─── Mode ──────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById("btn-view").classList.toggle("active", m === "view");
  document.getElementById("btn-edit").classList.toggle("active", m === "edit");
  document.body.classList.toggle("edit-mode", m === "edit");

  if (m === "edit") {
    startEditSession();
    showSegmentHandles();
  } else {
    cancelEdit();
    hideSegmentHandles();
  }
}

// ─── Edit flow ─────────────────────────────────────────────────
function startEditSession() {
  drawingPoints = [];
  routedCoords = [];
  selectedRating = null;
  document.getElementById("edit-panel").classList.add("visible");
  document.getElementById("drawing-indicator").classList.add("visible");
  document.getElementById("edit-step1").style.display = "";
  document.getElementById("edit-step2").style.display = "none";
  document.getElementById("edit-step-label").textContent = "step 1 of 2";
  document.getElementById("seg-name-input").value = "";
  document.getElementById("btn-next-step").disabled = true;
  updateWaypointDots();
  renderStarPicker();
}

function cancelEdit() {
  clearDrawing();
  document.getElementById("edit-panel").classList.remove("visible");
  document.getElementById("drawing-indicator").classList.remove("visible");
}

function goToStep2() {
  document.getElementById("edit-step1").style.display = "none";
  document.getElementById("edit-step2").style.display = "";
  document.getElementById("edit-step-label").textContent = "step 2 of 2";
  document.getElementById("drawing-indicator").classList.remove("visible");
}

function goToStep1() {
  document.getElementById("edit-step1").style.display = "";
  document.getElementById("edit-step2").style.display = "none";
  document.getElementById("edit-step-label").textContent = "step 1 of 2";
  document.getElementById("drawing-indicator").classList.add("visible");
}

// routedCoords holds the full road-snapped coordinate list built up across all segments
let routedCoords = [];
let isRouting = false;

async function onMapClick(e) {
  if (mode !== "edit") return;
  if (document.getElementById("edit-step2").style.display !== "none") return;
  if (isRouting) return; // ignore clicks while a request is in flight

  const pt = [e.latlng.lat, e.latlng.lng];
  const prev = drawingPoints[drawingPoints.length - 1];
  drawingPoints.push(pt);

  // Waypoint dot marker
  const m = L.circleMarker(pt, {
    radius: 5,
    color: "#7efff5",
    weight: 2,
    fillColor: "#7efff5",
    fillOpacity: 0.9,
  }).addTo(map);
  tempMarkers.push(m);

  if (prev) {
    // Route from previous waypoint to this one via OSRM
    setRoutingBusy(true);
    try {
      const coords = await fetchOSRMRoute(prev, pt);
      // Append new coords (skip first point — it overlaps with end of previous segment)
      const toAppend = routedCoords.length === 0 ? coords : coords.slice(1);
      routedCoords = routedCoords.concat(toAppend);
    } catch (err) {
      console.warn("OSRM routing failed, falling back to straight line:", err);
      // Fallback: straight line between the two points
      if (routedCoords.length === 0) routedCoords.push(prev);
      routedCoords.push(pt);
    } finally {
      setRoutingBusy(false);
    }

    // Redraw preview polyline with routed coords
    if (tempPolyline) map.removeLayer(tempPolyline);
    tempPolyline = L.polyline(routedCoords, {
      color: "#7efff5",
      weight: 4,
      opacity: 0.75,
      dashArray: "8 4",
    }).addTo(map);
  } else {
    // First point — just seed routedCoords so the next segment has a start
    routedCoords = [pt];
  }

  document.getElementById("btn-next-step").disabled =
    drawingPoints.length < 2 || isRouting;
  updateWaypointDots();
}

async function fetchOSRMRoute(from, to) {
  // OSRM expects lon,lat order
  const url = `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== "Ok" || !data.routes.length)
    throw new Error("No route found");
  // GeoJSON coordinates are [lon, lat] — convert to [lat, lon] for Leaflet
  return data.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
}

function setRoutingBusy(busy) {
  isRouting = busy;
  const indicator = document.getElementById("drawing-indicator");
  indicator.textContent = busy
    ? "⏳ Snapping to road…"
    : "🛼 Click to place waypoints — min 2 required";
  document.getElementById("btn-next-step").disabled =
    busy || drawingPoints.length < 2;
}

function updateWaypointDots() {
  const c = document.getElementById("waypoint-counter");
  const n = Math.max(drawingPoints.length, 2);
  c.innerHTML = "";
  for (let i = 0; i < n; i++) {
    c.innerHTML += `<div class="wp-dot ${i < drawingPoints.length ? "placed" : ""}"></div>`;
  }
}

function clearDrawing() {
  drawingPoints = [];
  routedCoords = [];
  tempMarkers.forEach((m) => map.removeLayer(m));
  tempMarkers = [];
  if (tempPolyline) {
    map.removeLayer(tempPolyline);
    tempPolyline = null;
  }
}

// ─── Star picker ───────────────────────────────────────────────
function renderStarPicker() {
  const picker = document.getElementById("star-picker");
  picker.innerHTML = "";
  RATINGS.forEach((info) => {
    const el = document.createElement("div");
    el.className = `star-opt${selectedRating === info.r ? " selected" : ""}`;
    el.dataset.r = info.r;
    el.innerHTML = `
<span class="star-opt-icon">${info.emoji}</span>
<div>${"★".repeat(info.r)}</div>
<div class="star-opt-label">${info.label}</div>`;
    el.style.setProperty("--c", info.color);
    el.onclick = () => {
      selectedRating = info.r;
      renderStarPicker();
      checkSaveReady();
    };
    picker.appendChild(el);
  });
}

function checkSaveReady() {
  document.getElementById("btn-save").disabled = selectedRating === null;
}

// ─── Save ──────────────────────────────────────────────────────
function saveSegment() {
  if (!selectedRating || routedCoords.length < 2) return;

  const seg = {
    // id: crypto.randomUUID(), // commented out because it requires https or localhost
    id: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    }),
    name: document.getElementById("seg-name-input").value.trim(),
    rating: selectedRating,
    points: routedCoords.slice(), // road-snapped coordinates
    created: Date.now(),
  };

  segments.push(seg);
  saveSegments();
  clearDrawing();
  renderAllSegments();
  hideSegmentHandles();
  showSegmentHandles();
  startEditSession(); // ready for next segment
}

// ─── Segment handles (edit mode) ───────────────────────────────
function showSegmentHandles() {
  const handleIcon = L.divIcon({
    className: "",
    html: '<div style="width:12px;height:12px;background:#1e2229;border:2px solid #7efff5;border-radius:50%;cursor:grab;box-sizing:border-box"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
  segments.forEach((seg) => {
    const handles = {
      startMarker: null,
      endMarker: null,
      debounceTimer: null,
    };
    handles.startMarker = L.marker(seg.points[0], {
      draggable: true,
      icon: handleIcon,
    }).addTo(map);
    handles.endMarker = L.marker(seg.points[seg.points.length - 1], {
      draggable: true,
      icon: handleIcon,
    }).addTo(map);

    [handles.startMarker, handles.endMarker].forEach((marker) => {
      marker.on("drag", () => {
        clearTimeout(handles.debounceTimer);
        handles.debounceTimer = setTimeout(() => rerouteSegment(seg.id), 300);
      });
    });

    segmentHandles[seg.id] = handles;
  });
}

function hideSegmentHandles() {
  Object.values(segmentHandles).forEach(
    ({ startMarker, endMarker, debounceTimer }) => {
      clearTimeout(debounceTimer);
      map.removeLayer(startMarker);
      map.removeLayer(endMarker);
    },
  );
  segmentHandles = {};
}

async function rerouteSegment(id) {
  const seg = segments.find((s) => s.id === id);
  const handles = segmentHandles[id];
  if (!seg || !handles) return;

  const from = [
    handles.startMarker.getLatLng().lat,
    handles.startMarker.getLatLng().lng,
  ];
  const to = [
    handles.endMarker.getLatLng().lat,
    handles.endMarker.getLatLng().lng,
  ];

  try {
    seg.points = await fetchOSRMRoute(from, to);
  } catch {
    seg.points = [from, to];
  }

  saveSegments();
  if (layerMap[id]) layerMap[id].setLatLngs(seg.points);
}

// ─── Delete ────────────────────────────────────────────────────
function deleteSegment(id, e) {
  if (e) e.stopPropagation();
  if (!confirm("Delete this segment?")) return;
  segments = segments.filter((s) => s.id !== id);
  if (activeSegmentId === id) activeSegmentId = null;
  saveSegments();
  renderAllSegments();
  if (mode === "edit") {
    hideSegmentHandles();
    showSegmentHandles();
  }
  map.closePopup();
}

// ─── Location ──────────────────────────────────────────────────
function startLocationWatch(onError) {
  if (locationWatcher !== null) {
    if (locationMarker) map.setView(locationMarker.getLatLng(), 16);
    return;
  }
  let firstFix = true;
  locationWatcher = navigator.geolocation.watchPosition(
    (pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      if (!locationMarker) {
        locationMarker = L.circleMarker(latlng, {
          radius: 8,
          color: "#fff",
          weight: 2,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        locationMarker.setLatLng(latlng);
      }
      if (firstFix) {
        map.setView(latlng, 14);
        firstFix = false;
      }
    },
    onError,
    { enableHighAccuracy: true },
  );
}

function centerOnMe() {
  startLocationWatch((err) =>
    alert(`Could not get location: ${err.message} (code ${err.code})`),
  );
}

// ─── Persist ───────────────────────────────────────────────────
function saveSegments() {
  localStorage.setItem("skatemap_segments", JSON.stringify(segments));
}

function loadSegments() {
  try {
    return JSON.parse(localStorage.getItem("skatemap_segments")) || [];
  } catch {
    return [];
  }
}

// ─── Init ──────────────────────────────────────────────────────
function init() {
  renderAllSegments();
  startLocationWatch(() => {});
}
