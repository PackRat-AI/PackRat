import { CreatePackTemplateItemForm } from "expo-app/features/pack-templates/screens/CreatePackTemplateItemForm";
import { useLocalSearchParams } from "expo-router";

export default function NewTemplateItemScreen() {
  const { packTemplateId } = useLocalSearchParams();

  return (
    <CreatePackTemplateItemForm packTemplateId={packTemplateId as string} />
  );
}
