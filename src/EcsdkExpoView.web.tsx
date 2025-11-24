import * as React from 'react';

import { EcsdkExpoViewProps } from './EcsdkExpo.types';

export default function EcsdkExpoView(props: EcsdkExpoViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
