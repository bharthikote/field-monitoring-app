import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { COLORS } from '../theme';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 3; // matches the reference screenshot: one row above/below the selection
const YEAR_SPAN = 10; // today +/- 10 years - generous headroom for any date this app records

function pad2(n) {
  return String(n).padStart(2, '0');
}
function toDateString(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// One vertically-scrolling wheel column (Day / Month / Year). Pure ScrollView
// + snapToInterval - no native picker module involved (the project's
// existing @react-native-community/datetimepicker attempt doesn't build
// under Expo Go's managed workflow, which is exactly why the original
// calendar-grid version of this component existed in the first place).
// `items` is an array of {value, label}; `selectedIndex` is controlled by
// the parent so changing the Year/Month can reset the Day column's
// position (e.g. clamping Feb 30 -> Feb 28) without fighting the scroll.
function WheelColumn({ items, selectedIndex, onChangeIndex }) {
  const scrollRef = useRef(null);
  const userScrolling = useRef(false);
  const paddingVertical = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

  // Jump to the controlled index without animating - but only when this
  // column's own scroll wasn't what caused selectedIndex to change (e.g.
  // opening the modal, or the Day column reflowing because Month/Year
  // changed elsewhere). Skipping it for user-driven changes matters: the
  // ScrollView is already physically at that position from the gesture
  // itself, so re-issuing scrollTo would just fight the user's momentum.
  useEffect(() => {
    if (userScrolling.current) {
      userScrolling.current = false;
      return;
    }
    scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [items, selectedIndex]);

  const handleMomentumEnd = (e) => {
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT)));
    userScrolling.current = true;
    onChangeIndex(idx);
  };

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE_ROWS, flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={styles.wheelScroll}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical }}
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleMomentumEnd}
      >
        {items.map((item, i) => (
          <View key={item.value} style={styles.wheelRow}>
            <Text style={[styles.wheelText, i === selectedIndex && styles.wheelTextSelected]}>{item.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// A native-feeling three-column (Day / Month / Year) wheel date picker,
// matching the reference screenshot's modal exactly - dimmed backdrop,
// rounded centered card, "Select date" heading, live-scrolling selection
// that only commits on Confirm (Cancel discards it), Cancel/Confirm pill
// buttons. Same external contract as before this rewrite - `value`/
// `onChange` are still plain YYYY-MM-DD strings - so every one of this
// app's 8 screens that already use this component needed no changes.
export default function DatePickerField({ label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [draftYear, setDraftYear] = useState(null);
  const [draftMonth, setDraftMonth] = useState(null);
  const [draftDay, setDraftDay] = useState(null);

  const handleOpen = () => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    setDraftYear(base.getFullYear());
    setDraftMonth(base.getMonth());
    setDraftDay(base.getDate());
    setOpen(true);
  };

  const currentYear = new Date().getFullYear();
  const yearItems = useMemo(
    () => Array.from({ length: YEAR_SPAN * 2 + 1 }, (_, i) => {
      const y = currentYear - YEAR_SPAN + i;
      return { value: y, label: String(y) };
    }),
    [currentYear],
  );
  const monthItems = useMemo(() => MONTH_LABELS.map((m, i) => ({ value: i, label: m })), []);
  const dayItems = useMemo(() => {
    if (draftYear === null || draftMonth === null) return [];
    const count = daysInMonth(draftYear, draftMonth);
    return Array.from({ length: count }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  }, [draftYear, draftMonth]);

  // Changing month/year can invalidate the selected day (e.g. Feb 30) -
  // clamp it down to the new month's last valid day rather than letting
  // the day column scroll to a phantom position.
  useEffect(() => {
    if (draftYear === null || draftMonth === null || draftDay === null) return;
    const maxDay = daysInMonth(draftYear, draftMonth);
    if (draftDay > maxDay) setDraftDay(maxDay);
  }, [draftYear, draftMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    onChange(toDateString(draftYear, draftMonth, draftDay));
    setOpen(false);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={handleOpen}>
        <Text style={value ? styles.fieldText : styles.placeholderText}>{value || '-- select date --'}</Text>
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          {/* Sibling of `sheet`, not an ancestor wrapping it - a Pressable
              sitting ABOVE the wheel ScrollViews in the tree (as the old
              backdrop+sheet nesting had it) can win the touch responder
              negotiation before a ScrollView ever gets to claim a drag as
              its own, which silently defeats scrolling even though taps
              still work fine. This way `sheet` is a plain View that never
              competes for the responder at all, and this Pressable only
              ever sees touches in the dimmed area outside it. */}
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.title}>Select date</Text>

            {draftYear !== null && (
              <View style={styles.wheelWrap}>
                <View pointerEvents="none" style={styles.selectionWindow} />
                <WheelColumn items={dayItems} selectedIndex={draftDay - 1} onChangeIndex={(i) => setDraftDay(dayItems[i].value)} />
                <WheelColumn items={monthItems} selectedIndex={draftMonth} onChangeIndex={(i) => setDraftMonth(monthItems[i].value)} />
                <WheelColumn items={yearItems} selectedIndex={draftYear - (currentYear - YEAR_SPAN)} onChangeIndex={(i) => setDraftYear(yearItems[i].value)} />
              </View>
            )}

            <View style={styles.actionsRow}>
              <Pressable style={styles.cancelButton} onPress={() => setOpen(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmButton} onPress={handleConfirm}>
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  field: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  fieldText: { fontSize: 16, color: '#111' },
  placeholderText: { fontSize: 16, color: '#999' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 20, padding: 24 },
  title: { fontSize: 20, fontWeight: '600', color: '#111', marginBottom: 20 },
  wheelWrap: { flexDirection: 'row', position: 'relative' },
  // Without an explicit style here, ScrollView doesn't reliably size
  // itself to the wrapping View's fixed height in a flex-row layout - it
  // still painted (the wrapper's own height clips the content), but its
  // internal pan-gesture measurement came out wrong, so drags/swipes
  // never actually registered as a scroll. flex: 1 is the fix.
  wheelScroll: { flex: 1 },
  selectionWindow: {
    position: 'absolute', left: 0, right: 0, top: ITEM_HEIGHT, height: ITEM_HEIGHT,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ddd',
  },
  wheelRow: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontSize: 17, color: '#aaa' },
  wheelTextSelected: { fontSize: 20, color: '#111', fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelButton: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 999,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelButtonText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 15 },
  confirmButton: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
