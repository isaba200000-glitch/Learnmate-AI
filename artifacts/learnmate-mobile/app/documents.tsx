import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListDocuments,
  useGetDocument,
  getListDocumentsQueryKey,
  getGetDocumentQueryKey,
} from '@workspace/api-client-react';
import { apiFetch } from '@/lib/api';
import colors from '@/constants/colors';

const C = colors.dark;

// ─── Document detail panel ────────────────────────────────────────────────────

interface DetailProps {
  id: number;
  onDeleted: () => void;
}

function DocumentDetail({ id, onDeleted }: DetailProps) {
  const queryClient = useQueryClient();
  const [analysing, setAnalysing] = useState(false);

  const { data: doc, isLoading } = useGetDocument(id, {
    query: { queryKey: getGetDocumentQueryKey(id) },
  });

  const handleAnalyse = useCallback(async () => {
    setAnalysing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await apiFetch(`/api/documents/${id}/process`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: getGetDocumentQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Analysis failed', err?.message ?? 'Please try again.');
    } finally {
      setAnalysing(false);
    }
  }, [id, queryClient]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Document', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
            queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
            onDeleted();
          } catch {
            Alert.alert('Delete failed', 'Please try again.');
          }
        },
      },
    ]);
  }, [id, queryClient, onDeleted]);

  if (isLoading) {
    return <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />;
  }
  if (!doc) return null;

  const isProcessed = doc.status === 'processed';

  return (
    <View style={styles.detailCard}>
      {/* Title row */}
      <View style={styles.detailHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailTitle} numberOfLines={2}>{doc.title}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, isProcessed ? styles.statusDone : styles.statusPending]}>
              <Text style={[styles.statusText, isProcessed ? styles.statusTextDone : styles.statusTextPending]}>
                {isProcessed ? 'Analysed' : doc.status}
              </Text>
            </View>
            <Text style={styles.filenameText} numberOfLines={1}>{doc.filename}</Text>
          </View>
        </View>
        <Pressable onPress={handleDelete} hitSlop={12} style={styles.deleteBtn}>
          <Feather name="trash-2" size={16} color={C.destructive} />
        </Pressable>
      </View>

      {isProcessed && doc.summary ? (
        <View style={styles.resultsArea}>
          {/* Readability report */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Feather name="bar-chart-2" size={15} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Readability Report</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{doc.summary}</Text>
            </View>
          </View>

          {/* Keywords */}
          {doc.keyConcepts && doc.keyConcepts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Feather name="hash" size={15} color="#10B981" />
                <Text style={styles.sectionTitle}>Top Keywords</Text>
              </View>
              <View style={styles.keywordsWrap}>
                {(doc.keyConcepts as string[]).map((kw, i) => (
                  <View key={i} style={styles.keywordPill}>
                    <Text style={styles.keywordText}>{kw}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Original content */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Feather name="book-open" size={15} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Document Content</Text>
            </View>
            <ScrollView
              style={styles.contentBox}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <Text style={styles.contentText}>{doc.content}</Text>
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={styles.readyState}>
          <View style={styles.readyIcon}>
            <Feather name="bar-chart-2" size={28} color={C.primary} />
          </View>
          <Text style={styles.readyTitle}>Ready to analyse</Text>
          <Text style={styles.readyText}>
            Run the analysis to get a readability grade, reading time estimate, and the top keywords from your document.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.analyseBtn, pressed && { opacity: 0.8 }]}
            onPress={handleAnalyse}
            disabled={analysing}
          >
            {analysing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="zap" size={16} color="#fff" />
                <Text style={styles.analyseBtnText}>Analyse Document</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Add document modal ───────────────────────────────────────────────────────

interface AddModalProps {
  visible: boolean;
  onClose: () => void;
  onAdded: (id: number) => void;
}

function AddDocumentModal({ visible, onClose, onAdded }: AddModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    if (!visible) { setTitle(''); setContent(''); }
  }, [visible]);

  const handleSave = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const doc = await apiFetch<{ id: number }>('/api/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          filename: `${title.trim().toLowerCase().replace(/\s+/g, '-')}.txt`,
          content: content.trim(),
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAdded(doc.id);
    } catch (err: any) {
      Alert.alert('Save failed', err?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [title, content, queryClient, onAdded]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Document</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Feather name="x" size={22} color={C.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalBody}>
            <Text style={styles.fieldLabel}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.titleInput}
              placeholder="e.g. Chapter 3 – The Water Cycle"
              placeholderTextColor={C.mutedForeground}
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>
              Content <Text style={styles.required}>*</Text>
              <Text style={styles.fieldHint}> — paste your notes or study text here</Text>
            </Text>
            <TextInput
              style={styles.contentInput}
              placeholder="Paste your textbook excerpt, lecture notes, or any study material here…"
              placeholderTextColor={C.mutedForeground}
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.wordCount}>{wordCount.toLocaleString()} words</Text>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
            onPress={onClose}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.saveDocBtn,
              (!title.trim() || !content.trim()) && styles.saveDocBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
            onPress={handleSave}
            disabled={!title.trim() || !content.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveDocText}>Save Document</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [addVisible, setAddVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const topPad = insets.top + 16 + (Platform.OS === 'web' ? 67 : 0);
  const botPad = insets.bottom + 24;

  useEffect(() => {
    navigation.setOptions({ title: 'Document Analyser' });
  }, [navigation]);

  const { data: docs, isLoading, refetch } = useListDocuments({
    query: { queryKey: getListDocumentsQueryKey() },
  });

  const handleAdded = useCallback((id: number) => {
    setAddVisible(false);
    setSelectedId(id);
  }, []);

  const handleDeleted = useCallback(() => {
    setSelectedId(null);
  }, []);

  const renderDoc = useCallback(({ item }: { item: NonNullable<typeof docs>[number] }) => {
    const isSelected = selectedId === item.id;
    const isAnalysed = item.status === 'processed';
    return (
      <Pressable
        style={({ pressed }) => [
          styles.docCard,
          isSelected && styles.docCardSelected,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedId(isSelected ? null : item.id);
        }}
      >
        <View style={[styles.docIconBox, isSelected && styles.docIconBoxSelected]}>
          <Feather name="file-text" size={18} color={isSelected ? '#fff' : C.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.docTitle, isSelected && styles.docTitleSelected]} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[
            styles.docBadge,
            isAnalysed ? styles.docBadgeDone : styles.docBadgePending,
            isSelected && styles.docBadgeOnSelected,
          ]}>
            <Text style={[styles.docBadgeText, isSelected && styles.docBadgeTextOnSelected]}>
              {isAnalysed ? 'Analysed' : item.status}
            </Text>
          </View>
        </View>
        <Feather
          name={isSelected ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={isSelected ? 'rgba(255,255,255,0.7)' : C.mutedForeground}
        />
      </Pressable>
    );
  }, [selectedId]);

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.heading}>Document Analyser</Text>
          <Text style={styles.subheading}>Paste study notes to get readability stats & keywords</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAddVisible(true);
          }}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {isLoading && (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      )}

      {!isLoading && (!docs || docs.length === 0) ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Feather name="file-text" size={36} color={C.primary} style={{ opacity: 0.7 }} />
          </View>
          <Text style={styles.emptyTitle}>Analyse your study materials</Text>
          <Text style={styles.emptyText}>
            Paste textbook notes, essays, or any study text. We'll calculate readability grade, reading time, and extract the most important keywords.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.addBtn, { marginTop: 8 }, pressed && { opacity: 0.8 }]}
            onPress={() => setAddVisible(true)}
          >
            <Feather name="upload" size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add Your First Document</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={docs ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: botPad, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <>
              {renderDoc({ item })}
              {selectedId === item.id && (
                <DocumentDetail id={item.id} onDeleted={handleDeleted} />
              )}
            </>
          )}
        />
      )}

      <AddDocumentModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onAdded={handleAdded}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
  },
  subheading: {
    fontSize: 13,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
    flexShrink: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexShrink: 0,
  },
  addBtnText: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Document list card
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  docCardSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  docIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: C.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docIconBoxSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  docTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  docTitleSelected: { color: '#fff' },
  docBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  docBadgeDone: { backgroundColor: C.success + '22' },
  docBadgePending: { backgroundColor: C.secondary },
  docBadgeOnSelected: { backgroundColor: 'rgba(255,255,255,0.2)' },
  docBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: C.mutedForeground,
    textTransform: 'capitalize',
  },
  docBadgeTextOnSelected: { color: 'rgba(255,255,255,0.85)' },

  // Detail card
  detailCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 12,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  detailTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusDone: { backgroundColor: C.success + '22' },
  statusPending: { backgroundColor: C.secondary },
  statusText: { fontSize: 11, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  statusTextDone: { color: C.success },
  statusTextPending: { color: C.mutedForeground },
  filenameText: {
    fontSize: 12,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
  deleteBtn: {
    padding: 4,
    flexShrink: 0,
  },

  // Results
  resultsArea: { padding: 16, gap: 20 },
  section: { gap: 10 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: C.foreground,
    fontFamily: 'Inter_600SemiBold',
  },
  summaryBox: {
    backgroundColor: '#3B82F6' + '0D',
    borderWidth: 1,
    borderColor: '#3B82F6' + '30',
    borderRadius: 12,
    padding: 14,
  },
  summaryText: {
    fontSize: 14,
    color: C.foreground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  keywordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordPill: {
    backgroundColor: '#10B981' + '18',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  keywordText: {
    fontSize: 13,
    color: '#10B981',
    fontFamily: 'Inter_500Medium',
  },
  contentBox: {
    backgroundColor: C.secondary,
    borderRadius: 12,
    padding: 14,
    maxHeight: 200,
  },
  contentText: {
    fontSize: 13,
    color: C.foreground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },

  // Ready (not yet analysed)
  readyState: {
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  readyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  readyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
  },
  readyText: {
    fontSize: 13,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  analyseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 4,
  },
  analyseBtnText: {
    fontSize: 15,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },

  // Modal
  modalRoot: {
    flex: 1,
    backgroundColor: C.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
  },
  modalBody: {
    padding: 20,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: C.foreground,
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
    marginTop: 12,
  },
  required: { color: C.destructive },
  fieldHint: {
    fontSize: 13,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
  titleInput: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.foreground,
    fontFamily: 'Inter_400Regular',
  },
  contentInput: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.foreground,
    fontFamily: 'Inter_400Regular',
    minHeight: 220,
  },
  wordCount: {
    fontSize: 12,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginTop: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.secondary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 15,
    color: C.foreground,
    fontFamily: 'Inter_500Medium',
  },
  saveDocBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveDocBtnDisabled: { opacity: 0.4 },
  saveDocText: {
    fontSize: 15,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
});
