import * as Linking from "expo-linking";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArticleBody } from "@/components/ArticleBody";
import { ArticleImage } from "@/components/ArticleImage";
import { useBlogPost } from "@/hooks/useBlogPost";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import { formatBlogDate, safeArticleLink } from "@/services/articleContent";
import { getCachedBlogPostByUrl } from "@/services/wordpress";

export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const article = useBlogPost(id);
  const { styles, theme } = useStyles();
  const post = article.post;

  const openLink = async (value: string) => {
    const url = safeArticleLink(value);
    if (!url) return;
    try {
      const linkedPost = url.startsWith("https:") ? getCachedBlogPostByUrl(url) : null;
      if (linkedPost) {
        if (String(linkedPost.id) !== id) router.push({ pathname: "/article/[id]", params: { id: String(linkedPost.id) } });
        return;
      }
      await Linking.openURL(url);
    } catch { Alert.alert("Unable to open link", "Please try again."); }
  };

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.screen}>
      <Stack.Screen options={router.canGoBack() ? {} : {
        headerLeft: () => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to blog"
            onPress={() => router.replace("/(tabs)/blog")}
            style={styles.headerBack}
          >
            <Text style={styles.backText}>‹ Blog</Text>
          </Pressable>
        ),
      }} />
      {article.loading ? (
        <View style={styles.status}>
          <ActivityIndicator accessibilityLabel="Loading story" color={theme.colors.text} />
          <Text style={styles.muted}>Loading story…</Text>
        </View>
      ) : !post ? (
        <View style={styles.status}>
          <Text accessibilityRole="alert" style={styles.muted}>{article.error ?? "This story is not available."}</Text>
          {__DEV__ && article.diagnostic && <Text selectable style={styles.muted}>{article.diagnostic}</Text>}
          <Pressable accessibilityRole="button" onPress={article.retry} style={styles.button}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/(tabs)/blog")} style={styles.backButton}>
            <Text style={styles.backText}>Back to stories</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headingGroup}>
            <Text accessibilityRole="header" selectable style={styles.title}>{post.title}</Text>
            <Text style={styles.author}>By {post.author}</Text>
            <Text style={styles.muted}>{formatBlogDate(post.publishedAt)}</Text>
          </View>
          {post.featuredImage && <ArticleImage image={post.featuredImage} />}
          {post.blocks.length ? (
            <ArticleBody blocks={post.blocks} onOpenLink={(url) => void openLink(url)} />
          ) : <Text style={styles.muted}>{post.excerpt || "There is no article text for this story yet."}</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { width: "100%", maxWidth: 680, alignSelf: "center", padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl, gap: theme.spacing.xl },
  headingGroup: { gap: theme.spacing.sm },
  eyebrow: { color: theme.colors.muted, fontSize: theme.fontSize.caption, fontWeight: "800", letterSpacing: 2 },
  title: { color: theme.colors.text, fontSize: 32, lineHeight: 40, fontWeight: "800" },
  author: { color: theme.colors.text, fontSize: theme.fontSize.body, fontWeight: "600", marginTop: theme.spacing.sm },
  muted: { color: theme.colors.muted, fontSize: theme.fontSize.body, lineHeight: 25 },
  status: { width: "100%", maxWidth: 520, alignSelf: "center", padding: theme.spacing.lg, gap: theme.spacing.md },
  button: { alignSelf: "flex-start", padding: theme.spacing.md, backgroundColor: theme.colors.accent, borderRadius: theme.radius.md },
  buttonText: { color: theme.colors.accentText, fontSize: theme.fontSize.body, fontWeight: "700" },
  backButton: { alignSelf: "flex-start", paddingVertical: theme.spacing.md },
  headerBack: { paddingVertical: theme.spacing.sm, paddingRight: theme.spacing.md },
  backText: { color: theme.colors.text, fontSize: theme.fontSize.body, textDecorationLine: "underline" },
}));
