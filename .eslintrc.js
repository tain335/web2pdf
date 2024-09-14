module.exports = {
  root: true,
  ignorePatterns: ['.eslintrc.js', 'prettier.config.js', 'commitlint.config.js', 'config-overrides.js', 'scripts/**', 'i18n/**', 'gulpFile.js'],
  extends: ['airbnb', 'prettier', 'plugin:prettier/recommended', 'plugin:react/recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    browser: true
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      },
      typescript: {
        alwaysTryTypes: true
      }
    },
    react: {
      version: '17.0',
    },
    polyfills: ['Promise', 'URL'],
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: ['react', 'import', 'prettier', '@typescript-eslint'],
  rules: {
    'no-unused-vars': 1,
    '@typescript-eslint/no-unused-vars': 1,
    '@typescript-eslint/no-empty-function': 1,
    'import/prefer-default-export': 0,
    'react/jsx-no-useless-fragment': 0,
    'react/function-component-definition': 0,
    'react/jsx-filename-extension': 0,
    'react/require-default-props': 0,
    'react/jsx-props-no-spreading': 0,
    'react/no-unstable-nested-components': 0,
    'react/display-name': 0,
    'react/destructuring-assignment': 0,
    'import/extensions': 0,
    'no-use-before-define': 0,
    'no-restricted-syntax': 0,
    'prettier/prettier': 2,
    'no-await-in-loop': 0,
    "no-continue": 0,
    "prefer-destructuring": 0,
    "import/no-extraneous-dependencies": 0,
    "import/newline-after-import": [2, { "count": 1}],
    "no-useless-constructor": 0,
    "no-debugger": 1,
    "no-shadow": 1,
    "no-plusplus": 0,
    "no-loop-func": 0,
    "class-methods-use-this": 0,
    "no-param-reassign": 1,
    "max-classes-per-file": 0,
    "@typescript-eslint/ban-ts-comment": 0,
    "import/order": [2, {
      "pathGroups": [
        {
          "pattern": "react",
          "group": "external",
          "position": "before"
        },
        {
          "pattern": "react-dom",
          "group": "external",
          "position": "before"
        },
        {
          "pattern": "react-router-dom",
          "group": "external",
          "position": "before"
        },
        {
          "pattern": "@src/**",
          "group": "index",
          "position": "before"
        },
        {
          "pattern": "@hooks/**",
          "group": "index",
          "position": "before"
        },
        {
          "pattern": "@utils/**",
          "group": "index",
          "position": "before"
        }
      ],
      "pathGroupsExcludedImportTypes": ["react", "react-router-dom", "react-dom"],
      "groups": ["external", "builtin", "index", "sibling", "parent", "internal", "object", "type"]
    }],
  },
};
  