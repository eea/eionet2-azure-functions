const js = require('@eslint/js');
const importPlugin = require('eslint-plugin-import');

module.exports = [
    js.configs.recommended,
    {
        files: ['src/**/*.{js,jsx}'],
        plugins: {
            import: importPlugin,
        },
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'commonjs',
            globals: {
                // ES6 globals
                Promise: 'readonly',
                Symbol: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
                WeakMap: 'readonly',
                WeakSet: 'readonly',
                Proxy: 'readonly',
                Reflect: 'readonly',
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                alert: 'readonly',
                // Node.js globals
                global: 'readonly',
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                module: 'readonly',
                require: 'readonly',
                exports: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                // Jest globals
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                jest: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
        rules: {
            // Only use import/errors rules from the original config
            ...importPlugin.configs.errors.rules,
            // Original rules from .eslintrc.json
            'react/prop-types': 'off',
            'linebreak-style': 'warn',
        },
        settings: {
            react: {
                version: 'detect',
            },
            'import/resolver': {
                node: {
                    paths: ['src'],
                    extensions: ['.js', '.jsx', '.json'],
                },
            },
        },
    },
];
