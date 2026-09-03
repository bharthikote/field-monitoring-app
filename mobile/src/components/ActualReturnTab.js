import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getActualReturn, createActualReturnTransaction, updateActualReturnTransaction, deleteActualReturnTransaction } from '../api';
import SearchableSelect from './SearchableSelect';
import NumberField from './NumberField';
import DatePickerField from './DatePickerField';
import { COLORS } from '../theme';

function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

function formatDateDisplay(dateString) {
  const d = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

// Total Price is always computed, never entered - quantity x unit price.
function txTotal(tx) {
  return (Number(tx.quantity) || 0) * (Number(tx.unitPrice) || 0);
}
function itemTotal(item) {
  return item.transactions.reduce((sum, tx) => sum + txTotal(tx), 0);
}
function activityTotal(activity) {
  return activity.items.reduce((sum, item) => sum + itemTotal(item), 0);
}

// Sums actual quantities per unit (never across different units - no
// conversion mechanism exists anywhere in this app), for the demo summary
// card's Production KPI.
function computeProductionSummary(activities) {
  const byUnit = new Map();
  for (const activity of activities) {
    for (const item of activity.items) {
      for (const tx of item.transactions) {
        byUnit.set(tx.unitName, (byUnit.get(tx.unitName) || 0) + Number(tx.quantity));
      }
    }
  }
  if (byUnit.size === 0) return '0';
  return [...byUnit.entries()].map(([unit, qty]) => `${qty.toLocaleString()}${unit ? ' ' + unit : ''}`).join(', ');
}

function TransactionForm({ item, currency, draft, setDraft, onSave, onCancel, saving }) {
  const qty = Number(draft.quantity) || 0;
  const price = Number(draft.unitPrice) || 0;
  return (
    <View style={styles.txForm}>
      <DatePickerField label="Activity Date *" value={draft.activityDate} onChange={(v) => setDraft((d) => ({ ...d, activityDate: v }))} />
      <NumberField label="Actual Quantity *" value={draft.quantity} onChangeText={(v) => setDraft((d) => ({ ...d, quantity: v }))} />
      <SearchableSelect
        label="Unit *"
        placeholder="Select unit"
        options={item.units}
        value={draft.unitId}
        onChange={(v) => setDraft((d) => ({ ...d, unitId: v }))}
      />
      <NumberField label="Actual Unit Price *" value={draft.unitPrice} onChangeText={(v) => setDraft((d) => ({ ...d, unitPrice: v }))} suffix={currency} />
      <View style={styles.totalPreviewRow}>
        <Text style={styles.totalPreviewLabel}>Actual Total Price</Text>
        <Text style={styles.totalPreviewValue}>{formatAmount(qty * price, currency)}</Text>
      </View>
      <View style={styles.formActions}>
        <Pressable style={styles.saveButton} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={onCancel} disabled={saving}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
      <Text style={styles.requiredNote}>* Required Fields</Text>
    </View>
  );
}

function TransactionRow({ tx, item, currency, isOngoing, editingTxId, draft, setDraft, saving, onEdit, onCancelEdit, onSaveEdit, onDelete }) {
  if (editingTxId === tx.id) {
    return <TransactionForm item={item} currency={currency} draft={draft} setDraft={setDraft} onSave={() => onSaveEdit(tx)} onCancel={() => onCancelEdit(tx)} saving={saving} />;
  }
  return (
    <View style={styles.txRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.txDate}>{formatDateDisplay(tx.activityDate)}</Text>
        <Text style={styles.txDetail}>{tx.quantity} {tx.unitName} × {formatAmount(tx.unitPrice, currency)} = {formatAmount(txTotal(tx), currency)}</Text>
      </View>
      {isOngoing && (
        <View style={styles.txActions}>
          <Pressable style={styles.editPill} onPress={() => onEdit(tx)}>
            <Text style={styles.editPillText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.deletePill} onPress={() => onDelete(tx)}>
            <Text style={styles.deletePillText}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function ItemRow({
  item, index, currency, isOngoing,
  expandedItemIds, onToggleItem,
  addingItemId, addDraft, setAddDraft, onStartAdd, onCancelAdd, onSaveAdd,
  editingTxId, draft, setDraft, saving, onEdit, onCancelEdit, onSaveEdit, onDelete,
}) {
  const isOpen = expandedItemIds.has(item.id);
  const letter = String.fromCharCode(97 + index);

  return (
    <View style={styles.itemCard}>
      <Pressable style={styles.itemHeader} onPress={() => onToggleItem(item.id)}>
        <Text style={styles.itemHeaderText}>{letter}. {item.name}</Text>
        <View style={styles.itemHeaderRight}>
          <Text style={styles.itemHeaderText}>{formatAmount(itemTotal(item), currency)}</Text>
          <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {isOpen && (
        <View style={styles.itemBody}>
          {item.transactions.length === 0 && addingItemId !== item.id && (
            <Text style={styles.emptyItem}>No actual transactions recorded yet.</Text>
          )}
          {item.transactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              item={item}
              currency={currency}
              isOngoing={isOngoing}
              editingTxId={editingTxId}
              draft={draft}
              setDraft={setDraft}
              saving={saving}
              onEdit={onEdit}
              onCancelEdit={onCancelEdit}
              onSaveEdit={onSaveEdit}
              onDelete={onDelete}
            />
          ))}
          {addingItemId === item.id ? (
            <TransactionForm item={item} currency={currency} draft={addDraft} setDraft={setAddDraft} onSave={() => onSaveAdd(item)} onCancel={onCancelAdd} saving={saving} />
          ) : (
            isOngoing && (
              <Pressable style={styles.addTxButton} onPress={() => onStartAdd(item)}>
                <Text style={styles.addTxButtonText}>+ Add Transaction</Text>
              </Pressable>
            )
          )}
        </View>
      )}
    </View>
  );
}

function ActivitySection({ activity, index, currency, isOngoing, expanded, onToggleActivity, ...itemProps }) {
  return (
    <View style={styles.activityCard}>
      <Pressable style={styles.activityHeader} onPress={() => onToggleActivity(activity.id)}>
        <Text style={styles.activityHeaderText}>{index + 1}. {activity.name}</Text>
        <View style={styles.itemHeaderRight}>
          <Text style={styles.activityHeaderText}>{formatAmount(activityTotal(activity), currency)}</Text>
          <Text style={styles.chevronDark}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {expanded && activity.items.map((item, i) => (
        <ItemRow key={item.id} item={item} index={i} currency={currency} isOngoing={isOngoing} {...itemProps} />
      ))}
    </View>
  );
}

// The Business Plan's "Return" tab (top-level nav): actual, dated return
// transactions against the same Activity Return skeleton Expected Return
// uses. Mirrors ActualCostTab's structure exactly (see that file) - every
// configured item always shown, per-item "+ Add Transaction", Total Price
// always computed (quantity x unit price), never entered directly.
export default function ActualReturnTab({ token, demoId, onTotalChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedActivityIds, setExpandedActivityIds] = useState(() => new Set());
  const [expandedItemIds, setExpandedItemIds] = useState(() => new Set());
  const [editingTxId, setEditingTxId] = useState(null);
  const [draft, setDraft] = useState({ activityDate: '', quantity: '', unitId: null, unitPrice: '' });
  const [addingItemId, setAddingItemId] = useState(null);
  const [addDraft, setAddDraft] = useState({ activityDate: '', quantity: '', unitId: null, unitPrice: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getActualReturn(token, demoId);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, demoId]);

  useEffect(() => {
    load();
  }, [load]);

  // Reports the overall actual return total AND a unit-safe production
  // summary up whenever `data` changes - same safe [data]-only gating
  // used everywhere else in this Business Plan family of components.
  useEffect(() => {
    if (!onTotalChange) return;
    if (!data) {
      onTotalChange(0, null, '0');
      return;
    }
    const total = data.activities.reduce((sum, a) => sum + activityTotal(a), 0);
    onTotalChange(total, data.currency, computeProductionSummary(data.activities));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const toggleActivity = (activityId) => {
    setExpandedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId); else next.add(activityId);
      return next;
    });
  };
  const toggleItem = (itemId) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
    setAddingItemId(null);
    setEditingTxId(null);
  };

  const startAdd = (item) => {
    setEditingTxId(null);
    setAddingItemId(item.id);
    setAddDraft({ activityDate: '', quantity: '', unitId: null, unitPrice: '' });
  };
  const cancelAdd = () => setAddingItemId(null);

  const startEdit = (tx) => {
    setAddingItemId(null);
    setEditingTxId(tx.id);
    setDraft({ activityDate: tx.activityDate, quantity: String(tx.quantity), unitId: tx.unitId, unitPrice: String(tx.unitPrice) });
  };
  const cancelEdit = () => setEditingTxId(null);

  const deleteTx = (tx) => {
    Alert.alert('Delete transaction', `Remove the ${formatDateDisplay(tx.activityDate)} entry?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteActualReturnTransaction(token, demoId, tx.id);
            setData((prev) => ({
              ...prev,
              activities: prev.activities.map((a) => ({
                ...a,
                items: a.items.map((i) => ({ ...i, transactions: i.transactions.filter((t) => t.id !== tx.id) })),
              })),
            }));
          } catch (err) {
            Alert.alert('Something went wrong', err.message);
          }
        },
      },
    ]);
  };

  function validateDraft(d) {
    if (!d.activityDate) return 'Activity Date is required.';
    const qty = Number(d.quantity);
    if (d.quantity === '' || Number.isNaN(qty) || qty < 0) return 'Actual Quantity must be a number that is 0 or more.';
    if (!d.unitId) return 'Please select a Unit.';
    const price = Number(d.unitPrice);
    if (d.unitPrice === '' || Number.isNaN(price) || price < 0) return 'Actual Unit Price must be a number that is 0 or more.';
    return null;
  }

  const saveAdd = async (item) => {
    const err = validateDraft(addDraft);
    if (err) { Alert.alert('Missing information', err); return; }
    setSaving(true);
    try {
      const result = await createActualReturnTransaction(token, demoId, {
        itemId: item.id, activityDate: addDraft.activityDate, quantity: Number(addDraft.quantity), unitId: addDraft.unitId, unitPrice: Number(addDraft.unitPrice),
      });
      const unitName = item.units.find((u) => u.id === addDraft.unitId)?.name || '';
      const newTx = { id: result.id, activityDate: addDraft.activityDate, quantity: Number(addDraft.quantity), unitId: addDraft.unitId, unitName, unitPrice: Number(addDraft.unitPrice) };
      setData((prev) => ({
        ...prev,
        activities: prev.activities.map((a) => ({
          ...a,
          items: a.items.map((i) => (i.id !== item.id ? i : { ...i, transactions: [newTx, ...i.transactions] })),
        })),
      }));
      setAddingItemId(null);
    } catch (err) {
      Alert.alert('Something went wrong', err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (tx) => {
    const err = validateDraft(draft);
    if (err) { Alert.alert('Missing information', err); return; }
    setSaving(true);
    try {
      await updateActualReturnTransaction(token, demoId, tx.id, {
        activityDate: draft.activityDate, quantity: Number(draft.quantity), unitId: draft.unitId, unitPrice: Number(draft.unitPrice),
      });
      setData((prev) => ({
        ...prev,
        activities: prev.activities.map((a) => ({
          ...a,
          items: a.items.map((i) => ({
            ...i,
            transactions: i.transactions.map((t) => (t.id !== tx.id ? t : {
              ...t, activityDate: draft.activityDate, quantity: Number(draft.quantity), unitId: draft.unitId,
              unitName: i.units.find((u) => u.id === draft.unitId)?.name || t.unitName, unitPrice: Number(draft.unitPrice),
            })),
          })),
        })),
      }));
      setEditingTxId(null);
    } catch (err) {
      Alert.alert('Something went wrong', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (error || !data) return <Text style={styles.error}>{error || 'Could not load Actual Return.'}</Text>;

  return (
    <View>
      {data.activities.length === 0 ? (
        <Text style={styles.empty}>No Activity Return items are configured for this demo's country yet.</Text>
      ) : (
        data.activities.map((activity, index) => (
          <ActivitySection
            key={activity.id}
            activity={activity}
            index={index}
            currency={data.currency}
            isOngoing={data.isOngoing}
            expanded={expandedActivityIds.has(activity.id)}
            onToggleActivity={toggleActivity}
            expandedItemIds={expandedItemIds}
            onToggleItem={toggleItem}
            addingItemId={addingItemId}
            addDraft={addDraft}
            setAddDraft={setAddDraft}
            onStartAdd={startAdd}
            onCancelAdd={cancelAdd}
            onSaveAdd={saveAdd}
            editingTxId={editingTxId}
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveEdit={saveEdit}
            onDelete={deleteTx}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: COLORS.danger, marginTop: 20 },
  empty: { color: '#888', marginTop: 20 },
  emptyItem: { color: COLORS.textMuted, fontSize: 13, marginBottom: 8 },
  activityCard: { marginBottom: 14 },
  activityHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: COLORS.primary, paddingBottom: 8, marginBottom: 8,
  },
  activityHeaderText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 15 },
  itemHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevronDark: { color: COLORS.primaryDark, fontSize: 12 },
  chevron: { color: COLORS.textMuted, fontSize: 12 },
  itemCard: { backgroundColor: COLORS.primarySoft, borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  itemHeaderText: { color: COLORS.primaryDark, fontWeight: '600', fontSize: 13 },
  itemBody: { paddingHorizontal: 14, paddingBottom: 14 },
  txRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8,
  },
  txDate: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 12 },
  txDetail: { color: COLORS.text, fontSize: 13, marginTop: 2 },
  txActions: { flexDirection: 'row', gap: 6 },
  editPill: { backgroundColor: '#dff3e3', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  editPillText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 12 },
  deletePill: { backgroundColor: COLORS.dangerSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  deletePillText: { color: COLORS.danger, fontWeight: '700', fontSize: 12 },
  addTxButton: { backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  addTxButtonText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
  txForm: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  totalPreviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14,
  },
  totalPreviewLabel: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '600' },
  totalPreviewValue: { color: COLORS.primaryDark, fontSize: 15, fontWeight: '700' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelButton: { backgroundColor: COLORS.danger, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  requiredNote: { color: COLORS.primary, fontSize: 11, marginTop: 10 },
});
