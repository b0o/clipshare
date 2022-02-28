module.exports = {
  extends: "airbnb-base",

  parser:        "@babel/eslint-parser",
  parserOptions: {
    ecmaVersion:  "2021",
    sourceType:   "module",
    babelOptions: {
      plugins: ["@babel/plugin-syntax-top-level-await"],
    },
  },
  env: {
    node:    true,
    browser: true,
  },
  plugins: [],
  rules:   {
    semi:             ["error", "never"],
    "comma-dangle":   ["warn", "always-multiline"],
    quotes:           ["warn", "double"],
    "no-cond-assign": ["error", "except-parens"],

    "prefer-rest-params":       "off",
    "no-underscore-dangle":     "off",
    "newline-per-chained-call": "off",
    "no-restricted-syntax":     "off",
    "implicit-arrow-linebreak": "off",
    "import/extensions":        "off",

    "no-console":
      process.env.NODE_ENV === "production"
        ? "error"
        : "warn",

    "key-spacing": [
      "warn",
      {
        singleLine: {
          beforeColon: false,
          afterColon:  true,
        },
        multiLine: {
          beforeColon: false,
          afterColon:  true,
          align:       "value",
        },
      },
    ],

    indent: [
      "warn",
      2,
      {
        SwitchCase:         0,
        VariableDeclarator: { var: 2, let: 2, const: 3 },
      },
    ],
  },
}
