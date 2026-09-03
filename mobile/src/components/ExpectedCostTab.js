import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getExpectedCost, saveExpectedCostItem, deleteExpectedCostItem } from '../api';
import SearchableSelect from './SearchableSelect';
import NumberField from './NumberField';
import { COLORS } from '../theme';

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

// Shared by both an existing item's inline "Edit" form and the top-level
// "Add Cost" panel - same fields, same Save/Cancel, just a different item
// and different callbacks wired in by the caller.
function CostEntryForm({ item, currency, draft, setDraft, onSave, onCancel, saving }) {
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
            <CostEntryForm item={item} currency={currency} draft={draft} setDraft={setDraft} onSave={() => onSave(item)} onCancel={() => onCancel(item)} saving={saving} />
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
}) {
  const savedItems = activity.items.filter((i) => i.savedCost);

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
            <Text style={styles.emptyActivity}>No costs added yet for this activity.</Text>
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

// The "+ Add Cost" panel: pick an Activity, then an Item configured under
// it (excluding ones already saved for this demo), then the same fields
// CostEntryForm uses everywhere else.
function AddCostPanel({ activities, currency, addActivityId, addItemId, draft, setDraft, saving, onPickActivity, onPickItem, onSave, onCancel }) {
  const activityOptions = activities.map((a) => ({ id: a.id, name: a.name }));
  const selectedActivity = activities.find((a) => a.id === addActivityId);
  const itemOptions = selectedActivity ? selectedActivity.items.filter((i) => !i.savedCost) : [];
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
        <CostEntryForm item={selectedItem} currency={currency} draft={draft} setDraft={setDraft} onSave={onSave} onCancel={onCancel} saving={saving} />
      )}
      {!selectedItem && (
        <Pressable style={styles.standaloneCancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

// The Business Plan -> Expected Cost tab: Activities/Items come entirely
// from the Super Admin's Activity Cost master data (scoped to this demo's
// own country), never hardcoded here.
//
// Exposes `openAdd` via ref so the floating "+" button lives at the
// TfoDemoDetailScreen level (a sibling of the page's ScrollView, matching
// the app's established FAB convention - fixed to the screen, not
// scrolling away with content) while the actual add-flow state stays
// local to this component, which is the one that knows how to drive it.
const ExpectedCostTab = forwardRef(function ExpectedCostTab({ token, demoId, onTotalChange }, ref) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedActivityIds, setExpandedActivityIds] = useState(() => new Set());
  const [openItemId, setOpenItemId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addActivityId, setAddActivityId] = useState(null);
  const [addItemId, setAddItemId] = useState(null);
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

  // Reports the overall total up to BusinessPlanTab (-> the demo summary
  // card's Cost KPI) whenever `data` actually changes - load, save, or
  // delete, never on an unrelated parent re-render, since this only
  // depends on `data` itself, not on the onTotalChange reference.
  useEffect(() => {
    if (!onTotalChange) return;
    if (!data) {
      onTotalChange(0, null);
      return;
    }
    const total = data.activities.reduce(
      (sum, a) => sum + a.items.reduce((s, i) => s + itemTotal(i.savedCost), 0),
      0,
    );
    onTotalChange(total, data.currency);
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
      quantity: String(item.savedCost.quantity),
      unitId: item.savedCost.unitId,
      farmerPrice: String(item.savedCost.farmerPrice),
      loanPrice: String(item.savedCost.loanPrice),
    });
  };

  const cancelEdit = (item) => {
    if (item.savedCost) {
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

  useImperativeHandle(ref, () => ({ openAdd: startAdd }));

  const pickAddActivity = (activityId) => {
    setAddActivityId(activityId);
    setAddItemId(null);
  };
  const pickAddItem = (itemId) => {
    setAddItemId(itemId);
    setDraft({ quantity: '', unitId: null, farmerPrice: '', loanPrice: '' });
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

  // Shared by the existing-item Edit form and the Add Cost panel - both
  // just upsert by itemId, which is what implements the "consolidate
  // duplicate item" rule (same Activity + Item always overwrites the one
  // saved row instead of creating another).
  const performSave = async (item) => {
    const qty = Number(draft.quantity);
    const farmer = Number(draft.farmerPrice);
    const loan = Number(draft.loanPrice);
    if (draft.quantity === '' || Number.isNaN(qty) || qty < 0) {
      Alert.alert('Missing information', 'Expected Quantity must be a number that is 0 or more.');
      return false;
    }
    if (!draft.unitId) {
      Alert.alert('Missing information', 'Please select a Unit.');
      return false;
    }
    if (draft.farmerPrice === '' || Number.isNaN(farmer) || farmer < 0) {
      Alert.alert('Missing information', 'Farmer Expected Price must be a number that is 0 or more.');
      return false;
    }
    if (draft.loanPrice === '' || Number.isNaN(loan) || loan < 0) {
      Alert.alert('Missing information', 'Loan Expected Price must be a number that is 0 or more.');
      return false;
    }

    setSaving(true);
    try {
      await saveExpectedCostItem(token, demoId, { itemId: item.id, quantity: qty, unitId: draft.unitId, farmerPrice: farmer, loanPrice: loan });
      const unitName = item.units.find((u) => u.id === draft.unitId)?.name || '';
      setData((prev) => ({
        ...prev,
        activities: prev.activities.map((a) => ({
          ...a,
          items: a.items.map((i) => (i.id !== item.id ? i : {
            ...i,
            savedCost: { quantity: qty, unitId: draft.unitId, unitName, farmerPrice: farmer, loanPrice: loan },
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
  return (
    <View>
      {adding && (
        <AddCostPanel
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
            onSave={saveExistingEdit}
            onDelete={deleteItem}
          />
        ))
      )}
    </View>
  );
});

export default ExpectedCostTab;

const styles = StyleSheet.create({
  error: { color: COLORS.danger, marginTop: 20 },
  empty: { color: '#888', marginTop: 20 },
  emptyActivity: { color: COLORS.textMuted, fontSize: 13, marginBottom: 8 },
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
  priceRow: { flexDirection: 'row', gap: 12 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 28, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelButton: { backgroundColor: COLORS.danger, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center' },
  standaloneCancelButton: { backgroundColor: COLORS.danger, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', alignSelf: 'flex-start', marginTop: 12 },
  cancelButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  requiredNote: { color: COLORS.primary, fontSize: 11, marginTop: 10 },
});
