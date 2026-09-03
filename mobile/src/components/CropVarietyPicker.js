import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { listCrops, listVarieties } from '../api';
import SearchableSelect from './SearchableSelect';

// `initialCropId`/`initialVarietyId` (optional) prefill the selection
// without locking it - for editing an existing record. Ordinary use (no
// initial values) is completely unaffected.
export default function CropVarietyPicker({ token, onChange, initialCropId, initialVarietyId }) {
  const [crops, setCrops] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [cropId, setCropId] = useState(initialCropId || '');
  const [varietyId, setVarietyId] = useState(initialVarietyId || '');
  // The crop-changed effect below normally clears varietyId - that's right
  // when the user actively picks a different crop, but wrong on the very
  // first run, where it would immediately wipe out an initialVarietyId
  // prefill before the user has touched anything.
  const isFirstCropEffect = useRef(true);

  useEffect(() => {
    listCrops(token).then((d) => setCrops(d.crops)).catch(() => {});
  }, []);

  useEffect(() => {
    if (isFirstCropEffect.current) {
      isFirstCropEffect.current = false;
      if (cropId) listVarieties(token, cropId).then((d) => setVarieties(d.varieties)).catch(() => {});
      return;
    }
    setVarieties([]);
    setVarietyId('');
    if (cropId) listVarieties(token, cropId).then((d) => setVarieties(d.varieties)).catch(() => {});
  }, [cropId]);

  useEffect(() => {
    onChange({ cropId: cropId || null, varietyId: varietyId || null });
  }, [cropId, varietyId]);

  return (
    <View>
      <SearchableSelect
        label="Crop"
        placeholder="-- select crop --"
        options={crops}
        value={cropId}
        onChange={setCropId}
      />

      {cropId ? (
        <SearchableSelect
          label="Variety"
          placeholder="-- select variety --"
          options={varieties}
          value={varietyId}
          onChange={setVarietyId}
        />
      ) : null}
    </View>
  );
}
