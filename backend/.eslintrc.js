module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  rules: {
    // Customize rules for our project
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    
    // Allow longer lines for readability
    'max-len': ['error', { code: 120, ignoreComments: true }],
    
    // Allow underscore in variable names (database conventions)
    'camelcase': ['error', { allow: ['created_at', 'updated_at', 'user_id', 'session_id'] }],
    
    // Allow console.log in development
    'no-console': 'off',
    
    // Relax some strict rules for practical development
    'consistent-return': 'warn',
    'no-param-reassign': 'warn',
    
    // Database field naming conventions
    'no-underscore-dangle': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js'],
      rules: {
        // Allow more flexible rules in test files
        'no-unused-expressions': 'off',
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};