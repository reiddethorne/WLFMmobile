import type { ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { ArticleImage } from "@/components/ArticleImage";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import type { ArticleBlock } from "@/services/articleContent";

export function ArticleBody({ blocks, onOpenLink }: {
  readonly blocks: readonly ArticleBlock[];
  readonly onOpenLink: (url: string) => void;
}) {
  const { styles } = useStyles();

  function render(block: ArticleBlock, key: string): ReactNode {
    switch (block.type) {
      case "image": return <ArticleImage image={block.image} key={key} />;
      case "rule": return <View key={key} style={styles.rule} />;
      case "quote": return <View key={key} style={styles.quote}>{block.blocks.map((child, index) => render(child, `${key}-${index}`))}</View>;
      case "list": return (
        <View key={key} style={styles.list}>
          {block.items.map((item, index) => (
            <View key={`${key}-${index}`} style={styles.listRow}>
              <Text style={styles.bullet}>{block.ordered ? `${block.start + index}.` : "•"}</Text>
              <View style={styles.listContent}>{item.map((child, childIndex) => render(child, `${key}-${index}-${childIndex}`))}</View>
            </View>
          ))}
        </View>
      );
      case "embed": return (
        <Pressable
          accessibilityRole="link"
          accessibilityHint="Opens media in your browser"
          key={key}
          onPress={() => onOpenLink(block.url)}
          style={({ pressed }) => [styles.media, pressed && styles.pressed]}
        >
          <Text style={styles.mediaTitle}>▶ {block.label}</Text>
          <Text style={styles.caption}>Opens in your browser</Text>
        </Pressable>
      );
      case "text": return (
        <Text
          accessibilityRole={block.style === "heading" ? "header" : undefined}
          key={key}
          selectable
          style={[
            styles.paragraph,
            block.style === "heading" && styles.heading,
            block.style === "heading" && { fontSize: block.level <= 2 ? 26 : block.level <= 4 ? 23 : 20 },
            block.style === "caption" && styles.caption,
            block.style === "pre" && styles.pre,
          ]}
        >
          {block.spans.map((span, index) => (
            <Text
              accessibilityRole={span.href ? "link" : undefined}
              key={`${key}-${index}`}
              onPress={span.href ? () => onOpenLink(span.href!) : undefined}
              style={[
                span.bold && styles.bold, span.italic && styles.italic,
                span.strike && styles.strike, span.code && styles.code,
                !!span.href && styles.link,
              ]}
            >{span.text}</Text>
          ))}
        </Text>
      );
    }
  }

  return <View style={styles.body}>{blocks.map((block, index) => render(block, String(index)))}</View>;
}

const useStyles = createThemedStyles((theme) => ({
  body: { gap: theme.spacing.lg },
  paragraph: { color: theme.colors.text, fontSize: 18, lineHeight: 29 },
  heading: { color: theme.colors.text, fontWeight: "800", lineHeight: 34 },
  caption: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  strike: { textDecorationLine: "line-through" },
  code: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  pre: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", backgroundColor: theme.colors.surfaceMuted, padding: theme.spacing.md },
  link: { color: theme.colors.text, textDecorationLine: "underline", fontWeight: "600" },
  quote: { gap: theme.spacing.md, borderLeftWidth: 3, borderLeftColor: theme.colors.accent, paddingLeft: theme.spacing.md },
  list: { gap: theme.spacing.md },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.sm },
  listContent: { flex: 1, gap: theme.spacing.md },
  bullet: { color: theme.colors.text, fontSize: 18, lineHeight: 29, minWidth: 24 },
  rule: { height: 1, backgroundColor: theme.colors.border },
  media: { gap: theme.spacing.sm, padding: theme.spacing.lg, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted },
  mediaTitle: { color: theme.colors.text, fontSize: theme.fontSize.body, fontWeight: "700" },
  pressed: { opacity: 0.7 },
}));
