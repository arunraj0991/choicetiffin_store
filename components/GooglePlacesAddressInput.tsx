import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import COLORS from '@/constants/colors';

const PRIMARY = COLORS.primary;

type Prediction = {
  place_id: string;
  description: string;
};

type Props = {
  mapKey: string;
  value: string;
  placeholder?: string;
  error?: boolean;
  onSelect: (address: string, lat?: string, lng?: string) => void;
};

export default function GooglePlacesAddressInput({
  mapKey,
  value,
  placeholder = 'Search address…',
  error = false,
  onSelect,
}: Props) {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [fetching, setFetching] = useState(false);
  const [showList, setShowList] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const search = (text: string) => {
    setQuery(text);
    onSelect(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (!mapKey || !text.trim() || text.length < 3) {
      setPredictions([]);
      setShowList(false);
      return;
    }
    debounce.current = setTimeout(async () => {
      setFetching(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${mapKey}&language=en`;
        const res = await fetch(url);
        const json = await res.json();
        if (json.status === 'OK') {
          setPredictions(json.predictions ?? []);
          setShowList(true);
        } else {
          setPredictions([]);
          setShowList(false);
        }
      } catch {
        setPredictions([]);
        setShowList(false);
      } finally {
        setFetching(false);
      }
    }, 350);
  };

  const pick = async (pred: Prediction) => {
    setQuery(pred.description);
    setPredictions([]);
    setShowList(false);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${pred.place_id}&fields=geometry,formatted_address&key=${mapKey}`;
      const res = await fetch(url);
      const json = await res.json();
      const loc = json.result?.geometry?.location;
      const formatted = json.result?.formatted_address || pred.description;
      setQuery(formatted);
      onSelect(formatted, loc?.lat?.toString() ?? '', loc?.lng?.toString() ?? '');
    } catch {
      onSelect(pred.description, '', '');
    }
  };

  const clear = () => {
    setQuery('');
    setPredictions([]);
    setShowList(false);
    onSelect('', '', '');
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.inputRow, error && styles.inputError]}>
        <MaterialIcons name="place" size={18} color="#9ca3af" style={{ marginRight: 6 }} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={search}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {fetching ? (
          <ActivityIndicator size="small" color={PRIMARY} style={{ marginLeft: 6 }} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={clear} hitSlop={8}>
            <MaterialIcons name="close" size={16} color="#9ca3af" />
          </TouchableOpacity>
        ) : null}
      </View>

      {showList && predictions.length > 0 && (
        <View style={styles.suggBox}>
          {predictions.map(p => (
            <TouchableOpacity key={p.place_id} style={styles.suggRow} onPress={() => pick(p)}>
              <MaterialIcons name="place" size={14} color={PRIMARY} style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={styles.suggTxt} numberOfLines={2}>{p.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 20 },
  inputRow: {
    minHeight: 50,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputError: { borderColor: COLORS.danger, borderWidth: 1.5 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 12,
  },
  suggBox: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    maxHeight: 220,
  },
  suggRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggTxt: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
});
