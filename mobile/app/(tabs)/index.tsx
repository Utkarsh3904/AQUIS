import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Dimensions,
  Animated,
  PanResponder,
  ActivityIndicator,
} from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { useStations, useFleetAlerts } from "../../lib/hooks";
import { fetchStationFacts, fetchForecast } from "../../lib/api";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, elevation } from "../../theme/spacing";
import StationDetailSheet from "../../components/StationDetailSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StationDetailResponse } from "../../types/api";
import type { ForecastResponse } from "../../types/forecast";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const LEAFLET_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>AQUIS Map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; }
  .leaflet-control-attribution { font-size: 9px !important; }
  .station-marker {
    width: 14px; height: 14px; border-radius: 50%;
    background: #fff; border: 2.5px solid #94A3B8;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    display: flex; align-items: center; justify-content: center;
  }
  .station-marker .dot { width: 6px; height: 6px; border-radius: 50%; }
  .error-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: #E8F0FE; display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 9999;
    font-family: -apple-system, sans-serif;
  }
  .error-overlay.hidden { display: none; }
  .error-overlay p { color: #64748B; font-size: 14px; margin-top: 12px; }
  .error-overlay .icon { font-size: 48px; }
</style>
</head>
<body>
<div id="map"></div>
<div id="error-overlay" class="error-overlay">
  <div class="icon">🗺️</div>
  <p>Map tiles failed to load — check connection</p>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script>
(function() {
  var map, mcg, geojsonLayer = null, tilesLoaded = false;

  function postMsg(obj) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
  }

  function zoneColor(zone) {
    if (zone === 'safe') return '#16A34A';
    if (zone === 'watch') return '#F59E0B';
    if (zone === 'alert' || zone === 'danger') return '#DC2626';
    return '#94A3B8';
  }

  function makeIcon(color) {
    return L.divIcon({
      className: '',
      html: '<div class="station-marker"><div class="dot" style="background:' + color + '"></div></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
  }

  function init() {
    map = L.map('map', { center: [26.8467, 80.9462], zoom: 6.5, zoomControl: false, attributionControl: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19
    }).on('load', function() {
      tilesLoaded = true;
      document.getElementById('error-overlay').classList.add('hidden');
      postMsg({ type: 'mapReady' });
    }).on('error', function() {
      if (!tilesLoaded) document.getElementById('error-overlay').classList.remove('hidden');
    }).addTo(map);

    mcg = L.markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true, showCoverageOnHover: false, disableClusteringAtZoom: 15 });
    map.addLayer(mcg);

    setTimeout(function() { if (!tilesLoaded) { document.getElementById('error-overlay').classList.remove('hidden'); postMsg({ type: 'mapReady' }); } }, 8000);
  }

  window.setStations = function(stationsJson, zoneMapJson) {
    if (!map || !mcg) return;
    var stations = typeof stationsJson === 'string' ? JSON.parse(stationsJson) : stationsJson;
    var zoneMap = typeof zoneMapJson === 'string' ? JSON.parse(zoneMapJson) : (zoneMapJson || {});
    if (!Array.isArray(stations) || stations.length === 0) return;
    mcg.clearLayers();
    var added = 0;
    for (var i = 0; i < stations.length; i++) {
      var s = stations[i];
      var lat = s.lat || s.latitude;
      var lon = s.lon || s.longitude;
      if (!lat || !lon || (lat === 0 && lon === 0)) continue;
      var slug = s.slug || '';
      var color = zoneColor(zoneMap[slug] || '');
      var m = L.marker([lat, lon], { icon: makeIcon(color) });
      (function(sl, st, di) {
        m.on('click', function() { postMsg({ type: 'markerClick', slug: sl, station: st, district: di }); });
      })(slug, s.station || '', s.district || '');
      mcg.addLayer(m);
      added++;
    }
    postMsg({ type: 'stationsRendered', count: added });
  };

  window.setGeojson = function(gj) {
    if (!map) return;
    var geojson = typeof gj === 'string' ? JSON.parse(gj) : gj;
    if (!geojson) return;
    if (geojsonLayer) { map.removeLayer(geojsonLayer); geojsonLayer = null; }
    geojsonLayer = L.geoJSON(geojson, { style: { color: 'rgba(2,132,199,0.35)', weight: 1.2, fillColor: 'rgba(2,132,199,0.02)', fillOpacity: 0.02 } }).addTo(map);
  };

  init();
})();
</script>
</body>
</html>`;

export default function MapHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: stations, loading: stationsLoading, error: stationsError } = useStations();
  const { data: fleetAlertsData, loading: fleetLoading, error: fleetError } = useFleetAlerts(2000);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [stationDetail, setStationDetail] = useState<StationDetailResponse | null>(null);
  const [stationForecast, setStationForecast] = useState<ForecastResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mapWebViewReady, setMapWebViewReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "safe" | "caution">("all");

  const webviewRef = useRef<WebView>(null);
  const sheetY = useRef(new Animated.Value(SCREEN_H)).current;
  const sheetVisible = useRef(false);

  useEffect(() => {
    console.log("[MapHome] STATE — stations:", stations.length, "loading:", stationsLoading, "error:", stationsError ? JSON.stringify(stationsError) : "none");
    console.log("[MapHome] STATE — fleetAlerts:", fleetAlertsData?.count ?? "null", "loading:", fleetLoading, "error:", fleetError ? JSON.stringify(fleetError) : "none");
    console.log("[MapHome] STATE — mapWebViewReady:", mapWebViewReady);
    if (stations.length > 0) {
      const withCoords = stations.filter((s) => s.lat !== 0 && s.lon !== 0);
      console.log("[MapHome] STATE — stations with coords:", withCoords.length, "of", stations.length);
      console.log("[MapHome] STATE — first station:", JSON.stringify(stations[0]));
    }
  }, [stations, stationsLoading, stationsError, fleetAlertsData, fleetLoading, fleetError, mapWebViewReady]);

  const showSheet = useCallback(() => {
    sheetVisible.current = true;
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [sheetY]);

  const hideSheet = useCallback(() => {
    Animated.spring(sheetY, {
      toValue: SCREEN_H,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start(() => {
      sheetVisible.current = false;
      setSelectedSlug(null);
      setStationDetail(null);
      setStationForecast(null);
    });
  }, [sheetY]);

  const stationZoneMap = useMemo(() => {
    const map = new Map<string, string>();
    if (fleetAlertsData?.alerts) {
      for (const a of fleetAlertsData.alerts) {
        if (a.slug) map.set(a.slug, a.zone);
      }
    }
    return map;
  }, [fleetAlertsData]);

  const stationCounts = useMemo(() => {
    const total = stations.length;
    let safe = 0;
    let caution = 0;
    for (const s of stations) {
      const z = s.slug ? stationZoneMap.get(s.slug) : "safe";
      if (z === "watch" || z === "alert" || z === "danger") caution++;
      else safe++;
    }
    return { total, safe, caution };
  }, [stations, stationZoneMap]);

  const handleStationTap = useCallback(
    async (slug: string) => {
      console.log("[MapHome] handleStationTap — slug:", JSON.stringify(slug), "type:", typeof slug);
      const matchedStation = stations.find((s) => s.slug === slug);
      console.log("[MapHome] handleStationTap — matchedStation:", matchedStation ? JSON.stringify({ slug: matchedStation.slug, station: matchedStation.station, district: matchedStation.district }) : "NOT FOUND");

      setSelectedSlug(slug);
      setLoadingDetail(true);
      showSheet();
      try {
        console.log("[MapHome] fetchStationFacts calling:", `/stations/${slug}`);
        const [detail, fc] = await Promise.allSettled([
          fetchStationFacts(slug),
          fetchForecast(slug),
        ]);
        console.log("[MapHome] fetchStationFacts result:", detail.status, detail.status === "fulfilled" ? JSON.stringify({ slug: detail.value.slug, station: detail.value.station }).substring(0, 100) : JSON.stringify(detail.reason));
        console.log("[MapHome] fetchForecast result:", fc.status, fc.status === "fulfilled" ? "ok" : JSON.stringify(fc.reason));
        if (detail.status === "fulfilled") setStationDetail(detail.value);
        if (fc.status === "fulfilled") setStationForecast(fc.value);
      } catch (e: any) {
        console.error("[MapHome] handleStationTap catch:", e?.message || e);
      }
      setLoadingDetail(false);
    },
    [showSheet, stations]
  );

  const filteredStations = useMemo(() => {
    let list = stations;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.station.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          (s.slug ?? "").toLowerCase().includes(q)
      );
    }
    if (activeFilter === "caution") {
      list = list.filter((s) => {
        const z = s.slug ? stationZoneMap.get(s.slug) : "safe";
        return z === "watch" || z === "alert" || z === "danger";
      });
    } else if (activeFilter === "safe") {
      list = list.filter((s) => {
        const z = s.slug ? stationZoneMap.get(s.slug) : "safe";
        return z !== "watch" && z !== "alert" && z !== "danger";
      });
    }
    return list;
  }, [stations, searchQuery, activeFilter, stationZoneMap]);

  const stationsWithCoords = useMemo(
    () => filteredStations.filter((s) => s.lat !== 0 && s.lon !== 0),
    [filteredStations]
  );

  const mapFallbackMessage = useMemo(() => {
    if (stationsError) return `Station fetch failed (${stationsError.status}): ${stationsError.body?.error || "check console"}`;
    if (fleetError) return `Fleet alerts failed (${fleetError.status}): ${fleetError.body?.error || "check console"}`;
    if (stationsLoading) return "Loading stations from API...";
    if (stations.length === 0) return "No stations returned from API.";
    return "Initializing map...";
  }, [stationsError, fleetError, stationsLoading, stations.length]);

  const zoneMapObj = useMemo(() => {
    const obj: Record<string, string> = {};
    stationZoneMap.forEach((v, k) => { obj[k] = v; });
    return obj;
  }, [stationZoneMap]);

  const geojsonRef = useRef<any>(null);
  if (!geojsonRef.current) {
    try {
      geojsonRef.current = require("../../assets/geo/up-districts.json");
    } catch (e) {
      console.error("[MapHome] geojson import failed:", e);
    }
  }

  const injectMapData = useCallback(() => {
    if (!webviewRef.current) return;
    if (stationsWithCoords.length === 0) {
      console.log("[MapHome] SKIP inject — no stations with coords");
      return;
    }
    const stationPayload = stationsWithCoords.map((s) => ({
      slug: s.slug,
      station: s.station,
      district: s.district,
      lat: s.lat,
      lon: s.lon,
    }));
    console.log("[MapHome] INJECT —", stationPayload.length, "stations, first 3 slugs:", stationPayload.slice(0, 3).map((s) => s.slug));
    const js = `window.setStations(${JSON.stringify(stationPayload)}, ${JSON.stringify(zoneMapObj)}); true;`;
    console.log("[MapHome] INJECT stations:", stationPayload.length);
    webviewRef.current.injectJavaScript(js);

    if (geojsonRef.current) {
      const geoJs = `window.setGeojson(${JSON.stringify(geojsonRef.current)}); true;`;
      console.log("[MapHome] INJECT geojson");
      webviewRef.current.injectJavaScript(geoJs);
    }
  }, [stationsWithCoords, zoneMapObj]);

  useEffect(() => {
    if (mapWebViewReady) {
      injectMapData();
    }
  }, [mapWebViewReady, injectMapData]);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const raw = event.nativeEvent.data;
      console.log("[MapHome] WebView message raw:", typeof raw, raw?.substring?.(0, 200));
      const data = JSON.parse(raw);
      console.log("[MapHome] WebView message parsed:", JSON.stringify(data));
      if (data.type === "mapReady") {
        console.log("[MapHome] WebView mapReady received");
        setMapWebViewReady(true);
      } else if (data.type === "markerClick" && data.slug) {
        console.log("[MapHome] markerClick — slug:", JSON.stringify(data.slug), "station:", data.station, "district:", data.district);
        handleStationTap(data.slug);
      } else if (data.type === "stationsRendered") {
        console.log("[MapHome] stationsRendered:", data.count);
      }
    } catch (e) {
      console.error("[MapHome] WebView message parse error:", e);
    }
  }, [handleStationTap]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (sheetVisible.current && g.dy > 0) {
          sheetY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120) {
          hideSheet();
        } else {
          Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 20,
            stiffness: 200,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Map background */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          source={{ html: LEAFLET_HTML, baseUrl: "" }}
          style={styles.map}
          originWhitelist={["*"]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadEnd={() => console.log("[MapHome] WebView onLoadEnd")}
          onError={(e) => console.error("[MapHome] WebView onError:", e.nativeEvent)}
          onHttpError={(e) => console.error("[MapHome] WebView onHttpError:", e.nativeEvent.statusCode)}
          onMessage={handleWebViewMessage}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.mapFallback}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.mapFallbackText}>{mapFallbackMessage}</Text>
            </View>
          )}
        />
      </View>

      {/* Header overlay */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerLeft}>
          <View style={styles.logoAndBrand}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>💧</Text>
            </View>
            <Text style={styles.brandText}>AQUIS</Text>
          </View>
          <View style={styles.basinInfo}>
            <View style={styles.basinDot} />
            <Text style={styles.basinText}>UTTAR PRADESH • GWL</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Text style={styles.headerIcon}>📡</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn}>
            <Text style={styles.avatarIcon}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search station or district..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.searchAction}>
            <Text style={styles.searchTargetIcon}>◎</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.chipsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
          <TouchableOpacity
            style={[styles.chip, activeFilter === "all" && styles.chipActive]}
            onPress={() => setActiveFilter("all")}
          >
            <Text style={[styles.chipIcon, activeFilter === "all" && styles.chipTextActive]}>💧</Text>
            <Text style={[styles.chipText, activeFilter === "all" && styles.chipTextActive, { fontWeight: "bold" }]}>
              DWLR Wells ({stationCounts.total})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, activeFilter === "safe" && styles.chipActiveSafeBorder]}
            onPress={() => setActiveFilter("safe")}
          >
            <View style={[styles.chipDot, { backgroundColor: colors.positive }]} />
            <Text style={styles.chipText}>Safe / Nominal</Text>
            <View style={styles.chipCount}>
              <Text style={styles.chipCountText}>{stationCounts.safe}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chip, activeFilter === "caution" && styles.chipActiveCautionBorder]}
            onPress={() => setActiveFilter("caution")}
          >
            <View style={[styles.chipDot, { backgroundColor: colors.warning }]} />
            <Text style={styles.chipText}>Caution</Text>
            <View style={styles.chipCount}>
              <Text style={styles.chipCountText}>{stationCounts.caution}</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Station Detail Bottom Sheet */}
      {selectedSlug && (
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: sheetY }] },
          ]}
          {...panResponder.panHandlers}
        >
          {loadingDetail && !stationDetail ? (
            <View style={styles.sheetLoading}>
              <View style={styles.handle} />
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.sheetLoadingText}>Loading station data...</Text>
            </View>
          ) : stationDetail ? (
            <StationDetailSheet
              station={stationDetail}
              forecast={stationForecast}
              onClose={hideSheet}
              onMoreInfo={() => {
                hideSheet();
                if (selectedSlug) router.push(`/station/${selectedSlug}`);
              }}
            />
          ) : (
            <View style={styles.sheetLoading}>
              <View style={styles.handle} />
              <Text style={styles.sheetLoadingText}>Station data unavailable</Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#E8F0FE",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
  },
  mapFallbackText: {
    ...typography.body,
    color: colors.textMuted,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: "rgba(255,255,255,0.92)",
    ...elevation.low,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logoAndBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  brandText: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
    letterSpacing: 0.5,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  logoIcon: {
    fontSize: 16,
  },
  basinInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  basinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.positive,
  },
  basinText: {
    ...typography.labelSm,
    color: colors.textPrimary,
    fontWeight: "600",
    letterSpacing: 0.04,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
  },
  headerIcon: {
    fontSize: 16,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarIcon: {
    fontSize: 16,
  },
  searchContainer: {
    position: "absolute",
    top: 108,
    left: spacing.lg,
    right: spacing.lg,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    ...elevation.medium,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },
  searchAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
  },
  searchTargetIcon: {
    fontSize: 16,
    color: colors.primary,
  },
  chipsContainer: {
    position: "absolute",
    top: 164,
    left: 0,
    right: 0,
  },
  chipsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...elevation.low,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipActiveSafeBorder: {
    borderColor: colors.positive,
  },
  chipActiveCautionBorder: {
    borderColor: colors.warning,
  },
  chipIcon: {
    fontSize: 12,
    color: colors.primary,
  },
  chipTextActive: {
    color: colors.onPrimary,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chipCount: {
    backgroundColor: "#F1F5F9",
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  chipCountText: {
    fontSize: 10,
    fontWeight: "bold",
    color: colors.textSecondary,
  },
  sheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  sheetLoading: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    ...elevation.high,
  },
  sheetLoadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
});
