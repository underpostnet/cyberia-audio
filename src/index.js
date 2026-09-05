import { dispatch } from './dispatcher.js';
import { stop } from './runtime/playback.js';

const domain = (type) => Object.freeze({
  play: async (id, options) => (await dispatch(type, id, options)).playback,
  render: async (id, options) => (await dispatch(type, id, options, { play: false })).audio,
  record: async (id, options) => (await dispatch(type, id, options, { play: false, record: true })).path,
  stop: () => stop(type),
});

export default Object.freeze({ sfx: domain('sfx'), music: domain('music'), stop: () => stop() });
