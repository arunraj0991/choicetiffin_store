import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { useSafeHeaderPad } from '@/components/SafeScreen';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import COLORS from '@/constants/colors';
import {
  storeMealDelete,
  storeMeals,
  storeMealStatus,
  storeMealStore,
  storeMealUpdate,
} from '@/src/api/api';

const PRIMARY    = COLORS.primary;
const FOOD_TYPES = ['Veg', 'NonVeg', 'Vegan'];

interface Cate { id: number | string; name: string; }
interface Meal {
  id:            number | string;
  name:          string;
  description:   string | null;
  price:         number | string;
  delivery_fee:  number | string | null;
  duration_days: number | string;
  food_type:     string;
  cate_id:       string[];
  status:        number;
  img:           string | null;
  calories:      string | null;
  protein:       string | null;
  fat:           string | null;
  carbs:         string | null;
  fiber:         string | null;
  sugar:         string | null;
  tags:          string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function foodColor(type: string) {
  if (type === 'Veg')   return { text: '#16a34a', bg: '#dcfce7' };
  if (type === 'Vegan') return { text: '#0891b2', bg: '#cffafe' };
  return { text: '#dc2626', bg: '#fee2e2' };
}

function FoodBadge({ type }: { type: string }) {
  const c = foodColor(type);
  return (
    <View style={[s.foodBadge, { backgroundColor: c.bg }]}>
      <View style={[s.foodDot, { backgroundColor: c.text }]} />
      <Text style={[s.foodText, { color: c.text }]}>{type}</Text>
    </View>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({ meal, imgBase, currency, onClose, onEdit, onDelete, onToggle }: {
  meal:      Meal;
  imgBase:   string;
  currency:  string;
  onClose:   () => void;
  onEdit:    () => void;
  onDelete:  () => void;
  onToggle:  () => void;
}) {
  const hasNutrition = meal.calories || meal.protein || meal.fat || meal.carbs || meal.fiber || meal.sugar;

  const Row = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <View style={s.detailRow}>
      <MaterialIcons name={icon as any} size={16} color="#94a3b8" />
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={s.detailSheet}>
          <View style={s.detailHandle} />

          {/* Image + name */}
          <View style={s.detailTop}>
            {meal.img ? (
              <Image
                source={{ uri: `${imgBase}/${meal.img}` }}
                style={s.detailImg}
                resizeMode="cover"
              />
            ) : (
              <View style={[s.detailImg, s.detailImgPlaceholder]}>
                <MaterialIcons name="restaurant" size={32} color="#cbd5e1" />
              </View>
            )}
            <View style={s.detailNameWrap}>
              <Text style={s.detailName}>{meal.name}</Text>
              <View style={s.detailBadgeRow}>
                <FoodBadge type={meal.food_type} />
                <TouchableOpacity
                  style={[s.statusBadge, meal.status === 0 ? s.statusActive : s.statusOff]}
                  onPress={onToggle}
                >
                  <MaterialIcons name={meal.status === 0 ? 'visibility' : 'visibility-off'} size={11} color={meal.status === 0 ? '#16a34a' : '#94a3b8'} />
                  <Text style={[s.statusText, { color: meal.status === 0 ? '#16a34a' : '#94a3b8' }]}>
                    {meal.status === 0 ? 'Active' : 'Disabled'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>

            {/* Categories */}
            {meal.cate_id?.length > 0 && (
              <View style={s.catePills}>
                {meal.cate_id.map((c, i) => (
                  <View key={i} style={s.catePill}>
                    <Text style={s.catePillText}>{c}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Description */}
            {meal.description ? <Text style={s.detailDesc}>{meal.description}</Text> : null}

            {/* Key stats */}
            <View style={s.statsBox}>
              <View style={s.statItem}>
                <Text style={s.statVal}>{currency}{meal.price}</Text>
                <Text style={s.statLbl}>Price</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statVal}>{meal.duration_days} days</Text>
                <Text style={s.statLbl}>Duration</Text>
              </View>
              {meal.delivery_fee != null && String(meal.delivery_fee) !== '' && (
                <>
                  <View style={s.statDivider} />
                  <View style={s.statItem}>
                    <Text style={s.statVal}>{currency}{meal.delivery_fee}</Text>
                    <Text style={s.statLbl}>Delivery Fee</Text>
                  </View>
                </>
              )}
            </View>

            {/* Nutritional info */}
            {hasNutrition && (
              <View style={s.nutritionBox}>
                <Text style={s.nutritionTitle}>Nutritional Info</Text>
                <View style={s.nutritionGrid}>
                  {[
                    ['Calories', meal.calories],
                    ['Protein',  meal.protein],
                    ['Fat',      meal.fat],
                    ['Carbs',    meal.carbs],
                    ['Fiber',    meal.fiber],
                    ['Sugar',    meal.sugar],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <View key={label} style={s.nutritionItem}>
                      <Text style={s.nutritionVal}>{value}</Text>
                      <Text style={s.nutritionLbl}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Tags */}
            {meal.tags ? (
              <View style={s.tagsRow}>
                <MaterialIcons name="label" size={14} color="#94a3b8" />
                <Text style={s.tagsText}>{meal.tags}</Text>
              </View>
            ) : null}

          </ScrollView>

          {/* Action buttons */}
          <View style={s.detailActions}>
            <TouchableOpacity style={s.deleteBtn} onPress={onDelete}>
              <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
              <Text style={s.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.editBtn} onPress={onEdit}>
              <MaterialIcons name="edit" size={18} color="#fff" />
              <Text style={s.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Form Modal ────────────────────────────────────────────────────────────────

function MealFormModal({ visible, editing, cates, currency, onClose, onSaved }: {
  visible:  boolean;
  editing:  Meal | null;
  cates:    Cate[];
  currency: string;
  onClose:  () => void;
  onSaved:  () => void;
}) {
  const [section,      setSection]      = useState<'basic' | 'nutrition'>('basic');
  const [name,         setName]         = useState('');
  const [description,  setDescription]  = useState('');
  const [price,        setPrice]        = useState('');
  const [deliveryFee,  setDeliveryFee]  = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [foodType,     setFoodType]     = useState('Veg');
  const [cateIds,      setCateIds]      = useState<string[]>([]);
  const [calories,     setCalories]     = useState('');
  const [protein,      setProtein]      = useState('');
  const [fat,          setFat]          = useState('');
  const [carbs,        setCarbs]        = useState('');
  const [fiber,        setFiber]        = useState('');
  const [sugar,        setSugar]        = useState('');
  const [tags,         setTags]         = useState('');
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    if (visible) {
      setSection('basic');
      setName(editing?.name ?? '');
      setDescription(editing?.description ?? '');
      setPrice(editing?.price != null ? String(editing.price) : '');
      setDeliveryFee(editing?.delivery_fee != null ? String(editing.delivery_fee) : '');
      setDurationDays(editing?.duration_days != null ? String(editing.duration_days) : '');
      setFoodType(editing?.food_type ?? 'Veg');
      setCateIds(editing?.cate_id ?? []);
      setCalories(editing?.calories ?? '');
      setProtein(editing?.protein ?? '');
      setFat(editing?.fat ?? '');
      setCarbs(editing?.carbs ?? '');
      setFiber(editing?.fiber ?? '');
      setSugar(editing?.sugar ?? '');
      setTags(editing?.tags ?? '');
    }
  }, [visible, editing]);

  const toggleCate = (name: string) =>
    setCateIds(p => p.includes(name) ? p.filter(x => x !== name) : [...p, name]);

  const submit = async () => {
    if (!name.trim())         { Alert.alert('Error', 'Meal name is required.'); return; }
    if (!price.trim())        { Alert.alert('Error', 'Price is required.'); return; }
    if (!durationDays.trim()) { Alert.alert('Error', 'Duration days is required.'); return; }
    if (cateIds.length === 0) { Alert.alert('Error', 'Select at least one category.'); return; }
    setSaving(true);
    try {
      const payload = {
        name, description, price, delivery_fee: deliveryFee,
        duration_days: durationDays, food_type: foodType,
        'cate_id[]': cateIds,
        calories, protein, fat, carbs, fiber, sugar, tags,
      };
      editing ? await storeMealUpdate(editing.id, payload) : await storeMealStore(payload);
      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const Inp = ({ value, setter, opts }: { value: string; setter: (v: string) => void; opts?: Partial<React.ComponentProps<typeof TextInput>> }) => (
    <TextInput style={s.input} value={value} onChangeText={setter} placeholderTextColor="#94a3b8" {...opts} />
  );

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={s.field}><Text style={s.label}>{label}</Text>{children}</View>
  );

  const formHeaderPad = useSafeHeaderPad();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.formRoot}>
        <StatusBar style="light" />
        <View style={[s.formHeader, { paddingTop: formHeaderPad }]}>
          <TouchableOpacity style={s.backBtn} onPress={onClose}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.formTitle}>{editing ? 'Edit Meal Plan' : 'Add Meal Plan'}</Text>
          <TouchableOpacity style={s.saveIconBtn} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="check" size={22} color="#fff" />}
          </TouchableOpacity>
        </View>

        <View style={s.sectionTabs}>
          {(['basic', 'nutrition'] as const).map(sec => (
            <TouchableOpacity key={sec} style={[s.sectionTab, section === sec && s.sectionTabActive]} onPress={() => setSection(sec)}>
              <Text style={[s.sectionTabText, section === sec && s.sectionTabTextActive]}>
                {sec === 'basic' ? 'Basic Info' : 'Nutritional Info'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {section === 'basic' && (
              <>
                <Field label="Category *">
                  <View style={s.cateGrid}>
                    {cates.map(c => {
                      const sel = cateIds.includes(c.name);
                      return (
                        <TouchableOpacity key={c.id} style={[s.cateChip, sel && s.cateChipOn]} onPress={() => toggleCate(c.name)}>
                          <Text style={[s.cateChipText, sel && { color: PRIMARY }]}>{c.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {cates.length === 0 && <Text style={{ color: '#94a3b8', fontSize: 13 }}>No categories. Add from Options → Manage Category.</Text>}
                  </View>
                </Field>

                <Field label="Meal Name *">
                  <Inp value={name} setter={setName} opts={{ placeholder: 'e.g. Classic Veg Tiffin' }} />
                </Field>

                <Field label="Description">
                  <Inp value={description} setter={setDescription} opts={{ placeholder: 'Brief description…', multiline: true, style: [s.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }] }} />
                </Field>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Field label={`Price (${currency}) *`}>
                      <Inp value={price} setter={setPrice} opts={{ placeholder: '0.00', keyboardType: 'decimal-pad' }} />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Duration (days) *">
                      <Inp value={durationDays} setter={setDurationDays} opts={{ placeholder: '30', keyboardType: 'numeric' }} />
                    </Field>
                  </View>
                </View>

                <Field label={`Delivery Fee (${currency})`}>
                  <Inp value={deliveryFee} setter={setDeliveryFee} opts={{ placeholder: '0.00', keyboardType: 'decimal-pad' }} />
                </Field>

                <Field label="Food Type *">
                  <View style={s.foodTypeRow}>
                    {FOOD_TYPES.map(t => {
                      const c   = foodColor(t);
                      const sel = foodType === t;
                      return (
                        <TouchableOpacity key={t} style={[s.foodTypeBtn, sel && { backgroundColor: c.bg, borderColor: c.text }]} onPress={() => setFoodType(t)}>
                          <View style={[s.foodDot, { backgroundColor: c.text }]} />
                          <Text style={[s.foodTypeBtnText, sel && { color: c.text }]}>{t}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Field>

                <Field label="Search Tags">
                  <Inp value={tags} setter={setTags} opts={{ placeholder: 'e.g. keto, weight loss, protein rich' }} />
                </Field>
              </>
            )}

            {section === 'nutrition' && (
              <>
                <View style={s.nutritionHint}>
                  <MaterialIcons name="info-outline" size={15} color={PRIMARY} />
                  <Text style={s.nutritionHintText}>All nutritional fields are optional</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}><Field label="Calories"><Inp value={calories} setter={setCalories} opts={{ placeholder: 'e.g. 412', keyboardType: 'numeric' }} /></Field></View>
                  <View style={{ flex: 1 }}><Field label="Protein"><Inp value={protein} setter={setProtein} opts={{ placeholder: 'e.g. 18g' }} /></Field></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}><Field label="Fat"><Inp value={fat} setter={setFat} opts={{ placeholder: 'e.g. 12g' }} /></Field></View>
                  <View style={{ flex: 1 }}><Field label="Carbs"><Inp value={carbs} setter={setCarbs} opts={{ placeholder: 'e.g. 55g' }} /></Field></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}><Field label="Fiber"><Inp value={fiber} setter={setFiber} opts={{ placeholder: 'e.g. 4g' }} /></Field></View>
                  <View style={{ flex: 1 }}><Field label="Sugar"><Inp value={sugar} setter={setSugar} opts={{ placeholder: 'e.g. 2g' }} /></Field></View>
                </View>
              </>
            )}

          </ScrollView>
        </KeyboardAvoidingView>

        <View style={s.formFooter}>
          {section === 'basic'
            ? <TouchableOpacity style={s.nextBtn} onPress={() => setSection('nutrition')}>
                <Text style={s.nextBtnText}>Nutritional Info</Text>
                <MaterialIcons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            : <TouchableOpacity style={s.nextBtn} onPress={submit} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><MaterialIcons name="check" size={18} color="#fff" /><Text style={s.nextBtnText}>{editing ? 'Update Meal' : 'Add Meal'}</Text></>}
              </TouchableOpacity>}
        </View>
      </View>
    </Modal>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MealPlans() {
  const headerPad = useSafeHeaderPad();
  const router = useRouter();

  const [meals,      setMeals]      = useState<Meal[]>([]);
  const [cates,      setCates]      = useState<Cate[]>([]);
  const [currency,   setCurrency]   = useState('');
  const [imgBase,    setImgBase]    = useState('');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [detail,     setDetail]     = useState<Meal | null>(null);
  const [showForm,   setShowForm]   = useState(false);
  const [editing,    setEditing]    = useState<Meal | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await storeMeals();
      setMeals(res.data?.meals ?? []);
      setCates(res.data?.cates ?? []);
      setCurrency(res.data?.currency ?? '');
      setImgBase(res.data?.img_base ?? '');
    } catch {
      Alert.alert('Error', 'Failed to load meals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openAdd  = () => { setEditing(null); setShowForm(true); };
  const openEdit = (m: Meal) => { setDetail(null); setEditing(m); setShowForm(true); };

  const toggleStatus = async (m: Meal) => {
    try {
      await storeMealStatus(m.id);
      const updated = { ...m, status: m.status === 0 ? 1 : 0 };
      setMeals(prev => prev.map(x => x.id === m.id ? updated : x));
      setDetail(prev => prev?.id === m.id ? updated : prev);
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    }
  };

  const confirmDelete = (m: Meal) => {
    Alert.alert('Delete Meal', `Delete "${m.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await storeMealDelete(m.id);
            setMeals(prev => prev.filter(x => x.id !== m.id));
            setDetail(null);
          } catch {
            Alert.alert('Error', 'Failed to delete. It may be in use by an active subscription.');
          }
        },
      },
    ]);
  };

  const filtered = meals.filter(m =>
    !search.trim() || m.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      <View style={[s.header, { paddingTop: headerPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Meal Plans</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <MaterialIcons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <MaterialIcons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search meal plans…"
          placeholderTextColor="#94a3b8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
        >
          {filtered.length === 0 && (
            <View style={s.empty}>
              <MaterialIcons name="restaurant-menu" size={52} color="#cbd5e1" />
              <Text style={s.emptyTitle}>{search ? 'No results found' : 'No meal plans yet'}</Text>
              <Text style={s.emptySub}>{search ? 'Try a different search term' : 'Tap + to add your first meal plan'}</Text>
              {!search && (
                <TouchableOpacity style={s.emptyBtn} onPress={openAdd}>
                  <MaterialIcons name="add" size={16} color="#fff" />
                  <Text style={s.emptyBtnText}>Add Meal Plan</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {filtered.map(m => (
            <TouchableOpacity key={m.id} style={s.card} activeOpacity={0.8} onPress={() => setDetail(m)}>
              {/* Meal image */}
              {m.img ? (
                <Image source={{ uri: `${imgBase}/${m.img}` }} style={s.cardImg} resizeMode="cover" />
              ) : (
                <View style={[s.cardImg, s.cardImgPlaceholder]}>
                  <MaterialIcons name="restaurant" size={24} color="#cbd5e1" />
                </View>
              )}

              {/* Name */}
              <View style={s.cardInfo}>
                <Text style={s.cardName} numberOfLines={2}>{m.name}</Text>
                <FoodBadge type={m.food_type} />
              </View>

              {/* Status toggle */}
              <TouchableOpacity
                style={[s.toggle, m.status === 0 ? s.toggleOn : s.toggleOff]}
                onPress={() => toggleStatus(m)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={[s.toggleThumb, m.status === 0 ? s.toggleThumbOn : s.toggleThumbOff]} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Detail modal */}
      {detail && (
        <DetailModal
          meal={detail}
          imgBase={imgBase}
          currency={currency}
          onClose={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
          onDelete={() => confirmDelete(detail)}
          onToggle={() => toggleStatus(detail)}
        />
      )}

      {/* Form modal */}
      <MealFormModal
        visible={showForm}
        editing={editing}
        cates={cates}
        currency={currency}
        onClose={() => setShowForm(false)}
        onSaved={load}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.secondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header:      { backgroundColor: PRIMARY, paddingBottom: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '800' },
  addBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 14, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', padding: 0 },

  // ── List ──────────────────────────────────────────────────────────────────
  list: { paddingHorizontal: 14, paddingBottom: 40, gap: 10 },

  card:             { backgroundColor: '#fff', borderRadius: 16, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  cardImg:          { width: 60, height: 60, borderRadius: 12 },
  cardImgPlaceholder:{ backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  cardInfo:         { flex: 1, gap: 5 },
  cardName:         { fontSize: 14, fontWeight: '700', color: '#0f172a', lineHeight: 20 },

  // Food type badge
  foodBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, alignSelf: 'flex-start' },
  foodDot:   { width: 6, height: 6, borderRadius: 3 },
  foodText:  { fontSize: 10, fontWeight: '700' },

  // Toggle switch
  toggle:         { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  toggleOn:       { backgroundColor: PRIMARY },
  toggleOff:      { backgroundColor: '#e2e8f0' },
  toggleThumb:    { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  toggleThumbOn:  { alignSelf: 'flex-end' },
  toggleThumbOff: { alignSelf: 'flex-start' },

  // Empty
  empty:       { alignItems: 'center', paddingVertical: 80 },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: '#0f172a', marginTop: 16 },
  emptySub:    { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  emptyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11, marginTop: 24 },
  emptyBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Detail modal ──────────────────────────────────────────────────────────
  modalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  detailSheet:  { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  detailHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginBottom: 18 },

  detailTop:      { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  detailImg:      { width: 80, height: 80, borderRadius: 16 },
  detailImgPlaceholder: { backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  detailNameWrap: { flex: 1, gap: 6 },
  detailName:     { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  detailBadgeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  statusBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusActive: { backgroundColor: '#dcfce7' },
  statusOff:    { backgroundColor: '#f1f5f9' },
  statusText:   { fontSize: 11, fontWeight: '700' },

  catePills:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  catePill:     { backgroundColor: '#f0ebff', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catePillText: { fontSize: 11, fontWeight: '600', color: PRIMARY },

  detailDesc: { fontSize: 13, color: '#64748b', lineHeight: 20, marginBottom: 14 },

  statsBox:    { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, marginBottom: 14 },
  statItem:    { flex: 1, alignItems: 'center' },
  statVal:     { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  statLbl:     { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  statDivider: { width: 1, backgroundColor: '#e2e8f0', marginHorizontal: 4 },

  nutritionBox:   { backgroundColor: '#f0ebff', borderRadius: 14, padding: 14, marginBottom: 14 },
  nutritionTitle: { fontSize: 13, fontWeight: '800', color: PRIMARY, marginBottom: 10 },
  nutritionGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nutritionItem:  { alignItems: 'center', minWidth: 64 },
  nutritionVal:   { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  nutritionLbl:   { fontSize: 10, color: '#64748b', fontWeight: '600', marginTop: 2 },

  tagsRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagsText: { fontSize: 12, color: '#94a3b8', flex: 1, fontStyle: 'italic' },

  detailRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  detailLabel: { flex: 1, fontSize: 13, color: '#64748b' },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#0f172a' },

  detailActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  deleteBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5, borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
  editBtn:       { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13, borderRadius: 14, backgroundColor: PRIMARY },
  editBtnText:   { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Form modal ─────────────────────────────────────────────────────────────
  formRoot:   { flex: 1, backgroundColor: COLORS.secondary },
  formHeader: { backgroundColor: PRIMARY, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  formTitle:  { flex: 1, color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  saveIconBtn:{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  sectionTabs:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionTab:          { flex: 1, paddingVertical: 12, alignItems: 'center' },
  sectionTabActive:    { borderBottomWidth: 2.5, borderBottomColor: PRIMARY },
  sectionTabText:      { fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  sectionTabTextActive:{ color: PRIMARY },

  formScroll: { padding: 16, paddingBottom: 24 },
  field:      { marginBottom: 16 },
  label:      { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:      { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0f172a' },

  cateGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cateChip:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  cateChipOn:   { backgroundColor: '#f0ebff', borderColor: PRIMARY },
  cateChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },

  foodTypeRow:     { flexDirection: 'row', gap: 10 },
  foodTypeBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  foodTypeBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },

  nutritionHint:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0ebff', borderRadius: 10, padding: 12, marginBottom: 16 },
  nutritionHintText: { fontSize: 12, color: PRIMARY, flex: 1 },

  formFooter: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  nextBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14 },
  nextBtnText:{ color: '#fff', fontSize: 15, fontWeight: '800' },
});
