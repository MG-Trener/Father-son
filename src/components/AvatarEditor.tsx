import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useFamily } from "../context/FamilyContext";
import { supabase } from "../lib/supabase";
import { Avatar } from "./Avatar";
import { Button, Card, ui } from "./Everyday";
import { useFeedback } from "./Feedback";
export function AvatarEditor() {
  const { family, me } = useFamily();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const feedback = useFeedback();
  const choose = async () => {
    if (!supabase || !family || !me || busy) return;
    setBusy(true);
    setError("");
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        exif: false,
      });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if (!asset) return;
      const edge = Math.min(asset.width, asset.height);
      const context = ImageManipulator.manipulate(asset.uri);
      context
        .crop({
          originX: Math.floor((asset.width - edge) / 2),
          originY: Math.floor((asset.height - edge) / 2),
          width: edge,
          height: edge,
        })
        .resize({ width: 256, height: 256 });
      const rendered = await context.renderAsync();
      let bytes: ArrayBuffer | null = null;
      for (const quality of [0.8, 0.6, 0.4]) {
        const compressed = await rendered.saveAsync({
          format: SaveFormat.JPEG,
          compress: quality,
        });
        bytes =
          Platform.OS === "web"
            ? await (await fetch(compressed.uri)).arrayBuffer()
            : await new File(compressed.uri).arrayBuffer();
        if (bytes.byteLength <= 100 * 1024) break;
      }
      if (!bytes?.byteLength || bytes.byteLength > 100 * 1024)
        throw new Error("Не удалось уменьшить фото. Выберите другое.");
      const result = await supabase.storage
        .from("family-avatars")
        .upload(`${family.id}/${me.user_id}.jpg`, bytes, {
          upsert: true,
          contentType: "image/jpeg",
          cacheControl: "0",
        });
      if (result.error) throw result.error;
      setRevision((r) => r + 1);
      feedback("Аватар сохранён");
    } catch {
      setError(
        "Не удалось сохранить фото. Проверьте интернет и попробуйте ещё раз.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <View style={ui.row}>
        <Avatar
          familyId={family?.id}
          userId={me?.user_id}
          name={me?.display_name ?? "Я"}
          revision={revision}
        />
        <View style={ui.flex}>
          <Text style={ui.sectionTitle}>Мой аватар</Text>
          <Text style={ui.caption}>На главном экране и в вашей семье</Text>
        </View>
      </View>
      <Button
        label="Выбрать фото из галереи"
        secondary
        busy={busy}
        onPress={() => void choose()}
      />
      <Text style={ui.caption}>
        Обрежем до квадрата и уменьшим до 256 × 256. Размер — не больше 100 КБ.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={ui.body}>
          {error}
        </Text>
      ) : null}
    </Card>
  );
}
