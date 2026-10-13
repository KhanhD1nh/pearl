import { router, Stack } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { C, Icon, TxRow } from '@/components/ui';
import { useWallet } from '@/lib/wallet';

export default function Activity() {
  const { txs, loading, load } = useWallet();
  return (
    <>
      <Stack.Screen options={{ title: 'Hoạt động' }} />
      <FlatList
        style={{ backgroundColor: C.bg }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16 }}
        data={txs ?? []}
        keyExtractor={(t, i) => t.txid + i}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.accent} />}
        ListHeaderComponent={<Text style={{ color: C.label, fontSize: 34, fontWeight: '700', paddingBottom: 16, paddingTop: 8 }}>Hoạt động</Text>}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingTop: 80, gap: 10 }}>
            <Icon name="clock" size={40} color={C.tertiary} />
            <Text style={{ color: C.label, fontSize: 20, fontWeight: '600' }}>{txs === undefined ? 'Đang tải…' : 'Chưa có giao dịch'}</Text>
            {txs !== undefined && <Text style={{ color: C.secondary, fontSize: 15 }}>Giao dịch gửi và nhận sẽ hiện ở đây.</Text>}
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{
            backgroundColor: C.group, overflow: 'hidden',
            borderTopLeftRadius: index === 0 ? 12 : 0, borderTopRightRadius: index === 0 ? 12 : 0,
            borderBottomLeftRadius: index === (txs?.length ?? 0) - 1 ? 12 : 0, borderBottomRightRadius: index === (txs?.length ?? 0) - 1 ? 12 : 0,
          }}>
            {index > 0 && <View style={{ height: 0.5, backgroundColor: C.separator, marginLeft: 66 }} />}
            <TxRow amount={item.amount} time={item.time} confirmations={item.confirmations} onPress={() => router.push({ pathname: '/tx/[id]', params: { id: item.txid } })} />
          </View>
        )}
      />
    </>
  );
}
