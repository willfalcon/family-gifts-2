import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

export function useGroups() {
  return useQuery(api.groups.myGroups);
}

// The viewer's local date as "YYYY-MM-DD", so "coming up" matches their calendar.
function localToday() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Members of a group, each with their shared-idea counts and next occasion.
export function useGroupMembers(groupId: string) {
  return useQuery(api.groups.memberSummaries, { groupId, today: localToday() });
}

export function useGroup(groupId: string) {
  return useQuery(api.groups.get, { id: groupId });
}

// Pending invites for a group. undefined while loading, null if the viewer
// isn't an owner/manager (they can't see invites), otherwise an array.
export function useGroupInvites(groupId: string) {
  return useQuery(api.groups.listInvites, { groupId });
}

// The group's shareable join link and its settings. undefined while loading,
// null for a non-member. `url` is null when the viewer isn't allowed to share
// it (or a manager hasn't created one yet for an older group).
export function useGroupInviteLink(groupId: string) {
  return useQuery(api.groups.getInviteLink, { groupId });
}

// Events the group has been invited to, with the viewer's own status for each.
// undefined while loading, null for a non-member.
export function useGroupEvents(groupId: string) {
  return useQuery(api.groups.listEvents, { groupId });
}
