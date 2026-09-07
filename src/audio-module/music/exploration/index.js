import { render } from './dsp.js';
import { getParams } from './params.js';
import manifest from './manifest.json' with { type: 'json' };

export default Object.freeze({
  id: manifest.id,
  bus: manifest.bus,
  render(options = {}) { return render(getParams(options)); },
});
