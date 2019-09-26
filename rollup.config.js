import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import flowEntry from 'rollup-plugin-flow-entry';

export default {
    input: 'src/index.js',
    plugins: [
        babel({
            exclude: 'node_modules/**',
            presets: [['@babel/preset-env', { modules: false, targets: { node: "8" } }]]
        }),
        resolve(),
        commonjs(),
        flowEntry(),
    ],
    external: ['react', 'react-dom'],
    output: [{
        dir: 'dist/cjs',
        format: 'cjs'
    }, {
        dir: 'dist/esm',
        format: 'esm'
    }]
};
