import React, { useEffect, useState } from 'react';
import { Separator, Text, View, YGroup } from 'tamagui';
import { RButton } from '@packrat/ui';
import useTheme from 'app/hooks/useTheme';
import { useAddPackItem } from 'app/hooks/packs/useAddPackItem';

interface Category {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  ownerId: string;
  weight: number;
  quantity: number;
  unit: string;
  category: Category;
}

interface SuggestionListProps {
  suggestion: { Items: Item[] } | null;
  onAddItem: (itemId: string) => void;
}

export function SuggestionList({ suggestion, onAddItem }: SuggestionListProps) {
  const [itemsList, setItemsList] = useState<Item[]>([]);
  const { isDark } = useTheme();

  useEffect(() => {
    if (suggestion?.Items) {
      setItemsList(suggestion.Items);
    } else {
      setItemsList([]);
    }
  }, [suggestion]);

  return (
    <YGroup
      style={{
        background: isDark ? '#333' : 'white',
        padding: 10,
        borderRadius: 0,
      }}
    >
      <View
        style={{
          minWidth: 300,
        }}
        $group-window-gtXs={{
          padding: '$3',
          width: 800,
          height: 100,
        }}
        gap="$1.5"
      >
        {itemsList.map((item, i) => (
          <React.Fragment key={item.id}>
            <Item item={item} onAddItem={onAddItem} />
            {i < itemsList.length - 1 && <Separator />}
          </React.Fragment>
        ))}
      </View>
    </YGroup>
  );
}

SuggestionList.fileName = 'List';

function Item({ item, onAddItem }) {
  const { addPackItem, isLoading } = useAddPackItem();

  const handleAddItem = (item) => {
    addPackItem(item);
    onAddItem(item.id);
  };

  return (
    <YGroup.Item>
      <View
        paddingVertical="$1"
        paddingHorizontal="$1.5"
        gap="$2"
        $group-window-gtXs={{
          padding: '$4',
          gap: '$4',
        }}
        backgroundColor="$color1"
        style={{ borderRadius: 5, flexDirection: 'row', aligItems: 'center' }}
      >
        <View
          style={{ flexDirection: 'column', justifyContent: 'center' }}
          flexShrink={1}
        >
          <Text selectable>{item.name}</Text>
          <Text
            selectable
            fontSize="$2"
            lineHeight="$2"
            fontWeight="$2"
            // theme="alt1"
          >
            {item.category} {item.weight}
            {item.unit}, {item.quantity}pcs
          </Text>
        </View>
        <RButton
          onPress={() => {
            handleAddItem(item);
          }}
          style={{ borderRadius: 5, marginLeft: 'auto' }}
          disabled={isLoading}
        >
          Add
        </RButton>
      </View>
    </YGroup.Item>
  );
}
