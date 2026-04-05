import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { deliveryPricing } from '../constants/config';

export default function RestaurantDeliveryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 16 }}
      >
        {/* Delivery fee explanation */}
        <View style={styles.feeCard}>
          <View style={styles.feeCardHeader}>
            <MaterialIcons name="delivery-dining" size={24} color={theme.primary} />
            <Text style={styles.feeCardTitle}>Delivery Fee Pricing</Text>
          </View>
          <Text style={styles.feeCardText}>
            Delivery fees are automatically calculated based on the distance between your restaurant and the customer using our smart routing system.
          </Text>
          <View style={styles.formulaRow}>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaLabel}>Base Fee</Text>
              <Text style={styles.formulaValue}>{"\u20A6"}{deliveryPricing.baseFee}</Text>
            </View>
            <Text style={styles.formulaOp}>+</Text>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaLabel}>Per km</Text>
              <Text style={styles.formulaValue}>{"\u20A6"}{deliveryPricing.perKmRate}</Text>
            </View>
            <Text style={styles.formulaOp}>=</Text>
            <View style={styles.formulaItem}>
              <Text style={styles.formulaLabel}>Max</Text>
              <Text style={styles.formulaValue}>{"\u20A6"}{deliveryPricing.maxFee}</Text>
            </View>
          </View>
        </View>

        {/* Delivery time explanation */}
        <View style={styles.infoCard}>
          <MaterialIcons name="access-time" size={22} color="#3B82F6" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Delivery Time</Text>
            <Text style={styles.infoText}>
              Delivery time is calculated dynamically for each customer based on their distance from your restaurant. Customers see an accurate estimate powered by our AI-based routing engine.
            </Text>
          </View>
        </View>

        {/* Coverage info */}
        <View style={styles.coverageCard}>
          <MaterialIcons name="map" size={20} color="#999" />
          <View style={{ flex: 1 }}>
            <Text style={styles.coverageTitle}>Delivery Coverage</Text>
            <Text style={styles.coverageText}>
              Delivery availability is determined automatically based on your restaurant location and available riders in the network. No manual radius setup is needed.
            </Text>
          </View>
        </View>

        {/* How it works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How It Works</Text>
          <View style={styles.step}>
            <View style={styles.stepDot}><Text style={styles.stepNum}>1</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Customer places an order</Text>
              <Text style={styles.stepDesc}>Their GPS location is captured automatically</Text>
            </View>
          </View>
          <View style={styles.step}>
            <View style={styles.stepDot}><Text style={styles.stepNum}>2</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Distance is calculated</Text>
              <Text style={styles.stepDesc}>Our backend computes the optimal route between your restaurant and the customer</Text>
            </View>
          </View>
          <View style={styles.step}>
            <View style={styles.stepDot}><Text style={styles.stepNum}>3</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Fee and time are determined</Text>
              <Text style={styles.stepDesc}>Delivery fee and estimated time are shown to the customer at checkout</Text>
            </View>
          </View>
          <View style={styles.step}>
            <View style={styles.stepDot}><Text style={styles.stepNum}>4</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>Rider assigned automatically</Text>
              <Text style={styles.stepDesc}>An available rider is dispatched and tracked in real-time</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  feeCard: { marginHorizontal: 16, padding: 20, borderRadius: 16, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 16 },
  feeCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  feeCardTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  feeCardText: { fontSize: 14, color: '#999', lineHeight: 20, marginBottom: 16 },
  formulaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  formulaItem: { alignItems: 'center', backgroundColor: '#2A2A2A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  formulaLabel: { fontSize: 10, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  formulaValue: { fontSize: 18, fontWeight: '700', color: theme.primary },
  formulaOp: { fontSize: 18, fontWeight: '600', color: '#666' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginHorizontal: 16, padding: 18, borderRadius: 16, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  infoText: { fontSize: 14, color: '#999', lineHeight: 20 },
  coverageCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, padding: 16, borderRadius: 14, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A', marginBottom: 24 },
  coverageTitle: { fontSize: 15, fontWeight: '600', color: '#FFF', marginBottom: 4 },
  coverageText: { fontSize: 13, color: '#999', lineHeight: 19 },
  howItWorks: { marginHorizontal: 16, padding: 20, borderRadius: 16, backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  howTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  stepDesc: { fontSize: 13, color: '#999', marginTop: 2, lineHeight: 18 },
});
