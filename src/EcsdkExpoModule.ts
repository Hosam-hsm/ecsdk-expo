import { NativeModule, requireNativeModule } from 'expo';

import { EcsdkExpoModuleEvents } from './EcsdkExpo.types';

declare class EcsdkExpoModule extends NativeModule<EcsdkExpoModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<EcsdkExpoModule>('EcsdkExpo');
