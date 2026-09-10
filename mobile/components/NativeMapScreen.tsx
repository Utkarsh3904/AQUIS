// Bridge module for native map — only imported on native, never on web.
// Platform extensions ensure Metro resolves map-bridge.web.tsx on web.
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useStations } from "../../lib/hooks";
import { getStationPinColor, UP_REGION } from "../../lib/mapUtils";
import { colors, typography } from "../../theme/colors";
import { spacing } from "../../theme/spacing";

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

  const getCoord = useCallback((s) => ({ latitude: s.lat, longitude: s.lon }), []);

  if (!ready || !MapViewComp) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          key={String(station.id)}
          coordinate={getCoord(station)}
          title={station.station}
          description={`${station.district} • ${station.source}`}
          pinColor={getStationPinColor(station)}
          onCalloutPress={() => router.push(`/station/${station.id}`)}
        />
      ))}
    </MapViewComp>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
