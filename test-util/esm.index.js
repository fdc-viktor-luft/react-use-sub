import { act } from 'react-dom/test-utils';
import { _config } from '../dist/esm';

_config.batch = act;
_config.dispatch = (fn) => fn();
_config.onError = (errMsg) => {
    throw new Error(errMsg);
};
