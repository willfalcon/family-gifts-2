import type { ReactElement, ReactNode } from 'react';
import { Group, Host, List, RNHostView } from '@expo/ui/swift-ui';
import {
  listRowBackground,
  listRowInsets,
  listRowSeparator,
  listRowSpacing,
  listStyle,
  scrollContentBackground,
} from '@expo/ui/swift-ui/modifiers';

// Rows of a NativeList draw their own look, so strip the List's padding,
// separators and background from each row.
export const LIST_ROW_MODIFIERS = [
  listRowInsets({ top: 0, leading: 0, bottom: 0, trailing: 0 }),
  listRowSeparator('hidden'),
  listRowBackground('clear'),
];

// A scrolling native SwiftUI List. Using it (instead of a ScrollView) is what
// makes swipe actions behave like other iOS apps - the row slides closed after
// an action is tapped. Children must be rows: SwipeActions with
// LIST_ROW_MODIFIERS, or plain RN content wrapped in ListRow.
export function NativeList({ children, rowSpacing = 0 }: { children: ReactNode; rowSpacing?: number }) {
  return (
    <Host style={{ flex: 1 }}>
      <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), listRowSpacing(rowSpacing)]}>
        {children}
      </List>
    </Host>
  );
}

// Lets the List measure hosted RN content, so the row gets its real height.
export function RNRowContent({ children }: { children: ReactElement }) {
  return <RNHostView matchContents={{ vertical: true }}>{children}</RNHostView>;
}

// A plain (non-swipeable) row of React Native content.
export function ListRow({ children }: { children: ReactElement }) {
  return (
    <Group modifiers={LIST_ROW_MODIFIERS}>
      <RNRowContent>{children}</RNRowContent>
    </Group>
  );
}
