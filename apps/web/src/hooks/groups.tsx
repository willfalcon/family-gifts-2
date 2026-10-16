import { convexQuery } from '@convex-dev/react-query';
import { useSuspenseQuery } from '@tanstack/react-query';
import { api } from '@convex/_generated/api';
import { Group } from '@convex/types';
import { Id } from '@convex/_generated/dataModel';

export function useGroups() {
  const { data: groups } = useSuspenseQuery(convexQuery(api.groups.myGroups, {}));
  return { groups };
}

export function useGroup(id: string) {
  const { data: group } = useSuspenseQuery(convexQuery(api.groups.get, { id }));
  return { group };
}

export function useGroupMembers(groupId: Id<'groups'>) {
  const { data: members } = useSuspenseQuery(convexQuery(api.groups.listMembers, { groupId }));
  return { members };
}

export function useGroupInvites(groupId: Id<'groups'>) {
  const { data: invites } = useSuspenseQuery(convexQuery(api.groups.listInvites, { groupId }));
  return { invites };
}

export function useGroupSharedLists(groupId: Id<'groups'>) {
  const { data: lists } = useSuspenseQuery(convexQuery(api.listShares.sharedWithGroup, { groupId }));
  return { lists };
}
