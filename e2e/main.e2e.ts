import { expect } from 'chai';
import { SpectronClient } from 'spectron';

import commonSetup from './common-setup';

describe('dev-manager App', function () {

  commonSetup.apply(this);

  let client: SpectronClient;

  beforeEach(function() {
    client = this.app.client;
  });

  it('creates initial windows', async function () {
    const count = await client.getWindowCount();
    expect(count).to.equal(1);
  });

});
