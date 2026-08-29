import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { listCountries, listStates, listDistricts, listBlocks, listVillages } from '../api';

export default function LocationPicker({ token, onVillageChange }) {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [villages, setVillages] = useState([]);

  const [countryId, setCountryId] = useState('');
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [villageId, setVillageId] = useState('');

  useEffect(() => {
    listCountries(token).then((d) => setCountries(d.countries)).catch(() => {});
  }, []);

  useEffect(() => {
    setStates([]);
    setStateId('');
    if (countryId) listStates(token, countryId).then((d) => setStates(d.states)).catch(() => {});
  }, [countryId]);

  useEffect(() => {
    setDistricts([]);
    setDistrictId('');
    if (stateId) listDistricts(token, stateId).then((d) => setDistricts(d.districts)).catch(() => {});
  }, [stateId]);

  useEffect(() => {
    setBlocks([]);
    setBlockId('');
    if (districtId) listBlocks(token, districtId).then((d) => setBlocks(d.blocks)).catch(() => {});
  }, [districtId]);

  useEffect(() => {
    setVillages([]);
    setVillageId('');
    if (blockId) listVillages(token, blockId).then((d) => setVillages(d.villages)).catch(() => {});
  }, [blockId]);

  useEffect(() => {
    onVillageChange(villageId || null);
  }, [villageId]);

  return (
    <View>
      <Text style={styles.label}>Country</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={countryId} onValueChange={setCountryId}>
          <Picker.Item label="-- select country --" value="" />
          {countries.map((c) => (
            <Picker.Item key={c.id} label={c.name} value={c.id} />
          ))}
        </Picker>
      </View>

      {countryId ? (
        <>
          <Text style={styles.label}>State</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={stateId} onValueChange={setStateId}>
              <Picker.Item label="-- select state --" value="" />
              {states.map((s) => (
                <Picker.Item key={s.id} label={s.name} value={s.id} />
              ))}
            </Picker>
          </View>
        </>
      ) : null}

      {stateId ? (
        <>
          <Text style={styles.label}>District</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={districtId} onValueChange={setDistrictId}>
              <Picker.Item label="-- select district --" value="" />
              {districts.map((d) => (
                <Picker.Item key={d.id} label={d.name} value={d.id} />
              ))}
            </Picker>
          </View>
        </>
      ) : null}

      {districtId ? (
        <>
          <Text style={styles.label}>Block</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={blockId} onValueChange={setBlockId}>
              <Picker.Item label="-- select block --" value="" />
              {blocks.map((b) => (
                <Picker.Item key={b.id} label={b.name} value={b.id} />
              ))}
            </Picker>
          </View>
        </>
      ) : null}

      {blockId ? (
        <>
          <Text style={styles.label}>Village</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={villageId} onValueChange={setVillageId}>
              <Picker.Item label="-- select village --" value="" />
              {villages.map((v) => (
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
