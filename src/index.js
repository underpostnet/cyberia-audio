import { dispatch } from './dispatcher.js';
import { stop } from './runtime/playback.js';

const routes = (bus) => Object.freeze({
  play: async (id, options) => (await dispatch(bus, id, options)).playback,
  render: async (id, options) => (await dispatch(bus, id, options, { play: false })).audio,
  record: async (id, options) => (await dispatch(bus, id, options, { play: false, record: true })).path,
  stop: () => stop(bus),
});

export default Object.freeze({ sfx: routes('sfx'), music: routes('music'), stop: () => stop() });
