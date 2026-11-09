import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ArticleImage } from "@/components/ArticleImage";
import { STATION_ARTWORK } from "@/constants/assets";
import { useBlogPosts } from "@/hooks/useBlogPosts";
import { createThemedStyles } from "@/hooks/useThemedStyles";
import { formatBlogDate } from "@/services/articleContent";

export default function Blog() {
  const { styles, theme } = useStyles();
  const blog = useBlogPosts();
  const router = useRouter();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>
      <FlatList
        contentContainerStyle={styles.content}
        data={blog.posts}
        keyExtractor={(post) => String(post.id)}
        refreshing={blog.status === "loading" && blog.posts.length > 0}
        onRefresh={blog.status === "coming-soon" ? undefined : blog.refresh}
        ListHeaderComponent={(
          <View style={styles.headingGroup}>
            <Text accessibilityRole="header" style={styles.title}>WLFM Blog</Text>
            <Text style={styles.subtitle}>Stories from the station.</Text>
            {blog.error && (
              <View style={styles.notice}>
                <Text accessibilityRole="alert" style={styles.subtitle}>{blog.error}</Text>
                {__DEV__ && blog.diagnostic && (
                  <Text selectable style={styles.subtitle}>{blog.diagnostic}</Text>
                )}
                <Pressable accessibilityRole="button" onPress={blog.refresh} style={styles.retry}>
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={blog.status === "loading" ? (
          <ActivityIndicator accessibilityLabel="Loading station stories" color={theme.colors.text} />
        ) : blog.status === "error" ? null : (
          <View style={styles.placeholder}>
            <View style={styles.iconFrame}>
              <Image
                accessibilityIgnoresInvertColors
                accessibilityLabel="WLFM station logo"
                resizeMode="contain"
                source={STATION_ARTWORK}
                style={styles.logo}
              />
            </View>
            <Text style={styles.placeholderTitle}>
              {blog.status === "coming-soon" ? "Stories are on the way" : "No recent stories"}
            </Text>
            <Text style={styles.placeholderText}>
              {blog.status === "coming-soon"
                ? "We’re getting the WLFM blog ready for the app. Check back soon for the latest posts."
                : "Stories published from January 1, 2026 onward will appear here."}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, by ${item.author}, ${formatBlogDate(item.publishedAt)}`}
            accessibilityHint="Opens the full article in the app"
            onPress={() => router.push({ pathname: "/article/[id]", params: { id: String(item.id) } })}
            style={({ pressed }) => [styles.post, pressed && styles.postPressed]}
          >
            {item.coverImage && <ArticleImage cover image={item.coverImage} />}
            <Text style={styles.byline}>By {item.author} · {formatBlogDate(item.publishedAt)}</Text>
            <Text accessibilityRole="header" style={styles.postTitle}>{item.title}</Text>
            {!!item.excerpt && <Text numberOfLines={3} style={styles.subtitle}>{item.excerpt}</Text>}
            <Text style={styles.readMore}>Read story</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    width: "100%",
    maxWidth: theme.contentMaxWidth,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.xl,
    alignSelf: "center",
  },
  headingGroup: {
    gap: theme.spacing.sm,
  },
  notice: { gap: theme.spacing.sm },
  retry: {
    alignSelf: "flex-start",
    padding: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
  },
  retryText: { color: theme.colors.accentText, fontWeight: "700" },
  post: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.lg,
  },
  postPressed: { backgroundColor: theme.colors.surfaceMuted },
  postTitle: { color: theme.colors.text, fontSize: 22, fontWeight: "800" },
  byline: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 },
  readMore: { color: theme.colors.text, fontSize: theme.fontSize.body, fontWeight: "700" },
  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.heading,
    fontWeight: "800",
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
  },
  placeholder: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: theme.radius.lg,
    shadowColor: theme.shadow.color,
    shadowOffset: theme.shadow.offset,
    shadowOpacity: theme.shadow.opacity,
    shadowRadius: theme.shadow.radius,
    elevation: theme.shadow.elevation,
  },
  iconFrame: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.md,
  },
  placeholderTitle: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  placeholderText: {
    maxWidth: 360,
    color: theme.colors.muted,
    fontSize: theme.fontSize.body,
    lineHeight: 24,
    textAlign: "center",
  },
}));
