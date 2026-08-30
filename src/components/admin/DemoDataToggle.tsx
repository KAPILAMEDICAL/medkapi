'use client';

import { ActionButton } from '@/components/admin/ActionButton';

export function DemoDataToggle({ enabled }: { enabled: boolean }) {
  return (
    <ActionButton
      url="/api/settings"
      method="PATCH"
      body={{ key: 'seed.isDemoData', value: !enabled }}
      variant={enabled ? 'outline' : 'primary'}
      confirmMessage={enabled ? 'Turn off the demo data notice? Only do this once real data has been imported.' : undefined}
    >
      {enabled ? 'Turn Off Demo Data Notice' : 'Turn On Demo Data Notice'}
    </ActionButton>
  );
}
