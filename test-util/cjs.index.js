const { act } = require('react-dom/test-utils');
const { _config } = require('../dist/cjs');

_config.batch = act;
_config.enqueue = (fn) => fn();
