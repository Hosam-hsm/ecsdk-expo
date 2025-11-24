import { registerWebModule, NativeModule } from 'expo';

import { EcsdkExpoModuleEvents } from './EcsdkExpo.types';

class EcsdkExpoModule extends NativeModule<EcsdkExpoModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(EcsdkExpoModule, 'EcsdkExpoModule');
