// Bridge module for native map — only imported on native, never on web.
// Platform extensions ensure Metro resolves map-bridge.web.tsx on web.
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useStations } from "../../lib/hooks";
import { getStationPinColor, UP_REGION } from "../../lib/mapUtils";
import { colors, typography } from "../../theme/colors";
import { spacing, radii } from "../../theme/spacing";

let MapViewComp = null;
let MarkerComp = null;
let PROVIDER_DEFAULT = null;

export default function NativeMapScreen() {
  const router = useRouter();
  const { data: stations } = useStations();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const maps = require("react-native-maps");
      MapViewComp = maps.default;
      MarkerComp = maps.Marker;
      PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
      setReady(true);
    } catch (e) {
      console.warn("react-native-maps not available:", e);
      setReady(true);
    }
  }, []);

  const hasCoords = stations.some((s) => s.lat !== 0 || s.lon !== 0);

  const getCoord = useCallback((s) => ({ latitude: s.lat, longitude: s.lon }), []);

  if (!ready || !MapViewComp) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!hasCoords) {
    return (
      <View style={styles.pendingContainer}>
        <View style={styles.pendingCard}>
          <Text style={styles.pendingIcon}>📍</Text>
          <Text style={styles.pendingTitle}>Map data pending</Text>
          <Text style={styles.pendingBody}>
            Lat/lon coordinates will be added to the station list endpoint by the ML team.
          </Text>
          <Text style={styles.pendingCount}>{stations.length} stations loaded</Text>
        </View>
      </View>
    );
  }

  return (
    <MapViewComp
      style={styles.map}
      provider={PROVIDER_DEFAULT}
      initialRegion={{ ...UP_REGION, latitudeDelta: 2.0, longitudeDelta: 2.0 }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      onMapReady={() => setReady(true)}
    >
      {stations.map((station) => (
        <MarkerComp
          key={String(station.id ?? station.slug)}
          coordinate={getCoord(station)}
          title={station.station}
          description={station.district}
          pinColor={getStationPinColor(station)}
          onCalloutPress={() => {
            const param = station.slug ?? String(station.id);
            router.push(`/station/${param}`);
          }}
        />
      ))}
    </MapViewComp>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  pendingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  pendingCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    maxWidth: 320,
  },
  pendingIcon: { fontSize: 36 },
  pendingTitle: {
    ...typography.subheading,
    color: colors.textPrimary,
  },
  pendingBody: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  pendingCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
