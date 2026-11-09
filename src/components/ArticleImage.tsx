import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";

import { createThemedStyles } from "@/hooks/useThemedStyles";
import type { ArticleImage as ArticleImageData } from "@/services/articleContent";

export function ArticleImage({ image, cover = false }: { readonly image: ArticleImageData; readonly cover?: boolean }) {
  const { styles } = useStyles();
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState(image.width && image.height ? image.width / image.height : 4 / 3);
  useEffect(() => {
    setFailed(false);
    setRatio(image.width && image.height ? image.width / image.height : 4 / 3);
  }, [image.url, image.width, image.height]);

  return (
    <View style={[styles.frame, { aspectRatio: cover ? 16 / 10 : ratio }]}>
      {failed ? (
        <Text style={styles.fallback}>Image unavailable</Text>
      ) : (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={image.alt || "Article image"}
          onError={() => setFailed(true)}
          onLoad={({ nativeEvent }) => {
            const { width, height } = nativeEvent.source;
            if (width > 0 && height > 0) setRatio(width / height);
          }}
          resizeMode={cover ? "cover" : "contain"}
          source={{ uri: image.url }}
          style={styles.image}
        />
      )}
    </View>
  );
}

const useStyles = createThemedStyles((theme) => ({
  frame: {
    width: "100%", overflow: "hidden", borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted, alignItems: "center", justifyContent: "center",
  },
  image: { width: "100%", height: "100%" },
  fallback: { color: theme.colors.muted, fontSize: theme.fontSize.body, padding: theme.spacing.md },
}));
