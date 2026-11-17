import { useState } from 'react';
import { Text, View } from 'react-native';
import { fmtStock, stockInfo } from '../lib/dose';
import { useApp } from '../lib/store';
import { C } from '../theme';
import { Btn, Card } from './ui';

/** Aviso en "Hoy" cuando quedan pocas unidades de algún medicamento, con botones para sumar una caja nueva. */
export function StockAlerts() {
  const { state, role, addStock } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const family = role === 'caregiver';
  const who = state.settings.patientName || 'Tu familiar';
  const low = state.meds.map((m) => ({ m, info: stockInfo(m) })).filter((x) => x.info?.low);
  if (!low.length) return null;
  return (
    <>
      {low.map(({ m, info }) => (
        <Card key={m.id} style={{ backgroundColor: C.warnSoft, gap: 8 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: C.fg }}>
            {info!.out ? `Se acabó ${m.name}` : `Quedan ${fmtStock(info!.stock)} ${info!.unit} de ${m.name}`}
          </Text>
          <Text style={{ color: C.fg }}>
            {info!.out
              ? 'Hay que comprar más para no saltarse ninguna toma.'
              : `Alcanzan para unos ${Math.max(1, Math.floor(info!.daysLeft))} días. ${family ? `Conviene comprar más para ${who}.` : 'Conviene comprar más.'}`}
          </Text>
          {open === m.id ? (
            <>
              <Text style={{ color: C.fg, fontWeight: '700' }}>¿Cuántas {m.type === 'liquid' ? m.qtyUnit ?? 'ml' : 'pastillas'} trae la caja nueva?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[10, 20, 30].map((n) => (
                  <View key={n} style={{ flex: 1 }}>
                    <Btn
                      small
                      title={`+${n}`}
                      onPress={() => {
                        addStock(m.id, n);
                        setOpen(null);
                      }}
                    />
                  </View>
                ))}
              </View>
              <Text style={{ color: C.muted, fontSize: 13 }}>¿Otra cantidad? Edítala en Medicinas → {m.name}.</Text>
            </>
          ) : (
            <Btn kind="ok" small title="Compré más" onPress={() => setOpen(m.id)} />
          )}
        </Card>
      ))}
    </>
  );
}
