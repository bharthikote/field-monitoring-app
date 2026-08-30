import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDateString(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function ChevronLeft({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}
function ChevronRight({ color }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

// A small pure-JS month-grid calendar - no native module, unlike
// @react-native-community/datetimepicker, whose Android build needs a
// codegen'd native spec file that isn't generated under Expo Go's managed
// workflow (crashed Metro on import). value/onChange stay plain YYYY-MM-DD
// strings, same as before, so callers didn't need to change.
export default function DatePickerField({ label, value, onChange }) {
  const today = new Date();
  const initial = value ? new Date(`${value}T00:00:00`) : today;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const handleOpen = () => {
    const base = value ? new Date(`${value}T00:00:00`) : today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setOpen(true);
  };

  const changeMonth = (delta) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const handleSelectDay = (day) => {
    onChange(toDateString(viewYear, viewMonth, day));
    setOpen(false);
  };

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const todayString = toDateString(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={handleOpen}>
        <Text style={value ? styles.fieldText : styles.placeholderText}>{value || '-- select date --'}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.monthRow}>
              <Pressable style={styles.monthNavBtn} onPress={() => changeMonth(-1)}>
                <ChevronLeft color={COLORS.primary} />
              </Pressable>
              <Text style={styles.monthLabel}>{MONTH_LABELS[viewMonth]} {viewYear}</Text>
              <Pressable style={styles.monthNavBtn} onPress={() => changeMonth(1)}>
                <ChevronRight color={COLORS.primary} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAY_LABELS.map((w) => (
                <Text key={w} style={styles.weekdayText}>{w}</Text>
              ))}
            </View>

            {weeks.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((day, di) => {
                  if (!day) return <View key={di} style={styles.dayCell} />;
                  const dateString = toDateString(viewYear, viewMonth, day);
                  const isSelected = dateString === value;
                  const isToday = dateString === todayString;
                  return (
                    <Pressable
                      key={di}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                      onPress={() => handleSelectDay(day)}
                    >
                      <Text style={[
                        styles.dayText,
                        isToday && !isSelected && styles.dayTextToday,
                        isSelected && styles.dayTextSelected,
                      ]}>
                        {day}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  field: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  fieldText: { fontSize: 16, color: '#111' },
  placeholderText: { fontSize: 16, color: '#999' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 32 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthNavBtn: { padding: 8 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#111' },
  weekdayRow: { flexDirection: 'row' },
  weekdayText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#888' },
  weekRow: { flexDirection: 'row', marginTop: 4 },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  dayCellSelected: { backgroundColor: COLORS.primary },
  dayText: { fontSize: 14, color: '#111' },
  dayTextToday: { color: COLORS.primary, fontWeight: '700' },
  dayTextSelected: { color: '#fff', fontWeight: '700' },
});
