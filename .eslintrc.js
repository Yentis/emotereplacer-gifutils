module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'airbnb-base'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json']
  },
  plugins: [
    '@typescript-eslint'
  ],
  rules: {
    'comma-dangle': 'off',
    'import/extensions': 'off',
    'no-console': 'off',
    '@typescript-eslint/no-floating-promises': ['error'],
    'no-bitwise': 'off',
    'prefer-destructuring': ['error', {
      'array': false,
      'object': true
    }, {
      'enforceForRenamedProperties': false
    }],
    'no-continue': 'off',
    'no-plusplus': 'off'
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.ts']
      }
    }
  }
};
