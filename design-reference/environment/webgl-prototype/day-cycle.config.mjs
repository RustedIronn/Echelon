import {mergeConfig} from 'vite';
import base from './vite.config.mjs';
export default mergeConfig(base,{server:{watch:{ignored:['**/.claude/**','**/design-reference/**','**/dist/**']}}});
