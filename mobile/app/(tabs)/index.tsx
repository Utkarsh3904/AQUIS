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
import { useRouter } from "expo-router";
import { useStations, useFleetAlerts } from "../../lib/hooks";
import { fetchStationFacts, fetchForecast } from "../../lib/api";
import { colors, typography } from "../../theme/colors";
import { spacing, radii, elevation } from "../../theme/spacing";
import StationDetailSheet from "../../components/StationDetailSheet";
import type { StationListItem } from "../../types/station";
import type { StationDetailResponse } from "../../types/api";
import type { ForecastResponse } from "../../types/forecast";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const UP_REGION = {
  latitude: 26.85,
  longitude: 80.91,
  latitudeDelta: 4.2,
  longitudeDelta: 4.2,
};

let MapViewComp: any = null;
let MarkerComp: any = null;
let GeojsonComp: any = null;
let PROVIDER_GOOGLE: any = null;

export default function MapHomeScreen() {
  const router = useRouter();
  const { data: stations, loading } = useStations();
  const { data: fleetAlertsData } = useFleetAlerts(2000);

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [stationDetail, setStationDetail] = useState<StationDetailResponse | null>(null);
  const [stationForecast, setStationForecast] = useState<ForecastResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "safe" | "caution">("all");

  const sheetY = useRef(new Animated.Value(SCREEN_H)).current;
  const sheetVisible = useRef(false);

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

  useEffect(() => {
    try {
      const maps = require("react-native-maps");
      MapViewComp = maps.default;
      MarkerComp = maps.Marker;
      GeojsonComp = maps.Geojson;
      PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
      setMapReady(true);
    } catch {
      setMapReady(true);
    }
  }, []);

  // Map slug -> zone ("safe", "watch", "alert", "danger") from fleet alerts
  const stationZoneMap = useMemo(() => {
    const map = new Map<string, string>();
    if (fleetAlertsData?.alerts) {
      for (const a of fleetAlertsData.alerts) {
        if (a.slug) {
          map.set(a.slug, a.zone);
        }
      }
    }
    return map;
  }, [fleetAlertsData]);

  // Counts computed from real fleet/alerts response
  const stationCounts = useMemo(() => {
    const total = stations.length;
    let safe = 0;
    let caution = 0;
    for (const s of stations) {
      const z = s.slug ? stationZoneMap.get(s.slug) : "safe";
      if (z === "watch" || z === "alert" || z === "danger") {
        caution++;
      } else {
        safe++;
      }
    }
    return { total, safe, caution };
  }, [stations, stationZoneMap]);

  const handleStationTap = useCallback(
    async (slug: string) => {
      setSelectedSlug(slug);
      setLoadingDetail(true);
      showSheet();
      try {
        const [detail, fc] = await Promise.allSettled([
          fetchStationFacts(slug),
          fetchForecast(slug),
        ]);
        if (detail.status === "fulfilled") setStationDetail(detail.value);
        if (fc.status === "fulfilled") setStationForecast(fc.value);
      } catch {}
      setLoadingDetail(false);
    },
    [showSheet]
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

  const hasCoords = stations.some((s) => s.lat !== 0 || s.lon !== 0);
  const showMap = mapReady && MapViewComp && hasCoords;

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
        {showMap ? (
          <MapViewComp
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={UP_REGION}
            showsUserLocation={false}
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}
            scrollEnabled={true}
            zoomEnabled={true}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {/* Real District Boundary Outlines */}
            {GeojsonComp && (
              <GeojsonComp
                geojson={require("../../assets/geo/up-districts.geojson")}
                strokeColor="rgba(2, 132, 199, 0.35)"
                strokeWidth={1.2}
                fillColor="rgba(2, 132, 199, 0.02)"
              />
            )}

            {stationsWithCoords.map((s) => {
              const isSelected = selectedSlug === s.slug;
              const zone = s.slug ? stationZoneMap.get(s.slug) : null;
              
              let pinColor = "#94A3B8"; // neutral gray
              if (zone === "safe") pinColor = colors.positive;
              else if (zone === "watch") pinColor = colors.warning;
              else if (zone === "alert" || zone === "danger") pinColor = colors.negative;
              else if (!zone && s.slug) pinColor = colors.positive; // default safe if missing

              return (
                <MarkerComp
                  key={s.slug ?? `m-${s.id}`}
                  coordinate={{ latitude: s.lat, longitude: s.lon }}
                  onPress={() => s.slug && handleStationTap(s.slug)}
                  onCalloutPress={() => s.slug && handleStationTap(s.slug)}
                  tracksViewChanges={false}
                >
                  {isSelected ? (
                    <View style={styles.activeMarkerContainer}>
                      <View style={styles.activeMarkerLabel}>
                        <Text style={styles.activeMarkerLabelText}>
                          {s.district} • {s.station}
                        </Text>
                      </View>
                      <View style={styles.activeMarkerPulseOuter}>
                        <View style={styles.activeMarkerPulseInner}>
                          <Text style={styles.activeMarkerDrop}>💧</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.inactiveMarker, { borderColor: pinColor }]}>
                      <View style={[styles.inactiveMarkerDot, { backgroundColor: pinColor }]} />
                    </View>
                  )}
                </MarkerComp>
              );
            })}
          </MapViewComp>
        ) : (
          <View style={styles.mapFallback}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.mapFallbackText}>
              {loading ? "Loading stations..." : "Initializing map..."}
            </Text>
          </View>
        )}
      </View>

      {/* Header overlay */}
      <View style={styles.header}>
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
    ...StyleSheet.absoluteFillObject,
  },
  mapFallback: {
    flex: 1,
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
  activeMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  activeMarkerLabel: {
    backgroundColor: "#0F172A",
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activeMarkerLabelText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  activeMarkerPulseOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(2, 132, 199, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.4)",
  },
  activeMarkerPulseInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  activeMarkerDrop: {
    fontSize: 11,
    color: "#FFFFFF",
  },
  inactiveMarker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
    elevation: 2,
  },
  inactiveMarkerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
