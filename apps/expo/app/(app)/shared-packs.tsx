import { View, ScrollView } from 'react-native';

import { Avatar, AvatarFallback, AvatarImage } from 'nativewindui/Avatar';
import { LargeTitleHeader } from 'nativewindui/LargeTitleHeader';
import { Text } from 'nativewindui/Text';
import { cn } from 'expo-app/lib/cn';

// Mock data for shared packs
const SHARED_PACKS = [
  {
    id: '1',
    name: 'Colorado Trail 2024',
    owner: 'Sarah Johnson',
    ownerAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    members: [
      { id: '1', name: 'You', avatar: 'https://randomuser.me/api/portraits/men/32.jpg' },
      { id: '2', name: 'Mike Chen', avatar: 'https://randomuser.me/api/portraits/men/22.jpg' },
      { id: '3', name: 'Lisa Wong', avatar: 'https://randomuser.me/api/portraits/women/17.jpg' },
    ],
    lastUpdated: '2 days ago',
    totalWeight: '32.6 lbs',
    sharedItems: 12,
  },
  {
    id: '2',
    name: 'Grand Canyon Trip',
    owner: 'You',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    members: [
      { id: '1', name: 'Alex Rodriguez', avatar: 'https://randomuser.me/api/portraits/men/67.jpg' },
      { id: '2', name: 'Emma Wilson', avatar: 'https://randomuser.me/api/portraits/women/22.jpg' },
    ],
    lastUpdated: '1 week ago',
    totalWeight: '28.4 lbs',
    sharedItems: 8,
  },
  {
    id: '3',
    name: 'John Muir Trail',
    owner: 'David Lee',
    ownerAvatar: 'https://randomuser.me/api/portraits/men/52.jpg',
    members: [
      { id: '1', name: 'You', avatar: 'https://randomuser.me/api/portraits/men/32.jpg' },
      { id: '2', name: 'Rachel Green', avatar: 'https://randomuser.me/api/portraits/women/45.jpg' },
      { id: '3', name: 'Tom Wilson', avatar: 'https://randomuser.me/api/portraits/men/62.jpg' },
      {
        id: '4',
        name: 'Sophia Martinez',
        avatar: 'https://randomuser.me/api/portraits/women/28.jpg',
      },
    ],
    lastUpdated: '3 weeks ago',
    totalWeight: '45.2 lbs',
    sharedItems: 15,
  },
];

function MemberAvatars({ members }: { members: { id: string; name: string; avatar: string }[] }) {
  // Only show first 3 members
  const displayMembers = members.slice(0, 3);
  const remainingCount = members.length - 3;

  return (
    <View className="flex-row">
      {displayMembers.map((member, index) => (
        <Avatar
          key={member.id}
          className={cn('h-6 w-6 border border-background', index > 0 && '-ml-2')}>
          <AvatarImage source={{ uri: member.avatar }} />
          <AvatarFallback>
            <Text>{member.name.substring(0, 1)}</Text>
          </AvatarFallback>
        </Avatar>
      ))}
      {remainingCount > 0 && (
        <View className="-ml-2 h-6 w-6 items-center justify-center rounded-full border border-background bg-muted">
          <Text variant="caption2">+{remainingCount}</Text>
        </View>
      )}
    </View>
  );
}

function PackOwner({ name, avatar }: { name: string; avatar: string }) {
  return (
    <View className="flex-row items-center">
      <Avatar className="mr-1 h-5 w-5">
        <AvatarImage source={{ uri: avatar }} />
        <AvatarFallback>
          <Text>{name.substring(0, 1)}</Text>
        </AvatarFallback>
      </Avatar>
      <Text variant="footnote" className="text-muted-foreground">
        {name}
      </Text>
    </View>
  );
}

function SharedPackCard({ pack }: { pack: (typeof SHARED_PACKS)[0] }) {
  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text variant="heading" className="font-semibold">
              {pack.name}
            </Text>
            <PackOwner name={pack.owner} avatar={pack.ownerAvatar} />
          </View>
          <View className="items-end">
            <Text variant="subhead" className="font-medium">
              {pack.totalWeight}
            </Text>
            <Text variant="footnote" className="text-muted-foreground">
              {pack.sharedItems} items
            </Text>
          </View>
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <View>
            <Text variant="caption1" className="mb-1 text-muted-foreground">
              Members
            </Text>
            <MemberAvatars members={pack.members} />
          </View>
          <View>
            <Text variant="caption1" className="text-right text-muted-foreground">
              Last updated
            </Text>
            <Text variant="footnote">{pack.lastUpdated}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function SharedPacksScreen() {
  return (
    <>
      <LargeTitleHeader title="Shared Packs" />
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text variant="subhead" className="mb-2 text-muted-foreground">
            Collaborate on packs with friends and family
          </Text>
        </View>

        <View className="pb-4">
          {SHARED_PACKS.map((pack) => (
            <SharedPackCard key={pack.id} pack={pack} />
          ))}
        </View>

        <View className="mx-4 my-2 mb-6 rounded-lg bg-card p-4">
          <Text variant="heading" className="mb-2 font-semibold">
            Sharing Benefits
          </Text>
          <Text variant="body" className="mb-2">
            • Distribute group gear among members to reduce individual pack weight
          </Text>
          <Text variant="body" className="mb-2">
            • Coordinate meal planning and shared food items
          </Text>
          <Text variant="body" className="mb-2">
            • Track who's bringing what to avoid duplicates
          </Text>
          <Text variant="body">• Collaborate on pack optimization in real-time</Text>
        </View>
      </ScrollView>
    </>
  );
}
