import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { listCrops, listVarieties } from '../api';

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
      <Text style={styles.label}>Crop</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={cropId} onValueChange={setCropId}>
          <Picker.Item label="-- select crop --" value="" />
          {crops.map((c) => (
            <Picker.Item key={c.id} label={c.name} value={c.id} />
          ))}
        </Picker>
      </View>

      {cropId ? (
        <>
          <Text style={styles.label}>Variety</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={varietyId} onValueChange={setVarietyId}>
              <Picker.Item label="-- select variety --" value="" />
              {varieties.map((v) => (
                <Picker.Item key={v.id} label={v.name} value={v.id} />
              ))}
            </Picker>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  pickerWrap: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8 },
});
