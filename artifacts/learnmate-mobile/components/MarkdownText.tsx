import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import colors from '@/constants/colors';

const C = colors.dark;

/** Strip inline markdown markers: **bold**, *italic*, `code`, [links](url). */
function inline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1');
}

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; num: string; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'paragraph'; text: string };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  let codeBuf: string[] | null = null;
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length) {
      blocks.push({ kind: 'paragraph', text: inline(paraBuf.join(' ')) });
      paraBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().startsWith('```')) {
      if (codeBuf === null) {
        flushPara();
        codeBuf = [];
      } else {
        blocks.push({ kind: 'code', text: codeBuf.join('\n') });
        codeBuf = null;
      }
      continue;
    }
    if (codeBuf !== null) {
      codeBuf.push(raw);
      continue;
    }
    const heading = line.match(/^#{1,6}\s+(.*)/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (heading) {
      flushPara();
      blocks.push({ kind: 'heading', text: inline(heading[1]) });
    } else if (bullet) {
      flushPara();
      blocks.push({ kind: 'bullet', text: inline(bullet[1]) });
    } else if (numbered) {
      flushPara();
      blocks.push({ kind: 'numbered', num: numbered[1], text: inline(numbered[2]) });
    } else if (line.trim() === '' || /^[-*_]{3,}$/.test(line.trim())) {
      flushPara();
    } else {
      paraBuf.push(line.trim());
    }
  }
  if (codeBuf !== null && codeBuf.length) blocks.push({ kind: 'code', text: codeBuf.join('\n') });
  flushPara();
  return blocks;
}

/**
 * Lightweight markdown renderer for chat bubbles and other AI text.
 * Handles headings, bullets, numbered lists, code blocks, and strips
 * inline markers — no external dependencies.
 */
export function MarkdownText({ content, color }: { content: string; color?: string }) {
  const blocks = parse(content);
  const textColor = color ?? C.foreground;
  return (
    <View style={styles.wrap}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Text key={i} style={[styles.heading, { color: textColor }]}>
                {b.text}
              </Text>
            );
          case 'bullet':
            return (
              <View key={i} style={styles.listRow}>
                <Text style={[styles.bulletDot, { color: textColor }]}>•</Text>
                <Text style={[styles.body, styles.listText, { color: textColor }]}>{b.text}</Text>
              </View>
            );
          case 'numbered':
            return (
              <View key={i} style={styles.listRow}>
                <Text style={[styles.bulletDot, { color: textColor }]}>{b.num}.</Text>
                <Text style={[styles.body, styles.listText, { color: textColor }]}>{b.text}</Text>
              </View>
            );
          case 'code':
            return (
              <View key={i} style={styles.codeBlock}>
                <Text style={styles.codeText}>{b.text}</Text>
              </View>
            );
          default:
            return (
              <Text key={i} style={[styles.body, { color: textColor }]}>
                {b.text}
              </Text>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  heading: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    marginTop: 4,
  },
  body: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  listRow: { flexDirection: 'row', gap: 6, paddingLeft: 4 },
  bulletDot: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_600SemiBold' },
  listText: { flex: 1 },
  codeBlock: {
    backgroundColor: C.secondary,
    borderRadius: 8,
    padding: 10,
  },
  codeText: {
    fontSize: 13,
    color: C.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
