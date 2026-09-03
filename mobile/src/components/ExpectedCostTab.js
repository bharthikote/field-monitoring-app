import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getExpectedCost, saveExpectedCostItem, deleteExpectedCostItem } from '../api';
import SearchableSelect from './SearchableSelect';
import NumberField from './NumberField';
import { COLORS } from '../theme';

const ORANGE = '#f2994a';
const ORANGE_SOFT = '#fdf1e6';

function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

function itemTotal(savedCost) {
  if (!savedCost) return 0;
  return Number(savedCost.farmerPrice) + Number(savedCost.loanPrice);
}

function activityTotal(activity) {
  return activity.items.reduce((sum, item) => sum + itemTotal(item.savedCost), 0);
}

// Read-only detail shown after tapping a saved item's row - matches the
// muted "Bed preparation" state in the reference screenshot, before Edit
// is tapped.
function SavedDetail({ savedCost, currency }) {
  return (
    <View style={styles.detailGrid}>
      <View style={styles.detailRow}>
        <View style={styles.detailField}>
          <Text style={styles.detailLabel}>Expected Quantity</Text>
          <Text style={styles.detailValue}>{savedCost.quantity}</Text>
        </View>
        <View style={styles.detailField}>
          <Text style={styles.detailLabel}>Unit</Text>
          <Text style={styles.detailValue}>{savedCost.unitName}</Text>
        </View>
      </View>
      <View style={styles.detailRow}>
        <View style={styles.detailField}>
          <Text style={styles.detailLabel}>Farmer Expected Price</Text>
          <Text style={styles.detailValue}>{formatAmount(savedCost.farmerPrice, currency)}</Text>
        </View>
        <View style={styles.detailField}>
          <Text style={styles.detailLabel}>Loan Expected Price</Text>
          <Text style={styles.detailValue}>{formatAmount(savedCost.loanPrice, currency)}</Text>
        </View>
      </View>
    </View>
  );
}

function ItemEditForm({ item, currency, draft, setDraft, onSave, onCancel, saving }) {
  return (
    <View>
      <NumberField label="Expected Quantity *" value={draft.quantity} onChangeText={(v) => setDraft((d) => ({ ...d, quantity: v }))} />
      <SearchableSelect
        label="Unit *"
        placeholder="Select unit"
        options={item.units}
        value={draft.unitId}
        onChange={(v) => setDraft((d) => ({ ...d, unitId: v }))}
      />
      <View style={styles.priceRow}>
        <View style={{ flex: 1 }}>
          <NumberField label="Farmer Expected Price *" value={draft.farmerPrice} onChangeText={(v) => setDraft((d) => ({ ...d, farmerPrice: v }))} suffix={currency} />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label="Loan Expected Price *" value={draft.loanPrice} onChangeText={(v) => setDraft((d) => ({ ...d, loanPrice: v }))} suffix={currency} />
        </View>
      </View>
      <View style={styles.formActions}>
        <Pressable style={styles.saveButton} onPress={() => onSave(item)} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>Save</Text>}
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => onCancel(item)} disabled={saving}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      </View>
      <Text style={styles.requiredNote}>* Required Fields</Text>
    </View>
  );
}

function ItemRow({ activity, item, index, currency, isOngoing, openItemId, editMode, draft, saving, onToggle, onEdit, onDelete, onSave, onCancel, setDraft }) {
  const isOpen = openItemId === item.id;
  const isEditing = isOpen && editMode;
  const letter = String.fromCharCode(97 + index);
  const total = itemTotal(item.savedCost);

  return (
    <View style={styles.itemCard}>
      <Pressable style={styles.itemHeader} onPress={() => onToggle(item)}>
        <Text style={styles.itemHeaderText}>{letter}. {item.name}</Text>
        <View style={styles.itemHeaderRight}>
          <Text style={styles.itemHeaderText}>{formatAmount(total, currency)}</Text>
          <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {isOpen && (
        <View style={styles.itemBody}>
          {isEditing ? (
            <ItemEditForm item={item} currency={currency} draft={draft} setDraft={setDraft} onSave={onSave} onCancel={onCancel} saving={saving} />
          ) : (
            <>
              <SavedDetail savedCost={item.savedCost} currency={currency} />
              {isOngoing && (
                <View style={styles.viewActions}>
                  <Pressable style={styles.editPill} onPress={() => onEdit(item)}>
                    <Text style={styles.editPillText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.deletePill} onPress={() => onDelete(item)}>
                    <Text style={styles.deletePillText}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function ActivitySection({
  activity, index, currency, isOngoing,
  expanded, onToggleActivity,
  openItemId, editMode, draft, saving, setDraft,
  onToggleItem, onEdit, onCancel, onSave, onDelete,
  pickerItemId, onPickNewItem,
}) {
  const savedItems = activity.items.filter((i) => i.savedCost);
  const addableItems = activity.items.filter((i) => !i.savedCost && i.id !== openItemId);
  const newlyAddingItem = openItemId && !activity.items.find((i) => i.id === openItemId)?.savedCost
    ? activity.items.find((i) => i.id === openItemId)
    : null;
  const rows = newlyAddingItem ? [...savedItems, newlyAddingItem] : savedItems;

  return (
    <View style={styles.activityCard}>
      <Pressable style={styles.activityHeader} onPress={() => onToggleActivity(activity.id)}>
        <Text style={styles.activityHeaderText}>{index + 1}. {activity.name}</Text>
        <View style={styles.itemHeaderRight}>
          <Text style={styles.activityHeaderText}>{formatAmount(activityTotal(activity), currency)}</Text>
          <Text style={styles.chevronDark}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View>
          {rows.map((item, i) => (
            <ItemRow
              key={item.id}
              activity={activity}
              item={item}
              index={i}
              currency={currency}
              isOngoing={isOngoing}
              openItemId={openItemId}
              editMode={editMode}
              draft={draft}
              saving={saving}
              setDraft={setDraft}
              onToggle={onToggleItem}
              onEdit={onEdit}
              onDelete={onDelete}
              onSave={onSave}
              onCancel={onCancel}
            />
          ))}
          {isOngoing && (
            <View style={styles.selectItemWrap}>
              <SearchableSelect
                label="Select Item"
                placeholder="Select Item"
                options={addableItems}
                value={null}
                onChange={(itemId) => onPickNewItem(activity, itemId)}
                disabled={addableItems.length === 0}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// The Business Plan -> Expected Cost tab: Activities/Items come entirely
// from the Super Admin's Activity Cost master data (scoped to this demo's
// own country), never hardcoded here. Expected Return stays a placeholder
// per the spec - this component only implements Expected Cost.
export default function ExpectedCostTab({ token, demoId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subTab, setSubTab] = useState('cost');
  const [expandedActivityIds, setExpandedActivityIds] = useState(() => new Set());
  const [openItemId, setOpenItemId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ quantity: '', unitId: null, farmerPrice: '', loanPrice: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getExpectedCost(token, demoId);
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

  const closeOpenItem = () => {
    setOpenItemId(null);
    setEditMode(false);
  };

  const toggleActivity = (activityId) => {
    setExpandedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId); else next.add(activityId);
      return next;
    });
  };

  const toggleItem = (item) => {
    if (openItemId === item.id) {
      closeOpenItem();
      return;
    }
    setOpenItemId(item.id);
    setEditMode(false);
  };

  const startEdit = (item) => {
    setOpenItemId(item.id);
    setEditMode(true);
    setDraft({
      quantity: String(item.savedCost.quantity),
      unitId: item.savedCost.unitId,
      farmerPrice: String(item.savedCost.farmerPrice),
      loanPrice: String(item.savedCost.loanPrice),
    });
  };

  const pickNewItem = (activity, itemId) => {
    setOpenItemId(itemId);
    setEditMode(true);
    setDraft({ quantity: '', unitId: null, farmerPrice: '', loanPrice: '' });
    setExpandedActivityIds((prev) => new Set(prev).add(activity.id));
  };

  const cancelEdit = (item) => {
    if (item.savedCost) {
      setEditMode(false);
    } else {
      closeOpenItem();
    }
  };

  const deleteItem = (item) => {
    Alert.alert('Delete item', `Remove "${item.name}" from Expected Cost?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpectedCostItem(token, demoId, item.id);
            closeOpenItem();
            setData((prev) => ({
              ...prev,
              activities: prev.activities.map((a) => ({
                ...a,
                items: a.items.map((i) => (i.id === item.id ? { ...i, savedCost: null } : i)),
              })),
            }));
          } catch (err) {
            Alert.alert('Something went wrong', err.message);
          }
        },
      },
    ]);
  };

  const saveItem = async (activity, item) => {
    const qty = Number(draft.quantity);
    const farmer = Number(draft.farmerPrice);
    const loan = Number(draft.loanPrice);
    if (draft.quantity === '' || Number.isNaN(qty) || qty < 0) {
      Alert.alert('Missing information', 'Expected Quantity must be a number that is 0 or more.');
      return;
    }
    if (!draft.unitId) {
      Alert.alert('Missing information', 'Please select a Unit.');
      return;
    }
    if (draft.farmerPrice === '' || Number.isNaN(farmer) || farmer < 0) {
      Alert.alert('Missing information', 'Farmer Expected Price must be a number that is 0 or more.');
      return;
    }
    if (draft.loanPrice === '' || Number.isNaN(loan) || loan < 0) {
      Alert.alert('Missing information', 'Loan Expected Price must be a number that is 0 or more.');
      return;
    }

    setSaving(true);
    try {
      await saveExpectedCostItem(token, demoId, { itemId: item.id, quantity: qty, unitId: draft.unitId, farmerPrice: farmer, loanPrice: loan });
      const unitName = item.units.find((u) => u.id === draft.unitId)?.name || '';
      setData((prev) => ({
        ...prev,
        activities: prev.activities.map((a) => (a.id !== activity.id ? a : {
          ...a,
          items: a.items.map((i) => (i.id !== item.id ? i : {
            ...i,
            savedCost: { quantity: qty, unitId: draft.unitId, unitName, farmerPrice: farmer, loanPrice: loan },
          })),
        })),
      }));
      setEditMode(false);
    } catch (err) {
      Alert.alert('Something went wrong', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }
  if (error || !data) {
    return <Text style={styles.error}>{error || 'Could not load Expected Cost.'}</Text>;
  }

  // savedCost from the API doesn't carry unitName (only unitId) - attach it
  // here once so SavedDetail can display it without a lookup per render.
  const activities = data.activities.map((a) => ({
    ...a,
    items: a.items.map((i) => (i.savedCost && !i.savedCost.unitName
      ? { ...i, savedCost: { ...i.savedCost, unitName: i.units.find((u) => u.id === i.savedCost.unitId)?.name || '' } }
      : i)),
  }));
  const overallTotal = activities.reduce((sum, a) => sum + activityTotal(a), 0);

  return (
    <View>
      <View style={styles.subTabRow}>
        <Pressable style={[styles.subTab, subTab === 'cost' ? styles.subTabActiveCost : styles.subTabInactive]} onPress={() => setSubTab('cost')}>
          <Text style={subTab === 'cost' ? styles.subTabActiveCostText : styles.subTabInactiveText}>Expected Cost</Text>
        </Pressable>
        <Pressable style={[styles.subTab, subTab === 'return' ? styles.subTabActiveCost : styles.subTabInactive]} onPress={() => setSubTab('return')}>
          <Text style={subTab === 'return' ? styles.subTabActiveCostText : styles.subTabInactiveText}>Expected Return</Text>
        </Pressable>
      </View>

      {subTab === 'return' ? (
        <Text style={styles.empty}>Expected Return isn't built yet.</Text>
      ) : (
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Expected Cost</Text>
            <Text style={styles.totalValue}>{formatAmount(overallTotal, data.currency)}</Text>
          </View>

          {activities.length === 0 ? (
            <Text style={styles.empty}>No Activity Cost items are configured for this demo's country yet.</Text>
          ) : (
            activities.map((activity, index) => (
              <ActivitySection
                key={activity.id}
                activity={activity}
                index={index}
                currency={data.currency}
                isOngoing={data.isOngoing}
                expanded={expandedActivityIds.has(activity.id)}
                onToggleActivity={toggleActivity}
                openItemId={openItemId}
                editMode={editMode}
                draft={draft}
                setDraft={setDraft}
                saving={saving}
                onToggleItem={toggleItem}
                onEdit={startEdit}
                onCancel={cancelEdit}
                onSave={(item) => saveItem(activity, item)}
                onDelete={deleteItem}
                pickerItemId={openItemId}
                onPickNewItem={pickNewItem}
              />
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: COLORS.danger, marginTop: 20 },
  empty: { color: '#888', marginTop: 20 },
  subTabRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 16 },
  subTab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  subTabActiveCost: { backgroundColor: ORANGE },
  subTabActiveCostText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  subTabInactive: { backgroundColor: COLORS.primarySoft },
  subTabInactiveText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: ORANGE_SOFT, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  totalLabel: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 14 },
  totalValue: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 16 },
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
  itemBody: { paddingHorizontal: 14, paddingBottom: 16 },
  detailGrid: { marginTop: 4 },
  detailRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  detailField: { flex: 1 },
  detailLabel: { fontSize: 11, color: COLORS.textMuted },
  detailValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  viewActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  editPill: { backgroundColor: '#dff3e3', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  editPillText: { color: COLORS.primaryDark, fontWeight: '700', fontSize: 13 },
  deletePill: { backgroundColor: COLORS.dangerSoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  deletePillText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
  priceRow: { flexDirection: 'row', gap: 12 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelButton: { backgroundColor: COLORS.danger, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  cancelButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  requiredNote: { color: COLORS.primary, fontSize: 11, marginTop: 10 },
  selectItemWrap: { marginTop: 4, marginBottom: 8 },
});
