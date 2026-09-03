import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getExpectedReturn, saveExpectedReturnItem, deleteExpectedReturnItem } from '../api';
import SearchableSelect from './SearchableSelect';
import NumberField from './NumberField';
import { COLORS } from '../theme';

function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
}

// Expected Total Price is never independently editable - always
// quantity * unit price, per the spec.
function itemTotal(savedReturn) {
  if (!savedReturn) return 0;
  return Number(savedReturn.quantity) * Number(savedReturn.unitPrice);
}

function activityTotal(activity) {
  return activity.items.reduce((sum, item) => sum + itemTotal(item.savedReturn), 0);
}

// Sums saved quantities per unit (Kilo, Piece, Quintal, ...) rather than
// across all of them - there's no unit-conversion mechanism anywhere in
// this app, so 500 Kilo + 5 Quintal must never collapse into one number.
// Reported as e.g. "500 Kilo, 5 Quintal" when more than one unit is in
// play, or just "500 Kilo" when everything shares one unit.
function computeProductionSummary(activities) {
  const byUnit = new Map();
  for (const activity of activities) {
    for (const item of activity.items) {
      if (!item.savedReturn) continue;
      const unitName = item.savedReturn.unitName || '';
      byUnit.set(unitName, (byUnit.get(unitName) || 0) + Number(item.savedReturn.quantity));
    }
  }
  if (byUnit.size === 0) return '0';
  return [...byUnit.entries()]
    .map(([unit, qty]) => `${qty.toLocaleString()}${unit ? ' ' + unit : ''}`)
    .join(', ');
}

function SavedDetail({ savedReturn, currency }) {
  return (
    <View style={styles.detailGrid}>
      <View style={styles.detailRow}>
        <View style={styles.detailField}>
          <Text style={styles.detailLabel}>Expected Quantity</Text>
          <Text style={styles.detailValue}>{savedReturn.quantity}</Text>
        </View>
        <View style={styles.detailField}>
          <Text style={styles.detailLabel}>Unit</Text>
          <Text style={styles.detailValue}>{savedReturn.unitName}</Text>
        </View>
      </View>
      <View style={styles.detailRow}>
        <View style={styles.detailField}>
          <Text style={styles.detailLabel}>Expected Unit Price</Text>
          <Text style={styles.detailValue}>{formatAmount(savedReturn.unitPrice, currency)}</Text>
        </View>
        <View style={styles.detailField}>
          <Text style={styles.detailLabel}>Expected Total Price</Text>
          <Text style={styles.detailValue}>{formatAmount(itemTotal(savedReturn), currency)}</Text>
        </View>
      </View>
    </View>
  );
}

// Shared by both an existing item's inline Edit form and the top-level
// "Add Return" panel - same fields, same Save/Cancel.
function ReturnEntryForm({ item, currency, draft, setDraft, onSave, onCancel, saving }) {
  const qty = Number(draft.quantity) || 0;
  const price = Number(draft.unitPrice) || 0;
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
      <NumberField label="Expected Unit Price *" value={draft.unitPrice} onChangeText={(v) => setDraft((d) => ({ ...d, unitPrice: v }))} suffix={currency} />
      <View style={styles.totalPreviewRow}>
        <Text style={styles.totalPreviewLabel}>Expected Total Price</Text>
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

function ItemRow({ item, index, currency, isOngoing, openItemId, editMode, draft, saving, onToggle, onEdit, onDelete, onSave, onCancel, setDraft }) {
  const isOpen = openItemId === item.id;
  const isEditing = isOpen && editMode;
  const letter = String.fromCharCode(97 + index);
  const total = itemTotal(item.savedReturn);

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
            <ReturnEntryForm item={item} currency={currency} draft={draft} setDraft={setDraft} onSave={() => onSave(item)} onCancel={() => onCancel(item)} saving={saving} />
          ) : (
            <>
              <SavedDetail savedReturn={item.savedReturn} currency={currency} />
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
}) {
  const savedItems = activity.items.filter((i) => i.savedReturn);

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
          {savedItems.length === 0 ? (
            <Text style={styles.emptyActivity}>No returns added yet for this activity.</Text>
          ) : (
            savedItems.map((item, i) => (
              <ItemRow
                key={item.id}
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
            ))
          )}
        </View>
      )}
    </View>
  );
}

function AddReturnPanel({ activities, currency, addActivityId, addItemId, draft, setDraft, saving, onPickActivity, onPickItem, onSave, onCancel }) {
  const activityOptions = activities.map((a) => ({ id: a.id, name: a.name }));
  const selectedActivity = activities.find((a) => a.id === addActivityId);
  const itemOptions = selectedActivity ? selectedActivity.items.filter((i) => !i.savedReturn) : [];
  const selectedItem = selectedActivity?.items.find((i) => i.id === addItemId);

  return (
    <View style={styles.addPanel}>
      <SearchableSelect label="Activity *" placeholder="Select activity" options={activityOptions} value={addActivityId} onChange={onPickActivity} />
      {selectedActivity && (
        itemOptions.length === 0 ? (
          <Text style={styles.emptyActivity}>Every item for this activity has already been added.</Text>
        ) : (
          <SearchableSelect label="Item *" placeholder="Select item" options={itemOptions} value={addItemId} onChange={onPickItem} />
        )
      )}
      {selectedItem && (
        <ReturnEntryForm item={selectedItem} currency={currency} draft={draft} setDraft={setDraft} onSave={onSave} onCancel={onCancel} saving={saving} />
      )}
      {!selectedItem && (
        <Pressable style={styles.standaloneCancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

// The Business Plan -> Expected Return tab: Activities/Items come entirely
// from the Super Admin's Activity Return master data (scoped to this
// demo's own country), never hardcoded here. Mirrors ExpectedCostTab's
// structure exactly (see that file for the shared interaction pattern),
// with quantity/unit/unitPrice replacing quantity/unit/farmer+loan price.
export default function ExpectedReturnTab({ token, demoId, onTotalChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedActivityIds, setExpandedActivityIds] = useState(() => new Set());
  const [openItemId, setOpenItemId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addActivityId, setAddActivityId] = useState(null);
  const [addItemId, setAddItemId] = useState(null);
  const [draft, setDraft] = useState({ quantity: '', unitId: null, unitPrice: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getExpectedReturn(token, demoId);
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

  // Reports the overall total and a unit-safe production summary up to
  // BusinessPlanTab (-> the demo summary card's Return/Production KPIs)
  // whenever `data` actually changes - never on an unrelated parent
  // re-render, since this only depends on `data` itself.
  useEffect(() => {
    if (!onTotalChange) return;
    if (!data) {
      onTotalChange(0, null, '0');
      return;
    }
    const resolved = data.activities.map((a) => ({
      ...a,
      items: a.items.map((i) => (i.savedReturn
        ? { ...i, savedReturn: { ...i.savedReturn, unitName: i.units.find((u) => u.id === i.savedReturn.unitId)?.name || '' } }
        : i)),
    }));
    const total = resolved.reduce((sum, a) => sum + activityTotal(a), 0);
    onTotalChange(total, data.currency, computeProductionSummary(resolved));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const closeOpenItem = () => {
    setOpenItemId(null);
    setEditMode(false);
  };
  const closeAdd = () => {
    setAdding(false);
    setAddActivityId(null);
    setAddItemId(null);
  };

  const toggleActivity = (activityId) => {
    setExpandedActivityIds((prev) => {
      const next = new Set(prev);
      if (next.has(activityId)) next.delete(activityId); else next.add(activityId);
      return next;
    });
  };

  const toggleItem = (item) => {
    closeAdd();
    if (openItemId === item.id) {
      closeOpenItem();
      return;
    }
    setOpenItemId(item.id);
    setEditMode(false);
  };

  const startEdit = (item) => {
    closeAdd();
    setOpenItemId(item.id);
    setEditMode(true);
    setDraft({
      quantity: String(item.savedReturn.quantity),
      unitId: item.savedReturn.unitId,
      unitPrice: String(item.savedReturn.unitPrice),
    });
  };

  const cancelEdit = (item) => {
    if (item.savedReturn) {
      setEditMode(false);
    } else {
      closeOpenItem();
    }
  };

  const startAdd = () => {
    closeOpenItem();
    setAdding(true);
    setAddActivityId(null);
    setAddItemId(null);
  };

  const pickAddActivity = (activityId) => {
    setAddActivityId(activityId);
    setAddItemId(null);
  };
  const pickAddItem = (itemId) => {
    setAddItemId(itemId);
    setDraft({ quantity: '', unitId: null, unitPrice: '' });
  };

  const deleteItem = (item) => {
    Alert.alert('Delete item', `Remove "${item.name}" from Expected Return?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteExpectedReturnItem(token, demoId, item.id);
            closeOpenItem();
            setData((prev) => ({
              ...prev,
              activities: prev.activities.map((a) => ({
                ...a,
                items: a.items.map((i) => (i.id === item.id ? { ...i, savedReturn: null } : i)),
              })),
            }));
          } catch (err) {
            Alert.alert('Something went wrong', err.message);
          }
        },
      },
    ]);
  };

  // Shared by the existing-item Edit form and the Add Return panel - both
  // upsert by itemId, implementing the same "consolidate duplicate item"
  // rule Expected Cost uses (same Activity + Item overwrites one row).
  const performSave = async (item) => {
    const qty = Number(draft.quantity);
    const price = Number(draft.unitPrice);
    if (draft.quantity === '' || Number.isNaN(qty) || qty < 0) {
      Alert.alert('Missing information', 'Expected Quantity must be a number that is 0 or more.');
      return false;
    }
    if (!draft.unitId) {
      Alert.alert('Missing information', 'Please select a Unit.');
      return false;
    }
    if (draft.unitPrice === '' || Number.isNaN(price) || price < 0) {
      Alert.alert('Missing information', 'Expected Unit Price must be a number that is 0 or more.');
      return false;
    }

    setSaving(true);
    try {
      await saveExpectedReturnItem(token, demoId, { itemId: item.id, quantity: qty, unitId: draft.unitId, unitPrice: price });
      const unitName = item.units.find((u) => u.id === draft.unitId)?.name || '';
      setData((prev) => ({
        ...prev,
        activities: prev.activities.map((a) => ({
          ...a,
          items: a.items.map((i) => (i.id !== item.id ? i : {
            ...i,
            savedReturn: { quantity: qty, unitId: draft.unitId, unitName, unitPrice: price },
          })),
        })),
      }));
      return true;
    } catch (err) {
      Alert.alert('Something went wrong', err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveExistingEdit = async (item) => {
    if (await performSave(item)) setEditMode(false);
  };

  const saveNewItem = async () => {
    const activity = activities.find((a) => a.id === addActivityId);
    const item = activity?.items.find((i) => i.id === addItemId);
    if (!item) return;
    if (await performSave(item)) {
      closeAdd();
      setExpandedActivityIds((prev) => new Set(prev).add(activity.id));
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 40 }} />;
  }
  if (error || !data) {
    return <Text style={styles.error}>{error || 'Could not load Expected Return.'}</Text>;
  }

  const activities = data.activities.map((a) => ({
    ...a,
    items: a.items.map((i) => (i.savedReturn && !i.savedReturn.unitName
      ? { ...i, savedReturn: { ...i.savedReturn, unitName: i.units.find((u) => u.id === i.savedReturn.unitId)?.name || '' } }
      : i)),
  }));
  return (
    <View>

      {data.isOngoing && !adding && (
        <Pressable style={styles.addButton} onPress={startAdd}>
          <Text style={styles.addButtonText}>+ Add Return</Text>
        </Pressable>
      )}
      {adding && (
        <AddReturnPanel
          activities={activities}
          currency={data.currency}
          addActivityId={addActivityId}
          addItemId={addItemId}
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onPickActivity={pickAddActivity}
          onPickItem={pickAddItem}
          onSave={saveNewItem}
          onCancel={closeAdd}
        />
      )}

      {activities.length === 0 ? (
        <Text style={styles.empty}>No Activity Return items are configured for this demo's country yet.</Text>
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
            onSave={saveExistingEdit}
            onDelete={deleteItem}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: COLORS.danger, marginTop: 20 },
  empty: { color: '#888', marginTop: 20 },
  emptyActivity: { color: COLORS.textMuted, fontSize: 13, marginBottom: 8 },
  addButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'flex-start', marginBottom: 20 },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  addPanel: { backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 14, marginBottom: 20 },
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
  totalPreviewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 14,
  },
  totalPreviewLabel: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '600' },
  totalPreviewValue: { color: COLORS.primaryDark, fontSize: 15, fontWeight: '700' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelButton: { backgroundColor: COLORS.danger, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  standaloneCancelButton: { backgroundColor: COLORS.danger, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', alignSelf: 'flex-start', marginTop: 12 },
  cancelButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  requiredNote: { color: COLORS.primary, fontSize: 11, marginTop: 10 },
});
