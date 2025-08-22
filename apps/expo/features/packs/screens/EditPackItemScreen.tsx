import { CreatePackItemForm } from "expo-app/features/packs/screens/CreatePackItemForm";
import { NotFoundScreen } from "expo-app/screens/NotFoundScreen";
import { useLocalSearchParams } from "expo-router";
import { usePackItemDetailsFromStore } from "../hooks";

export function EditPackItemScreen() {
  const { id, packId } = useLocalSearchParams();
  const effectiveItemId = Array.isArray(id) ? id[0] : id;
  const effectivePackId = Array.isArray(packId) ? packId[0] : packId;

  const item = usePackItemDetailsFromStore(effectiveItemId || "");

  if (!item || !effectivePackId || !effectiveItemId) {
    return (
      <NotFoundScreen
        title="Pack not found"
        message="The pack you're looking for doesn't exist or has been moved."
        backButtonLabel="Go Back"
      />
    );
  }

  return <CreatePackItemForm packId={effectivePackId} existingItem={item} />;
}
