import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { listCrops, listVarieties } from '../api';
import SearchableSelect from './SearchableSelect';

export default function CropVarietyPicker({ token, onChange }) {
  const [crops, setCrops] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [cropId, setCropId] = useState('');
  const [varietyId, setVarietyId] = useState('');

  useEffect(() => {
    listCrops(token).then((d) => setCrops(d.crops)).catch(() => {});
  }, []);

  useEffect(() => {
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
