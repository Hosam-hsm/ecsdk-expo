import { requireNativeView } from 'expo';
import * as React from 'react';

import { EcsdkExpoViewProps } from './EcsdkExpo.types';

const NativeView: React.ComponentType<EcsdkExpoViewProps> =
  requireNativeView('EcsdkExpo');

export default function EcsdkExpoView(props: EcsdkExpoViewProps) {
  return <NativeView {...props} />;
}
